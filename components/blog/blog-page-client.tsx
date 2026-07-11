'use client';

import { useEffect, useSyncExternalStore, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import BlogArchivePanel, { type BlogIndexItem } from './blog-archive-panel';
import BlogEditorPanel, { INITIAL_BLOG_FORM, type BlogFormState } from './blog-editor-panel';
import BlogPreviewPanel from './blog-preview-panel';
import BlogWritingPanel from './blog-writing-panel';
import { BLOG_LOCALES, type BlogLocale } from './blog-locale-labels';

type BlogPageClientProps = {
  csrfToken: string;
};

type PublishResponse = {
  path: string;
  revalidated?: { paths: string[] };
};

type BatchPublishResponse = {
  paths: string[];
  revalidated?: { paths: string[] };
};

type BlogTranslateResponse = {
  variants: Array<{
    locale: Extract<BlogLocale, 'zh-TW' | 'en'>;
    title: string;
    excerpt: string;
    tags: string[];
    content: string;
    originLocale: string;
  }>;
};

type AdminResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

type BlogDraft = BlogFormState & {
  savedAt: number;
};

const DRAFT_STORAGE_KEY = 'arsvine-admin.blog-drafts.v1';
const DRAFTS_UPDATED_EVENT = 'arsvine-admin:blog-drafts-updated';
const EMPTY_DRAFTS: Record<string, BlogDraft> = {};
let cachedDraftsRaw: string | null | undefined;
let cachedDraftsSnapshot: Record<string, BlogDraft> = EMPTY_DRAFTS;

function unwrapError(json: AdminResponse<unknown>, fallback: string) {
  return json.ok ? fallback : json.error.message;
}

function getDraftKey(slug: string, locale: BlogLocale) {
  return `${slug.trim().toLowerCase()}:${locale}`;
}

function hasMeaningfulFormContent(form: BlogFormState) {
  return Boolean(
    form.slug.trim() ||
      form.title.trim() ||
      form.excerpt.trim() ||
      form.tags.trim() ||
      form.content.trim(),
  );
}

function buildEmptyVariantForm(source: BlogFormState, locale: BlogLocale): BlogFormState {
  return {
    ...source,
    locale,
    title: '',
    excerpt: '',
    tags: '',
    originLocale: '',
    content: '',
  };
}

function readDraftsSnapshot(): Record<string, BlogDraft> {
  if (typeof window === 'undefined') {
    return EMPTY_DRAFTS;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw === cachedDraftsRaw) {
      return cachedDraftsSnapshot;
    }

    cachedDraftsRaw = raw;
    cachedDraftsSnapshot = raw
      ? (JSON.parse(raw) as Record<string, BlogDraft>)
      : EMPTY_DRAFTS;
    return cachedDraftsSnapshot;
  } catch {
    cachedDraftsRaw = null;
    cachedDraftsSnapshot = EMPTY_DRAFTS;
    return EMPTY_DRAFTS;
  }
}

function subscribeDrafts(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== DRAFT_STORAGE_KEY) return;
    onStoreChange();
  };
  const handleLocalUpdate = () => onStoreChange();

  window.addEventListener('storage', handleStorage);
  window.addEventListener(DRAFTS_UPDATED_EVENT, handleLocalUpdate);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(DRAFTS_UPDATED_EVENT, handleLocalUpdate);
  };
}

