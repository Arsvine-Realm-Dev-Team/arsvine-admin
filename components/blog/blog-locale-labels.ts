export const BLOG_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ru', 'fr'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

export const localeLabels: Record<BlogLocale, string> = {
  'zh-CN': '简中',
  'zh-TW': '繁中',
  en: 'English',
  ja: '日本語',
  ru: 'Русский',
  fr: 'Français',
};
