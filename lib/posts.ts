import matter from 'gray-matter';
import {
  getFile,
  listBlogVariantPaths,
  putFile,
  triggerPublicRevalidate,
} from './github';

export const BLOG_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ru', 'fr'] as const;

export type BlogLocale = (typeof BLOG_LOCALES)[number];
type AccessMode = 'public' | 'totp';

export type PublishInput = {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  pinned: boolean;
  accessMode: AccessMode;
  accessGroup?: string;
  content: string;
  originLocale?: BlogLocale;
};

export type BlogIndexVariant = {
  title: string;
  excerpt: string;
  originLocale?: BlogLocale;
};

export type BlogIndexItem = {
  slug: string;
  date: string;
  updatedAt: string;
  tags: string[];
  pinned: boolean;
  access: {
    mode: AccessMode;
    group?: string;
  };
  availableLocales: BlogLocale[];
  variants: Partial<Record<BlogLocale, BlogIndexVariant>>;
};

type BlogIndex = {
  version: number;
  updatedAt: string;
  posts: BlogIndexItem[];
};

type BlogVariantDocument = {
  path: string;
  locale: BlogLocale;
  sha?: string;
  content: string;
  data: {
    title?: string;
    excerpt?: string;
    date?: string;
    tags?: string[];
    pinned?: boolean;
    originLocale?: BlogLocale;
    updated?: string;
    updatedAt?: string;
    access?: { mode?: AccessMode; group?: string };
  };
};

function normalizeSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug must use lowercase letters, numbers, and hyphens only.');
  }
  return slug;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Date must use YYYY-MM-DD.');
  }
  return trimmed;
}

function normalizeLocale(value: string): BlogLocale {
  if ((BLOG_LOCALES as readonly string[]).includes(value)) {
    return value as BlogLocale;
  }
  throw new Error(`Unsupported locale: ${value}`);
}

function normalizeTags(rawTags: string[]) {
  return [...new Set(rawTags.map((tag) => tag.trim()).filter(Boolean))];
}

function buildVariantPath(slug: string, locale: BlogLocale) {
  return `blog/${slug}/${locale}.mdx`;
}

function buildAccess(accessMode: AccessMode, accessGroup?: string) {
  if (accessMode === 'totp') {
    const group = accessGroup?.trim();
    if (!group) {
      throw new Error('Protected posts require an access group.');
    }
    return { mode: 'totp' as const, group };
  }

  return { mode: 'public' as const };
}

function buildMarkdown(input: {
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  pinned: boolean;
  originLocale?: BlogLocale;
  access: { mode: AccessMode; group?: string };
  updated: string;
  content: string;
}) {
  return matter.stringify(input.content.trim() + '\n', {
    title: input.title.trim(),
    date: input.date,
    excerpt: input.excerpt.trim(),
    tags: input.tags,
    pinned: input.pinned,
    ...(input.originLocale ? { originLocale: input.originLocale } : {}),
    updated: input.updated,
    access:
      input.access.mode === 'totp'
        ? { mode: 'totp', group: input.access.group || '' }
        : { mode: 'public' },
  });
}

async function readBlogVariant(path: string): Promise<BlogVariantDocument> {
  const file = await getFile(path);
  if (!file) {
    throw new Error(`Missing blog variant file: ${path}`);
  }

  const locale = normalizeLocale(path.split('/').pop()?.replace(/\.mdx$/, '') || '');
  const parsed = matter(file.content);

  return {
    path,
    locale,
    sha: file.sha,
    content: parsed.content,
    data: parsed.data as BlogVariantDocument['data'],
  };
}

async function readExistingVariants(slug: string) {
  const paths = await listBlogVariantPaths();
  const variantPaths = paths.filter((path) => path.startsWith(`blog/${slug}/`));
  return Promise.all(variantPaths.map((path) => readBlogVariant(path)));
}

function toIndexItem(slug: string, docs: BlogVariantDocument[]): BlogIndexItem {
  const preferredDoc =
    docs.find((doc) => doc.locale === 'zh-CN') ??
    docs.find((doc) => doc.locale === 'en') ??
    docs[0];

  if (!preferredDoc) {
    throw new Error(`No variants found for slug: ${slug}`);
  }

  const date = normalizeDate(
    typeof preferredDoc.data.date === 'string'
      ? preferredDoc.data.date
      : new Date().toISOString().slice(0, 10),
  );
  const updatedAt =
    typeof preferredDoc.data.updated === 'string' && preferredDoc.data.updated.trim()
      ? preferredDoc.data.updated.trim()
      : typeof preferredDoc.data.updatedAt === 'string' && preferredDoc.data.updatedAt.trim()
        ? preferredDoc.data.updatedAt.trim()
        : new Date(`${date}T00:00:00.000Z`).toISOString();

  const tags = normalizeTags(Array.isArray(preferredDoc.data.tags) ? preferredDoc.data.tags : []);
  const pinned = Boolean(preferredDoc.data.pinned);
  const access =
    preferredDoc.data.access?.mode === 'totp'
      ? {
          mode: 'totp' as const,
          group: preferredDoc.data.access.group?.trim() || undefined,
        }
      : { mode: 'public' as const };

  const variants = docs.reduce<Partial<Record<BlogLocale, BlogIndexVariant>>>((acc, doc) => {
    acc[doc.locale] = {
      title: typeof doc.data.title === 'string' && doc.data.title.trim() ? doc.data.title.trim() : slug,
      excerpt:
        typeof doc.data.excerpt === 'string' && doc.data.excerpt.trim()
          ? doc.data.excerpt.trim()
          : '',
      ...(doc.data.originLocale ? { originLocale: doc.data.originLocale } : {}),
    };
    return acc;
  }, {});

  const availableLocales = docs.map((doc) => doc.locale).sort(
    (left, right) => BLOG_LOCALES.indexOf(left) - BLOG_LOCALES.indexOf(right),
  );

  return {
    slug,
    date,
    updatedAt,
    tags,
    pinned,
    access,
    availableLocales,
    variants,
  };
}

