import {
  getTranslationTargetLocales,
  type SiteTweetLocale,
  type TweetItem,
  type TweetMonthRecord,
} from '../../lib/tweets-types';

export type DateGranularity = 'year' | 'month' | 'day';

export type TweetDateGroup = {
  key: string;
  label: string;
  count: number;
  updatedAt?: string;
  months: string[];
  tweets: TweetItem[];
};

export function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00+08:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

export function formatDateGroupLabel(key: string, granularity: DateGranularity) {
  if (granularity === 'year') {
    const date = new Date(`${key}-01-01T00:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).format(date);
  }

  if (granularity === 'day') {
    const date = new Date(`${key}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).format(date);
  }

  return formatMonthLabel(key);
}

export function formatTimestamp(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function tagsToInput(tags?: string[]) {
  return (tags ?? []).join(', ');
}

export function parseTags(rawValue: string) {
  return rawValue
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function monthFromCreatedAt(value: string) {
  if (!value) return '';
  return value.slice(0, 7);
}

function dateGroupKeyFromCreatedAt(value: string, granularity: DateGranularity) {
  if (!value) return '';
  if (granularity === 'year') return value.slice(0, 4);
  if (granularity === 'day') return value.slice(0, 10);
  return value.slice(0, 7);
}

export function groupTweetsByGranularity(
  months: TweetMonthRecord[],
  granularity: DateGranularity,
): TweetDateGroup[] {
  const grouped = new Map<string, TweetDateGroup>();

  for (const monthRecord of months) {
    for (const tweet of monthRecord.tweets) {
      const key = dateGroupKeyFromCreatedAt(tweet.createdAt, granularity);
      if (!key) continue;

      const current = grouped.get(key) ?? {
        key,
        label: formatDateGroupLabel(key, granularity),
        count: 0,
        updatedAt: monthRecord.updatedAt,
        months: [],
        tweets: [],
      };

      current.count += 1;
      current.tweets.push(tweet);
      if (!current.months.includes(monthRecord.month)) {
        current.months.push(monthRecord.month);
      }

      const nextUpdatedAt = tweet.updatedAt ?? tweet.createdAt ?? monthRecord.updatedAt;
      if (
        nextUpdatedAt &&
        (!current.updatedAt || new Date(nextUpdatedAt).getTime() > new Date(current.updatedAt).getTime())
      ) {
        current.updatedAt = nextUpdatedAt;
      }

      grouped.set(key, current);
    }
  }

  return [...grouped.values()].sort((left, right) => right.key.localeCompare(left.key));
}

export function filterTweets(tweets: TweetItem[], filter: 'all' | 'public' | 'private' | 'hidden' | 'pinned') {
  if (filter === 'all') return tweets;
  if (filter === 'pinned') return tweets.filter((tweet) => tweet.pinned);
  return tweets.filter((tweet) => (tweet.visibility ?? 'public') === filter);
}

export function getTranslationSummary(tweet: TweetItem) {
  return getTranslationTargetLocales(tweet.lang ?? 'other').map((locale) => {
    const translation = tweet.translations?.[locale];
    return {
      locale,
      state: !translation ? ('missing' as const) : translation.stale ? ('stale' as const) : ('fresh' as const),
    };
  });
}

export function formatTranslationSummaryItem(
  locale: SiteTweetLocale,
  state: 'fresh' | 'stale' | 'missing',
) {
  if (state === 'fresh') return `${locale} 已生成`;
  if (state === 'stale') return `${locale} 已过期`;
  return `${locale} 未生成`;
}

export function pickActiveMonth(
  months: TweetMonthRecord[],
  preferredMonth: string | null,
): string {
  if (preferredMonth && months.some((month) => month.month === preferredMonth)) {
    return preferredMonth;
  }
  return months[0]?.month ?? '';
}

export function pickActiveDateGroup<T extends { key: string }>(
  groups: T[],
  preferredKey: string | null,
) {
  if (preferredKey && groups.some((group) => group.key === preferredKey)) {
    return preferredKey;
  }
  return groups[0]?.key ?? '';
}
