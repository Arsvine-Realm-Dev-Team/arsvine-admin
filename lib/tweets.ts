import {
  TWEET_LANGS,
  TWEET_VISIBILITIES,
  type CreateTweetInput,
  type RepoSummary,
  type TweetIndexItem,
  type TweetItem,
  type TweetLang,
  type TweetMonthRecord,
  type TweetTranslation,
  type TweetVisibility,
  type TweetsDashboardData,
  type UpdateTweetInput,
} from './tweets-types';
import { buildTweetTranslations, markTweetTranslationsStale } from './tweet-translation';
import {
  deleteFile,
  getContentRepoInfo,
  getFile,
  GitHubError,
  listTweetMonthPaths,
  putFile,
} from './github';
import {
  InputValidationError,
  sanitizeCommitMessage,
  validateTweetId,
} from './input-validation';

const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const INDEX_PATH = 'tweets/index.json';
const MONTH_FILE_PATTERN = /^tweets\/\d{4}-\d{2}\.json$/;

class StoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
  }
}

function toStoreError(error: unknown) {
  if (error instanceof StoreError) return error;
  if (error instanceof GitHubError) {
    if (error.status === 409 || error.status === 422) {
      return new StoreError(409, 'Content repository changed while saving. Please reload and retry.');
    }
    if (error.status === 404) {
      return new StoreError(404, 'Content repository file not found.');
    }
    return new StoreError(502, 'GitHub content repository request failed.');
  }
  return error;
}

