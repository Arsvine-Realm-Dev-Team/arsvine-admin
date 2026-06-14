'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const INITIAL_FORM = {
  title: '',
  slug: '',
  summary: '',
  date: new Date().toISOString().slice(0, 10),
  accessMode: 'public' as 'public' | 'totp',
  accessGroup: '',
  content: '',
};

export default function AdminShell({ csrfToken, sessionExpiresAt }: AdminShellProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const preview = useMemo(
    () => form.content || '*在左侧输入 Markdown，这里会实时预览。*',
    [form.content],
  );

  const updateField = <K extends keyof typeof INITIAL_FORM>(key: K, value: (typeof INITIAL_FORM)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
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
        body: JSON.stringify(form),
      });

      const json = (await response.json()) as
        | { ok: true; data: PublishResponse }
        | { ok: false; error: { message: string } };

      if (!response.ok || !json.ok) {
        throw new Error(json.ok ? 'Publish failed.' : json.error.message);
      }

      setStatus(
        `已发布到 ${json.data.path}，公开站点刷新路径：${json.data.revalidated?.paths.join(', ') || '无'}`,
      );
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

      setStatus(`索引已重建，公开站点刷新路径：${json.data.revalidated.paths.join(', ')}`);
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
            直接写作、预览、发布到私有内容仓库，并回调公开站点刷新内容缓存。
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
        <form className="panel editor-panel" onSubmit={handlePublish}>
          <div className="panel-header">
            <h2>发布面板</h2>
            <div className="panel-actions">
              <button type="button" className="ghost-button" onClick={handleRebuild} disabled={rebuilding}>
                {rebuilding ? '重建中…' : '重建索引'}
              </button>
              <button type="submit" className="primary-button" disabled={publishing}>
                {publishing ? '发布中…' : '发布文章'}
              </button>
            </div>
          </div>

          <div className="form-grid">
            <label>
              <span>标题</span>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} />
            </label>
            <label>
              <span>Slug</span>
              <input value={form.slug} onChange={(event) => updateField('slug', event.target.value)} />
            </label>
            <label>
              <span>日期</span>
              <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} />
            </label>
            <label>
              <span>访问模式</span>
              <select
                value={form.accessMode}
                onChange={(event) => updateField('accessMode', event.target.value as 'public' | 'totp')}
              >
                <option value="public">public</option>
                <option value="totp">totp</option>
              </select>
            </label>
            <label className="full-span">
              <span>摘要</span>
              <input value={form.summary} onChange={(event) => updateField('summary', event.target.value)} />
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
            <label className="full-span">
              <span>Markdown 正文</span>
              <textarea
                value={form.content}
                onChange={(event) => updateField('content', event.target.value)}
                rows={20}
              />
            </label>
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
