'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const BLOG_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ru', 'fr'] as const;
type BlogLocale = (typeof BLOG_LOCALES)[number];
type AccessMode = 'public' | 'totp';

type AdminShellProps = {
  csrfToken: string;
  sessionExpiresAt: number;
};

type PublishResponse = {
  path: string;
  revalidated?: {
    paths: string[];
  };
};

type BlogIndexItem = {
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
  variants: Partial<Record<BlogLocale, { title: string; excerpt: string; originLocale?: BlogLocale }>>;
};

type BlogVariantPayload = {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  pinned: boolean;
  accessMode: AccessMode;
  accessGroup: string;
  originLocale: string;
  content: string;
};

const INITIAL_FORM = {
  slug: '',
  locale: 'zh-CN' as BlogLocale,
  title: '',
  excerpt: '',
  date: new Date().toISOString().slice(0, 10),
  tags: '',
  pinned: false,
  accessMode: 'public' as AccessMode,
  accessGroup: '',
  originLocale: '',
  content: '',
};

const localeLabels: Record<BlogLocale, string> = {
  'zh-CN': '简中',
  'zh-TW': '繁中',
  en: 'English',
  ja: '日本語',
  ru: 'Русский',
  fr: 'Français',
};

export default function AdminShell({ csrfToken, sessionExpiresAt }: AdminShellProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [blogItems, setBlogItems] = useState<BlogIndexItem[]>([]);
  const [selectedVariantKey, setSelectedVariantKey] = useState('');

  const preview = useMemo(
    () => form.content || '*在左侧输入 Markdown，这里会实时预览。*',
    [form.content],
  );

  const updateField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setSelectedVariantKey('');
    setForm(INITIAL_FORM);
    setStatus('');
    setError('');
  };

  const fetchIndex = async () => {
    setLoadingIndex(true);
    try {
      const response = await fetch('/api/admin/blog-index', { cache: 'no-store' });
      const json = (await response.json()) as
        | { ok: true; data: { posts: BlogIndexItem[] } }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Failed to load blog index.' : json.error.message);
      }

      setBlogItems(json.data.posts);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load blog index.');
    } finally {
      setLoadingIndex(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialIndex = async () => {
      try {
        const response = await fetch('/api/admin/blog-index', { cache: 'no-store' });
        const json = (await response.json()) as
          | { ok: true; data: { posts: BlogIndexItem[] } }
          | { ok: false; error: { message: string } };

        if (!response.ok || !json.ok) {
          throw new Error(json.ok ? 'Failed to load blog index.' : json.error.message);
        }

        if (!cancelled) {
          setBlogItems(json.data.posts);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load blog index.');
        }
      } finally {
        if (!cancelled) {
          setLoadingIndex(false);
        }
      }
    };

    loadInitialIndex().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadVariant = async (slug: string, locale: BlogLocale) => {
    setStatus('');
    setError('');

    try {
      const response = await fetch(
        `/api/admin/blog-variant?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`,
        { cache: 'no-store' },
      );
      const json = (await response.json()) as
        | { ok: true; data: BlogVariantPayload }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Failed to load variant.' : json.error.message);
      }

      const data = json.data;
      setSelectedVariantKey(`${slug}:${locale}`);
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
    } catch (variantError) {
      setError(variantError instanceof Error ? variantError.message : 'Failed to load variant.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPublishing(true);
    setStatus('');
    setError('');

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
          tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
          pinned: form.pinned,
          accessMode: form.accessMode,
          accessGroup: form.accessGroup,
          originLocale: form.originLocale || undefined,
          content: form.content,
        }),
      });

      const json = (await response.json()) as
        | { ok: true; data: PublishResponse }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Publish failed.' : json.error.message);
      }

      setStatus(
        `已发布到 ${json.data.path}，刷新路径：${json.data.revalidated?.paths.join(', ') || '无'}`,
      );
      await fetchIndex();
      setSelectedVariantKey(`${form.slug}:${form.locale}`);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setStatus('');
    setError('');

    try {
      const response = await fetch('/api/admin/rebuild-index', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });

      const json = (await response.json()) as
        | { ok: true; data: { revalidated: { paths: string[] } } }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Rebuild failed.' : json.error.message);
      }

      setStatus(`索引已重建，刷新路径：${json.data.revalidated.paths.join(', ')}`);
      await fetchIndex();
    } catch (rebuildError) {
      setError(rebuildError instanceof Error ? rebuildError.message : 'Rebuild failed.');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1 className="title">ARSVINE ADMIN</h1>
          <p className="subtitle">
            以多语言 blog 变体为单位写作、补写、发布，并把共享访问元数据同步回整篇文章。
          </p>
        </div>
        <div className="hero-meta">
          <span>SESSION</span>
          <strong>{new Date(sessionExpiresAt).toLocaleString('zh-CN', { hour12: false })}</strong>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            登出
          </button>
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="panel archive-panel">
          <div className="panel-header">
            <h2>文章档案</h2>
            <button type="button" className="ghost-button" onClick={resetForm}>
              新建文章
            </button>
          </div>
          {loadingIndex ? (
            <p className="panel-muted">正在读取私有内容仓库…</p>
          ) : blogItems.length === 0 ? (
            <p className="panel-muted">当前还没有任何文章。</p>
          ) : (
            <div className="archive-list">
              {blogItems.map((item) => (
                <article key={item.slug} className="archive-card">
                  <div className="archive-head">
                    <strong>{item.slug}</strong>
                    <span>{item.date}</span>
                  </div>
                  <div className="archive-meta">
                    <span>{item.access.mode === 'totp' ? `受保护 · ${item.access.group || '未分组'}` : '公开'}</span>
                    {item.pinned ? <span>置顶</span> : null}
                  </div>
                  <div className="variant-list">
                    {item.availableLocales.map((locale) => (
                      <button
                        key={`${item.slug}:${locale}`}
                        type="button"
                        className={`variant-chip ${selectedVariantKey === `${item.slug}:${locale}` ? 'active' : ''}`}
                        onClick={() => {
                          handleLoadVariant(item.slug, locale).catch(() => {});
                        }}
                      >
                        {localeLabels[locale]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <form className="panel editor-panel" onSubmit={handlePublish}>
          <div className="panel-header">
            <h2>发布面板</h2>
            <div className="panel-actions">
              <button type="button" className="ghost-button" onClick={handleRebuild} disabled={rebuilding}>
                {rebuilding ? '重建中…' : '重建索引'}
              </button>
              <button type="submit" className="primary-button" disabled={publishing}>
                {publishing ? '发布中…' : '发布变体'}
              </button>
            </div>
          </div>

          <div className="field-group">
            <h3>共享字段</h3>
            <div className="form-grid">
              <label>
                <span>Slug</span>
                <input value={form.slug} onChange={(event) => updateField('slug', event.target.value)} />
              </label>
              <label>
                <span>日期</span>
                <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} />
              </label>
              <label className="full-span">
                <span>Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => updateField('tags', event.target.value)}
                  placeholder="Essay, Friend, Tsuki"
                />
              </label>
              <label>
                <span>访问模式</span>
                <select
                  value={form.accessMode}
                  onChange={(event) => updateField('accessMode', event.target.value as AccessMode)}
                >
                  <option value="public">public</option>
                  <option value="totp">totp</option>
                </select>
              </label>
              <label className="checkbox-label">
                <span>置顶</span>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(event) => updateField('pinned', event.target.checked)}
                />
              </label>
              {form.accessMode === 'totp' ? (
                <label className="full-span">
                  <span>访问组</span>
                  <input
                    value={form.accessGroup}
                    onChange={(event) => updateField('accessGroup', event.target.value)}
                    placeholder="friends-a"
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div className="field-group">
            <h3>当前语言变体</h3>
            <div className="form-grid">
              <label>
                <span>语言</span>
                <select
                  value={form.locale}
                  onChange={(event) => updateField('locale', event.target.value as BlogLocale)}
                >
                  {BLOG_LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale} · {localeLabels[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>原文来源</span>
                <select
                  value={form.originLocale}
                  onChange={(event) => updateField('originLocale', event.target.value)}
                >
                  <option value="">当前语言即原文</option>
                  {BLOG_LOCALES.filter((locale) => locale !== form.locale).map((locale) => (
                    <option key={locale} value={locale}>
                      {locale} · {localeLabels[locale]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full-span">
                <span>标题</span>
                <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
              </label>
              <label className="full-span">
                <span>摘要</span>
                <input value={form.excerpt} onChange={(event) => updateField('excerpt', event.target.value)} />
              </label>
              <label className="full-span">
                <span>Markdown 正文</span>
                <textarea
                  value={form.content}
                  onChange={(event) => updateField('content', event.target.value)}
                  rows={20}
                />
              </label>
            </div>
          </div>

          {status ? <p className="status success">{status}</p> : null}
          {error ? <p className="status error">{error}</p> : null}
        </form>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Markdown 预览</h2>
          </div>
          <div className="preview-body markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
          </div>
        </section>
      </section>
    </main>
  );
}