function getDateParts(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new StoreError(400, 'Invalid date value.');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function toShanghaiIso(value: Date | string) {
  const { year, month, day, hour, minute, second } = getDateParts(value);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

function normalizeCreatedAtInput(rawValue?: string) {
  if (!rawValue) {
    return toShanghaiIso(new Date());
  }

  const trimmed = rawValue.trim();
  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const [, year, month, day, hour, minute, second = '00'] = localMatch;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
  }

  return toShanghaiIso(trimmed);
}

function sortTweets(tweets: TweetItem[]) {
  return [...tweets].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function uniqueTags(tags?: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags ?? []) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function assertLang(value?: string): TweetLang | undefined {
  if (!value) return undefined;
  if (!TWEET_LANGS.includes(value as TweetLang)) {
    throw new StoreError(400, `Unsupported lang: ${value}`);
  }
  return value as TweetLang;
}

function assertVisibility(value?: string): TweetVisibility {
  const visibility = value ?? 'public';
  if (!TWEET_VISIBILITIES.includes(visibility as TweetVisibility)) {
    throw new StoreError(400, `Unsupported visibility: ${visibility}`);
  }
  return visibility as TweetVisibility;
}

function assertContent(value?: string) {
  const content = value?.trim() ?? '';
  if (!content) {
    throw new StoreError(400, 'Tweet content cannot be empty.');
  }
  return content;
}

function monthFromDate(value: string) {
  const { year, month } = getDateParts(value);
  return `${year}-${month}`;
}

function dayFromDate(value: string) {
  const { year, month, day } = getDateParts(value);
  return `${year}${month}${day}`;
}

function buildMonthPath(month: string) {
  return `tweets/${month}.json`;
}

function parseJson<T>(path: string, content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new StoreError(500, `Invalid JSON in ${path}`);
  }
}

function serializeJson(data: unknown) {
  return `${JSON.stringify(data, null, 4)}\n`;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const file = await getFile(filePath);
  if (!file) return fallback;
  return parseJson<T>(filePath, file.content);
}

async function writeJsonFile(filePath: string, data: unknown, message: string) {
  const file = await getFile(filePath);
  await putFile({
    path: filePath,
    content: serializeJson(data),
    message,
    sha: file?.sha,
  });
}

async function deleteJsonFile(filePath: string, message: string) {
  const file = await getFile(filePath);
  if (!file) return;
  await deleteFile({
    path: filePath,
    message,
    sha: file.sha,
  });
}

async function loadIndexMetaMap() {
  const items = await readJsonFile<TweetIndexItem[]>(INDEX_PATH, []);
  return new Map(items.map((item) => [item.month, item]));
}

async function loadMonthRecords(): Promise<TweetMonthRecord[]> {
  try {
    const indexMetaMap = await loadIndexMetaMap();
    const monthPathsFromTree = await listTweetMonthPaths();
    const monthPathsFromIndex = [...indexMetaMap.values()]
      .map((item) => item.path)
      .filter((path) => MONTH_FILE_PATTERN.test(path));
    const monthPaths = [...new Set([...monthPathsFromTree, ...monthPathsFromIndex])]
      .sort((a, b) => b.localeCompare(a));

    const months = await Promise.all(
      monthPaths.map(async (filePath) => {
        const month = filePath.replace(/^tweets\//, '').replace(/\.json$/, '');
        const tweets = await readJsonFile<TweetItem[]>(filePath, []);
        const meta = indexMetaMap.get(month);

        return {
          month,
          path: filePath,
          count: tweets.length,
          updatedAt:
            meta?.updatedAt ??
            sortTweets(tweets)
              .map((tweet) => tweet.updatedAt ?? tweet.createdAt)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
          tweets,
        } satisfies TweetMonthRecord;
      }),
    );

    return months;
  } catch (error) {
    throw toStoreError(error);
  }
}

async function saveMonthRecords(records: TweetMonthRecord[], message = 'chore: update tweets') {
  const safeMessage = sanitizeCommitMessage(message);
  try {
    const sortedRecords = [...records].sort((a, b) => b.month.localeCompare(a.month));
    const existingMonthPaths = await listTweetMonthPaths();
    const nextMonthPaths = new Set(sortedRecords.map((record) => buildMonthPath(record.month)));

    for (const filePath of existingMonthPaths) {
      if (!nextMonthPaths.has(filePath)) {
        await deleteJsonFile(filePath, safeMessage);
      }
    }

    for (const record of sortedRecords) {
      await writeJsonFile(buildMonthPath(record.month), record.tweets, safeMessage);
    }

    const index: TweetIndexItem[] = sortedRecords.map((record) => ({
      month: record.month,
      path: record.path,
      count: record.tweets.length,
      updatedAt: record.updatedAt,
    }));

    await writeJsonFile(INDEX_PATH, index, safeMessage);
  } catch (error) {
    throw toStoreError(error);
  }
}

function findTweet(records: TweetMonthRecord[], tweetId: string) {
  // Tweet ids are server-generated as `YYYYMMDD-NNN`. Validate the URL
  // segment before letting it touch comparison loops or commit messages —
  // a stray `/` or control char would otherwise propagate into GitHub.
  let validatedId: string;
  try {
    validatedId = validateTweetId(tweetId);
  } catch (error) {
    if (error instanceof InputValidationError) {
      throw new StoreError(error.status, 'Invalid tweet id.');
    }
    throw error;
  }

  for (const record of records) {
    const tweetIndex = record.tweets.findIndex((tweet) => tweet.id === validatedId);
    if (tweetIndex !== -1) {
      return { record, tweetIndex };
    }
  }

  throw new StoreError(404, 'Tweet not found.');
}

function buildTweet(
  input: CreateTweetInput,
  siblingTweets: TweetItem[],
  translations?: Partial<Record<string, TweetTranslation>>,
) {
  const createdAt = normalizeCreatedAtInput(input.createdAt);
  const dayKey = dayFromDate(createdAt);
  const sequence = siblingTweets
    .map((tweet) => {
      const match = new RegExp(`^${dayKey}-(\\d{3})$`).exec(tweet.id);
      return match ? Number(match[1]) : 0;
    })
    .reduce((maxValue, currentValue) => Math.max(maxValue, currentValue), 0) + 1;

  const id = `${dayKey}-${String(sequence).padStart(3, '0')}`;

  return {
    id,
    createdAt,
    updatedAt: createdAt,
    content: assertContent(input.content),
    lang: assertLang(input.lang),
    tags: uniqueTags(input.tags),
    visibility: assertVisibility(input.visibility),
    pinned: Boolean(input.pinned),
    translations,
  } satisfies TweetItem;
}

function getRepoSummary(): RepoSummary {
  const repo = getContentRepoInfo();
  return {
    name: `${repo.owner}/${repo.repo}`,
    branch: repo.branch,
    originUrl: repo.url,
    upstreamBranch: undefined,
    hasChanges: false,
    changedFilesCount: 0,
    hasRemote: true,
    aheadCount: 0,
    behindCount: 0,
  };
}

export function getRepoPaths() {
  const repo = getContentRepoInfo();
  return {
    tweetsDirPath: `github://${repo.owner}/${repo.repo}@${repo.branch}/tweets`,
  };
}

export async function getDashboardData(): Promise<TweetsDashboardData> {
  const records = await loadMonthRecords();
  return {
    repo: getRepoSummary(),
    ...getRepoPaths(),
    months: records.map((record) => ({
      ...record,
      tweets: sortTweets(record.tweets),
    })),
  };
}

export async function createTweet(input: CreateTweetInput) {
  const records = await loadMonthRecords();
  const sourceLang = assertLang(input.lang) ?? 'other';
  const draft = {
    content: assertContent(input.content),
    lang: sourceLang,
    tags: uniqueTags(input.tags),
    visibility: assertVisibility(input.visibility),
    pinned: Boolean(input.pinned),
    createdAt: normalizeCreatedAtInput(input.createdAt),
  };
  const targetMonth = monthFromDate(draft.createdAt);
  const targetRecord =
    records.find((record) => record.month === targetMonth) ??
    {
      month: targetMonth,
      path: `tweets/${targetMonth}.json`,
      count: 0,
      updatedAt: draft.createdAt,
      tweets: [],
    };

  const translations = input.autoTranslate
    ? await buildTweetTranslations({
        content: draft.content,
        sourceLang,
      })
    : undefined;
  const tweet = buildTweet(draft, targetRecord.tweets, translations);
  const writeAt = toShanghaiIso(new Date());
  targetRecord.tweets = [...targetRecord.tweets, tweet];
  targetRecord.count = targetRecord.tweets.length;
  targetRecord.updatedAt = writeAt;

  const nextRecords = records.some((record) => record.month === targetMonth)
    ? records.map((record) => (record.month === targetMonth ? targetRecord : record))
    : [...records, targetRecord];

  await saveMonthRecords(nextRecords, `chore: create tweet ${tweet.id}`);

  return { tweet, month: targetMonth };
}

export async function updateTweet(tweetId: string, input: UpdateTweetInput) {
  const records = await loadMonthRecords();
  const { record, tweetIndex } = findTweet(records, tweetId);
  const existingTweet = record.tweets[tweetIndex];
  const nextContent =
    input.content === undefined ? existingTweet.content : assertContent(input.content);
  const nextLang =
    input.lang === undefined ? existingTweet.lang : assertLang(input.lang);
  const contentChanged = nextContent !== existingTweet.content;
  const langChanged = nextLang !== existingTweet.lang;
  const nextTweet: TweetItem = {
    ...existingTweet,
    content: nextContent,
    lang: nextLang,
    tags: input.tags === undefined ? existingTweet.tags : uniqueTags(input.tags),
    visibility:
      input.visibility === undefined
        ? existingTweet.visibility
        : assertVisibility(input.visibility),
    pinned: input.pinned === undefined ? existingTweet.pinned : Boolean(input.pinned),
    translations:
      contentChanged || langChanged
        ? markTweetTranslationsStale(existingTweet.translations)
        : existingTweet.translations,
    updatedAt: toShanghaiIso(new Date()),
  };

  record.tweets = record.tweets.map((tweet, index) => (index === tweetIndex ? nextTweet : tweet));
  record.count = record.tweets.length;
  record.updatedAt = nextTweet.updatedAt;

  await saveMonthRecords(records, `chore: update tweet ${tweetId}`);

  return { tweet: nextTweet, month: record.month };
}

export async function retranslateTweet(tweetId: string) {
  const records = await loadMonthRecords();
  const { record, tweetIndex } = findTweet(records, tweetId);
  const existingTweet = record.tweets[tweetIndex];
  const sourceLang = existingTweet.lang ?? 'other';
  const translations = await buildTweetTranslations({
    content: existingTweet.content,
    sourceLang,
  });
  const updatedAt = toShanghaiIso(new Date());
  const nextTweet: TweetItem = {
    ...existingTweet,
    lang: sourceLang,
    translations,
    updatedAt,
  };

  record.tweets = record.tweets.map((tweet, index) => (index === tweetIndex ? nextTweet : tweet));
  record.count = record.tweets.length;
  record.updatedAt = updatedAt;

  await saveMonthRecords(records, `chore: retranslate tweet ${tweetId}`);

  return { tweet: nextTweet, month: record.month };
}

export async function deleteTweet(tweetId: string) {
  const records = await loadMonthRecords();
  const { record, tweetIndex } = findTweet(records, tweetId);
  const writeAt = toShanghaiIso(new Date());

  record.tweets = record.tweets.filter((_, index) => index !== tweetIndex);
  record.count = record.tweets.length;
  record.updatedAt = writeAt;

  const nextRecords = records.filter((monthRecord) => {
    if (monthRecord.month !== record.month) return true;
    return monthRecord.tweets.length > 0;
  });

  await saveMonthRecords(nextRecords, `chore: delete tweet ${tweetId}`);

  return { deletedId: tweetId, month: record.month };
}

export { StoreError };
