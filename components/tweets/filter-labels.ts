import {
  TWEET_FILTERS,
  TWEET_LANGS,
  TWEET_VISIBILITIES,
  type TweetFilter,
  type TweetVisibility,
} from '../../lib/tweets-types';

export const FILTER_LABELS: Record<TweetFilter, string> = {
  all: '全部',
  public: '公开',
  private: '保护',
  hidden: '隐藏',
  pinned: '置顶',
};

export const VISIBILITY_LABELS: Record<TweetVisibility, string> = {
  public: '公开',
  private: '保护',
  hidden: '隐藏',
};

export const LANG_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  en: '英文',
  ja: '日文',
  other: '其他',
};

export { TWEET_LANGS, TWEET_VISIBILITIES, TWEET_FILTERS };