export default function BlogPageClient({ csrfToken }: BlogPageClientProps) {
  const [form, setForm] = useState<BlogFormState>(INITIAL_BLOG_FORM);
  const [items, setItems] = useState<BlogIndexItem[]>([]);
  const [panelMode, setPanelMode] = useState<'edit' | 'preview'>('edit');
  const drafts = useSyncExternalStore<Record<string, BlogDraft>>(
    subscribeDrafts,
    readDraftsSnapshot,
    () => EMPTY_DRAFTS,
  );
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadIndex(controller.signal);
    return () => controller.abort();
  }, []);

  function persistDrafts(nextDrafts: Record<string, BlogDraft>) {
    const serialized = JSON.stringify(nextDrafts);
    cachedDraftsRaw = serialized;
    cachedDraftsSnapshot = nextDrafts;
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(DRAFTS_UPDATED_EVENT));
  }

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

  function getDraftCountForSlug(slug: string) {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) return 0;
    return Object.values(drafts).filter((draft) => draft.slug.trim().toLowerCase() === normalizedSlug).length;
  }

  const draftCount = getDraftCountForSlug(form.slug);
  const normalizedCurrentSlug = form.slug.trim().toLowerCase();
  const publishedLocalesForSlug =
    items.find((item) => item.slug === normalizedCurrentSlug)?.availableLocales ?? [];
  const draftLocalesForSlug = Object.values(drafts)
    .filter((draft) => draft.slug.trim().toLowerCase() === normalizedCurrentSlug)
    .map((draft) => draft.locale);
  const localeStates = BLOG_LOCALES.map((locale) => ({
    locale,
    hasDraft: draftLocalesForSlug.includes(locale),
    isPublished: publishedLocalesForSlug.includes(locale),
  }));

  function saveDraft(currentForm: BlogFormState, options?: { silent?: boolean }) {
    const normalizedSlug = currentForm.slug.trim().toLowerCase();
    if (!normalizedSlug) {
      if (!options?.silent) {
        toast.error('请先填写 slug，再暂存草稿。');
      }
      return false;
    }

    const nextDraft: BlogDraft = {
      ...currentForm,
      slug: normalizedSlug,
      savedAt: Date.now(),
    };

    const nextDrafts = { ...drafts };
    for (const [key, draft] of Object.entries(nextDrafts)) {
      if (draft.slug.trim().toLowerCase() !== normalizedSlug) continue;
      nextDrafts[key] = {
        ...draft,
        slug: normalizedSlug,
        date: currentForm.date,
        pinned: currentForm.pinned,
        accessMode: currentForm.accessMode,
        accessGroup: currentForm.accessGroup,
      };
    }

    nextDrafts[getDraftKey(normalizedSlug, currentForm.locale)] = nextDraft;
    persistDrafts(nextDrafts);

    if (!options?.silent) {
      toast.success(`已暂存 ${normalizedSlug}/${currentForm.locale} 草稿。`);
    }
    return true;
  }

  function clearDraftsForSlug(slug: string, locales?: BlogLocale[]) {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) return;

    const nextDrafts = { ...drafts };
    for (const [key, draft] of Object.entries(nextDrafts)) {
      if (draft.slug.trim().toLowerCase() !== normalizedSlug) continue;
      if (locales && !locales.includes(draft.locale)) continue;
      delete nextDrafts[key];
    }
    persistDrafts(nextDrafts);
  }

  async function loadVariant(slug: string, locale: BlogLocale) {
    const normalizedSlug = slug.trim().toLowerCase();
    const draftKey = getDraftKey(normalizedSlug, locale);
    const localDraft = drafts[draftKey];

    try {
      const response = await fetch(
        `/api/admin/blog-variant?slug=${encodeURIComponent(normalizedSlug)}&locale=${encodeURIComponent(locale)}`,
        { cache: 'no-store' },
      );
      if (response.status === 404) {
        const fallback = localDraft ?? buildEmptyVariantForm({ ...form, slug: normalizedSlug }, locale);
        setSelectedKey(`${normalizedSlug}:${locale}`);
        setForm(fallback);
        return;
      }
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
      const remoteForm: BlogFormState = {
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
      };
      setForm(localDraft ?? remoteForm);
      if (localDraft) {
        toast.success(`已加载本地草稿：${normalizedSlug}/${locale}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load variant.');
    }
  }

  async function handleLocaleSelect(locale: BlogLocale) {
    if (locale === form.locale) return;

    if (hasMeaningfulFormContent(form) && form.slug.trim()) {
      saveDraft(form, { silent: true });
    }

    if (!form.slug.trim()) {
      setForm((current) => ({ ...current, locale }));
      return;
    }

    await loadVariant(form.slug, locale);
  }

  async function handleSelectArchiveItem(item: BlogIndexItem, locale: BlogLocale) {
    if (hasMeaningfulFormContent(form) && form.slug.trim()) {
      saveDraft(form, { silent: true });
    }
    await loadVariant(item.slug, locale);
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const normalizedSlug = form.slug.trim().toLowerCase();
      const response = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: normalizedSlug,
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
      clearDraftsForSlug(normalizedSlug, [form.locale]);
      await loadIndex();
      setSelectedKey(`${normalizedSlug}:${form.locale}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveDraft() {
    setSavingDraft(true);
    try {
      saveDraft(form);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublishAllDrafts() {
    const normalizedSlug = form.slug.trim().toLowerCase();
    if (!normalizedSlug) {
      toast.error('请先填写 slug。');
      return;
    }

    const saved = saveDraft({ ...form, slug: normalizedSlug }, { silent: true });
    if (!saved) return;

    const slugDrafts = Object.values({
      ...drafts,
      [getDraftKey(normalizedSlug, form.locale)]: {
        ...form,
        slug: normalizedSlug,
        savedAt: Date.now(),
      },
    })
      .filter((draft) => draft.slug.trim().toLowerCase() === normalizedSlug)
      .sort((left, right) => left.savedAt - right.savedAt);

    if (slugDrafts.length === 0) {
      toast.error('当前文章没有可发布的草稿。');
      return;
    }

    setBatchPublishing(true);
    try {
      const response = await fetch('/api/admin/publish-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          slug: normalizedSlug,
          date: form.date,
          pinned: form.pinned,
          accessMode: form.accessMode,
          accessGroup: form.accessGroup,
          variants: slugDrafts.map((draft) => ({
            locale: draft.locale,
            title: draft.title,
            excerpt: draft.excerpt,
            tags: draft.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            content: draft.content,
            originLocale: draft.originLocale || undefined,
          })),
        }),
      });
      const json = (await response.json()) as AdminResponse<BatchPublishResponse>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Batch publish failed.'));
      }
      clearDraftsForSlug(
        normalizedSlug,
        slugDrafts.map((draft) => draft.locale),
      );
      toast.success(
        `已批量发布 ${slugDrafts.length} 个语言变体，刷新路径：${json.data.revalidated?.paths.join(', ') || '无'}`,
      );
      await loadIndex();
      setSelectedKey(`${normalizedSlug}:${form.locale}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch publish failed.');
    } finally {
      setBatchPublishing(false);
    }
  }

  async function handleTranslate() {
    if (form.locale !== 'zh-CN') {
      toast.error('博客自动翻译当前只支持从 zh-CN 生成。');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('请先填写 slug。');
      return;
    }
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      toast.error('请先完善当前 zh-CN 的标题、摘要和正文。');
      return;
    }

    const normalizedSlug = form.slug.trim().toLowerCase();
    saveDraft({ ...form, slug: normalizedSlug }, { silent: true });

    setTranslating(true);
    try {
      const response = await fetch('/api/admin/blog-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          sourceLocale: 'zh-CN',
          title: form.title,
          excerpt: form.excerpt,
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          content: form.content,
          targetLocales: ['zh-TW', 'en'],
        }),
      });
      const json = (await response.json()) as AdminResponse<BlogTranslateResponse>;
      if (!response.ok || !json.ok) {
        throw new Error(unwrapError(json, 'Blog translation failed.'));
      }

      const nextDrafts = { ...drafts };
      nextDrafts[getDraftKey(normalizedSlug, form.locale)] = {
        ...form,
        slug: normalizedSlug,
        savedAt: Date.now(),
      };

      for (const variant of json.data.variants) {
        nextDrafts[getDraftKey(normalizedSlug, variant.locale)] = {
          slug: normalizedSlug,
          locale: variant.locale,
          title: variant.title,
          excerpt: variant.excerpt,
          date: form.date,
          tags: variant.tags.join(', '),
          pinned: form.pinned,
          accessMode: form.accessMode,
          accessGroup: form.accessGroup,
          originLocale: variant.originLocale,
          content: variant.content,
          savedAt: Date.now(),
        };
      }

      persistDrafts(nextDrafts);
      toast.success(`已生成 ${json.data.variants.map((item) => item.locale).join(' / ')} 草稿。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Blog translation failed.');
    } finally {
      setTranslating(false);
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
    <div className="min-h-[calc(100svh-3.5rem)] p-5 lg:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4"><div><p className="text-sm text-muted-foreground">Blog / {form.slug || '新文章'}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">专注编辑</h1></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant={panelMode === 'edit' ? 'secondary' : 'outline'} onClick={() => setPanelMode('edit')}>写作</Button><Button type="button" size="sm" variant={panelMode === 'preview' ? 'secondary' : 'outline'} onClick={() => setPanelMode('preview')}>预览</Button></div></div>
      <div className="grid min-h-[calc(100svh-11rem)] grid-cols-1 gap-5 xl:grid-cols-[16rem_20rem_minmax(0,1fr)]">
      <aside className="min-h-0 xl:border-r xl:pr-5">
        <BlogArchivePanel
          loading={loadingIndex}
          items={items}
          selectedKey={selectedKey}
          onSelect={(item, locale) => void handleSelectArchiveItem(item, locale)}
          onCreate={resetForm}
        />
      </aside>
      <section className="min-h-0">
        <BlogEditorPanel
          form={form}
          localeStates={localeStates}
          onChange={updateField}
          publishing={publishing}
          batchPublishing={batchPublishing}
          translating={translating}
          savingDraft={savingDraft}
          rebuilding={rebuilding}
          draftCount={draftCount}
          onTranslate={() => void handleTranslate()}
          onSaveDraft={() => void handleSaveDraft()}
          onPublishAllDrafts={() => void handlePublishAllDrafts()}
          onSelectLocale={(locale) => void handleLocaleSelect(locale)}
          onPublish={() => void handlePublish()}
          onRebuild={() => void handleRebuild()}
        />
      </section>
      <section className="min-h-0">
        <div className="h-full min-h-[42rem]">
          {panelMode === 'edit' ? (
            <BlogWritingPanel form={form} onChange={updateField} />
          ) : (
            <BlogPreviewPanel content={form.content} />
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