export async function rebuildBlogIndex(slug?: string) {
  const paths = await listBlogVariantPaths();
  const grouped = new Map<string, string[]>();

  for (const path of paths) {
    const [, slug] = path.split('/');
    if (!slug) continue;
    const current = grouped.get(slug) ?? [];
    current.push(path);
    grouped.set(slug, current);
  }

  const entries = await Promise.all(
    [...grouped.entries()].map(async ([slug, variantPaths]) => {
      const docs = await Promise.all(variantPaths.map((path) => readBlogVariant(path)));
      return toIndexItem(slug, docs);
    }),
  );

  entries.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const index: BlogIndex = {
    version: 1,
    updatedAt: new Date().toISOString(),
    posts: entries,
  };

  const existing = await getFile('blog-index.json');
  await putFile({
    path: 'blog-index.json',
    content: `${JSON.stringify(index, null, 2)}\n`,
    message: 'Rebuild blog index',
    sha: existing?.sha,
  });

  const revalidated = await triggerPublicRevalidate(slug);
  return { index, revalidated };
}

export async function getBlogIndex() {
  const indexFile = await getFile('blog-index.json');
  if (!indexFile?.content.trim()) {
    return { version: 1, updatedAt: new Date(0).toISOString(), posts: [] } satisfies BlogIndex;
  }

  try {
    return JSON.parse(indexFile.content) as BlogIndex;
  } catch {
    throw new Error('Invalid blog-index.json');
  }
}

export async function getBlogVariant(slug: string, locale: string) {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedLocale = normalizeLocale(locale);
  const path = buildVariantPath(normalizedSlug, normalizedLocale);
  const file = await getFile(path);

  if (!file) {
    return null;
  }

  const parsed = matter(file.content);
  const data = parsed.data as BlogVariantDocument['data'];

  return {
    slug: normalizedSlug,
    locale: normalizedLocale,
    title: typeof data.title === 'string' ? data.title : '',
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    date: typeof data.date === 'string' ? data.date : '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    pinned: Boolean(data.pinned),
    accessMode: data.access?.mode === 'totp' ? 'totp' : 'public',
    accessGroup: data.access?.group?.trim() || '',
    originLocale: data.originLocale || '',
    content: parsed.content,
  };
}

export async function publishPost(input: PublishInput) {
  const slug = normalizeSlug(input.slug);
  const locale = normalizeLocale(input.locale);
  const date = normalizeDate(input.date);
  const tags = normalizeTags(input.tags);
  const access = buildAccess(input.accessMode, input.accessGroup);
  const originLocale =
    input.originLocale && input.originLocale !== locale
      ? normalizeLocale(input.originLocale)
      : undefined;
  const timestamp = new Date().toISOString();
  const currentPath = buildVariantPath(slug, locale);
  const existingVariants = await readExistingVariants(slug);

  const currentExisting = existingVariants.find((variant) => variant.locale === locale);

  const rewrittenExisting = existingVariants.filter((variant) => variant.locale !== locale);

  await Promise.all(
    rewrittenExisting.map((variant) =>
      putFile({
        path: variant.path,
        sha: variant.sha,
        message: `Sync blog metadata: ${slug}`,
        content: buildMarkdown({
          title:
            typeof variant.data.title === 'string' && variant.data.title.trim()
              ? variant.data.title
              : slug,
          excerpt:
            typeof variant.data.excerpt === 'string' && variant.data.excerpt.trim()
              ? variant.data.excerpt
              : '',
          date,
          tags: Array.isArray(variant.data.tags) ? normalizeTags(variant.data.tags) : [],
          pinned: input.pinned,
          originLocale: variant.data.originLocale,
          access,
          updated: timestamp,
          content: variant.content,
        }),
      }),
    ),
  );

  const result = await putFile({
    path: currentPath,
    sha: currentExisting?.sha,
    message: `${currentExisting?.sha ? 'Update' : 'Create'} blog variant: ${slug}/${locale}`,
    content: buildMarkdown({
      title: input.title,
      excerpt: input.excerpt,
      date,
      tags,
      pinned: input.pinned,
      originLocale,
      access,
      updated: timestamp,
      content: input.content,
    }),
  });

  const rebuilt = await rebuildBlogIndex(slug);

  return {
    path: currentPath,
    commit: result,
    revalidated: rebuilt.revalidated,
  };
}
