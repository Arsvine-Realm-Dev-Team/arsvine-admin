import {
  getTranslationTargetLocales,
  type SiteTweetLocale,
  type TweetItem,
  type TweetMonthRecord,
} from '../../lib/tweets-types';

export function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00+08:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(date);
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
