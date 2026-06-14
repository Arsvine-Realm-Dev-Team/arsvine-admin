import matter from 'gray-matter';
import {
  getFile,
  listPostMarkdownPaths,
  putFile,
  triggerPublicRevalidate,
} from './github';

type AccessMode = 'public' | 'totp';

export type PublishInput = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  content: string;
  accessMode: AccessMode;
  accessGroup?: string;
};

type IndexItem = {
  slug: string;
  title: string;
  path: string;
  summary: string;
  date: string;
  updatedAt: string;
  access: {
    mode: AccessMode;
    group?: string;
  };
};

type PostsIndex = {
  version: number;
  updatedAt: string;
  posts: IndexItem[];
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

function buildPostPath(slug: string, date: string) {
  const year = date.slice(0, 4);
  return `posts/${year}/${slug}.md`;
}

function buildMarkdown(input: PublishInput) {
  const timestamp = new Date().toISOString();
  return matter.stringify(input.content, {
    title: input.title.trim(),
    summary: input.summary.trim(),
    date: normalizeDate(input.date),
    updatedAt: timestamp,
    access:
      input.accessMode === 'totp'
        ? { mode: 'totp', group: input.accessGroup?.trim() || '' }
        : { mode: 'public' },
  });
}

function toIndexItem(path: string, file: string): IndexItem {
  const parsed = matter(file);
  const data = parsed.data as {
    title?: string;
    summary?: string;
    date?: string;
    updatedAt?: string;
    access?: { mode?: AccessMode; group?: string };
  };
  const slug = path.split('/').pop()?.replace(/\.md$/, '') || 'untitled';
  const date = normalizeDate(typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10));

  return {
    slug,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : slug,
    path,
    summary: typeof data.summary === 'string' ? data.summary.trim() : '',
    date,
    updatedAt:
      typeof data.updatedAt === 'string' && data.updatedAt.trim()
        ? data.updatedAt
        : new Date(`${date}T00:00:00.000Z`).toISOString(),
    access:
      data.access?.mode === 'totp'
        ? { mode: 'totp', group: data.access.group?.trim() || undefined }
        : { mode: 'public' },
  };
}

export async function rebuildPostsIndex() {
  const paths = await listPostMarkdownPaths();
  const entries = await Promise.all(
    paths.map(async (path) => {
      const file = await getFile(path);
      if (!file) {
        throw new Error(`Missing post file while rebuilding index: ${path}`);
      }
      return toIndexItem(path, file.content);
    }),
  );

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const index: PostsIndex = {
    version: 1,
    updatedAt: new Date().toISOString(),
    posts: entries,
  };

  const existing = await getFile('posts-index.json');
  await putFile({
    path: 'posts-index.json',
    content: `${JSON.stringify(index, null, 2)}\n`,
    message: 'Rebuild posts index',
    sha: existing?.sha,
  });

  const revalidated = await triggerPublicRevalidate();
  return { index, revalidated };
}

export async function publishPost(input: PublishInput) {
  const slug = normalizeSlug(input.slug);
  const date = normalizeDate(input.date);
  const accessMode = input.accessMode;
  if (accessMode === 'totp' && !input.accessGroup?.trim()) {
    throw new Error('Protected posts require an access group.');
  }

  const path = buildPostPath(slug, date);
  const existing = await getFile(path);
  const markdown = buildMarkdown({
    ...input,
    slug,
    date,
  });

  const result = await putFile({
    path,
    content: markdown,
    message: `${existing ? 'Update' : 'Create'} post: ${slug}`,
    sha: existing?.sha,
  });

  const rebuilt = await rebuildPostsIndex();
  return {
    path,
    commit: result,
    revalidated: rebuilt.revalidated,
  };
}
