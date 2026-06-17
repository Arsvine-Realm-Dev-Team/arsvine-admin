'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import BlogArchivePanel, { type BlogIndexItem } from './blog-archive-panel';
import BlogEditorPanel, { INITIAL_BLOG_FORM, type BlogFormState } from './blog-editor-panel';
import BlogPreviewPanel from './blog-preview-panel';
import type { BlogLocale } from './blog-locale-labels';

type BlogPageClientProps = {
  csrfToken: string;
};

type PublishResponse = {
  path: string;
  revalidated?: { paths: string[] };
};

type AdminResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

function unwrapError(json: AdminResponse<unknown>, fallback: string) {
  return json.ok ? fallback : json.error.message;
}

export default function BlogPageClient({ csrfToken }: BlogPageClientProps) {
  const [form, setForm] = useState<BlogFormState>(INITIAL_BLOG_FORM);
  const [items, setItems] = useState<BlogIndexItem[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadIndex(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadIndex(signal?: AbortSignal) {
    setLoadingIndex(true);
    try {
      const response = await fetch('/api/admin/blog-index', { cache: 'no-store', signal });
      const json = (await response.json()) as AdminResponse<{ posts: BlogIndexItem[] }>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Failed to load blog index.'));
      }
      setItems(json.data.posts);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : 'Failed to load blog index.');
    } finally {
      setLoadingIndex(false);
    }
  }

  function updateField<K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setSelectedKey('');
    setForm(INITIAL_BLOG_FORM);
  }

  async function loadVariant(slug: string, locale: BlogLocale) {
    try {
      const response = await fetch(
        `/api/admin/blog-variant?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`,
        { cache: 'no-store' },
      );
      const json = (await response.json()) as AdminResponse<{
        slug: string;
        locale: BlogLocale;
        title: string;
        excerpt: string;
        date: string;
        tags: string[];
        pinned: boolean;
        accessMode: 'public' | 'totp';
        accessGroup: string;
        originLocale: string;
        content: string;
      }>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Failed to load variant.'));
      }
      const data = json.data;
      setSelectedKey(`${data.slug}:${data.locale}`);
      setForm({
        slug: data.slug,
        locale: data.locale,
        title: data.title,
        excerpt: data.excerpt,
        date: data.date,
        tags: data.tags.join(', '),
        pinned: data.pinned,
        accessMode: data.accessMode,
        accessGroup: data.accessGroup,
        originLocale: data.originLocale,
        content: data.content,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load variant.');
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const response = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: form.slug,
          locale: form.locale,
          title: form.title,
          excerpt: form.excerpt,
          date: form.date,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          pinned: form.pinned,
          accessMode: form.accessMode,
          accessGroup: form.accessGroup,
          originLocale: form.originLocale || undefined,
          content: form.content,
        }),
      });
      const json = (await response.json()) as AdminResponse<PublishResponse>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Publish failed.'));
      }
      toast.success(
        `已发布到 ${json.data.path}，刷新路径：${json.data.revalidated?.paths.join(', ') || '无'}`,
      );
      await loadIndex();
      setSelectedKey(`${form.slug}:${form.locale}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const response = await fetch('/api/admin/rebuild-index', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      });
      const json = (await response.json()) as AdminResponse<{ revalidated: { paths: string[] } }>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Rebuild failed.'));
      }
      toast.success(`索引已重建，刷新路径：${json.data.revalidated.paths.join(', ')}`);
      await loadIndex();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rebuild failed.');
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-h-0">
        <BlogArchivePanel
          loading={loadingIndex}
          items={items}
          selectedKey={selectedKey}
          onSelect={(item, locale) => void loadVariant(item.slug, locale)}
          onCreate={resetForm}
        />
      </div>
      <div className="min-h-0">
        <BlogEditorPanel
          form={form}
          onChange={updateField}
          publishing={publishing}
          rebuilding={rebuilding}
          onPublish={() => void handlePublish()}
          onRebuild={() => void handleRebuild()}
        />
      </div>
      <div className="min-h-0">
        <BlogPreviewPanel content={form.content} />
      </div>
    </div>
  );
}
