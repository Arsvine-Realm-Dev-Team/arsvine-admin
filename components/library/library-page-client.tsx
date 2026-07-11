'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, MessageCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type Item = { id: string; type: 'blog' | 'tweet'; title: string; locale: string; status: 'draft' | 'published'; updatedAt: string; href: string };
type Response = { ok: true; data: { items: Item[] } } | { ok: false; error: { message: string } };

export default function LibraryPageClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | Item['type']>('all');
  const [status, setStatus] = useState<'all' | Item['status']>('all');
  const [loading, setLoading] = useState(true);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => { void (async () => {
    try { const response = await fetch('/api/admin/library', { cache: 'no-store' }); const json = await response.json() as Response; if (!response.ok || !json.ok) throw new Error(json.ok ? '' : json.error.message); setItems(json.data.items); setSelectedId(json.data.items[0]?.id); }
    finally { setLoading(false); }
  })(); }, []);

  const filtered = useMemo(() => items.filter((item) => (type === 'all' || item.type === type) && (status === 'all' || item.status === status) && `${item.title} ${item.locale}`.toLowerCase().includes(deferredQuery.trim().toLowerCase())), [items, type, status, deferredQuery]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const filters = [['all', '全部'], ['blog', 'Blog'], ['tweet', 'Tweets']] as const;

  return <main className="flex min-h-[calc(100svh-3.5rem)] flex-col bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]">
    <section className="min-w-0 p-5 lg:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold tracking-tight">内容库</h1><Button render={<a href="/blog" />}><Plus />新建文章</Button></div>
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b pb-5"><div className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索标题、语言或内容" /></div><div className="flex gap-1" role="group" aria-label="内容类型">{filters.map(([value, label]) => <Button key={value} size="sm" variant={type === value ? 'secondary' : 'ghost'} onClick={() => setType(value)}>{label}</Button>)}</div><div className="flex gap-1" role="group" aria-label="发布状态">{(['all', 'draft', 'published'] as const).map((value) => <Button key={value} size="sm" variant={status === value ? 'secondary' : 'ghost'} onClick={() => setStatus(value)}>{value === 'all' ? '全部状态' : value === 'draft' ? '草稿' : '已发布'}</Button>)}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3 font-medium">标题</th><th className="pb-3 font-medium">类型</th><th className="pb-3 font-medium">语言</th><th className="pb-3 font-medium">更新</th><th className="pb-3 font-medium">状态</th></tr></thead><tbody>{loading ? Array.from({ length: 4 }).map((_, index) => <tr key={index} className="border-b"><td className="py-4" colSpan={5}><Skeleton className="h-5 w-full" /></td></tr>) : filtered.map((item) => <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-b transition-colors hover:bg-accent/40 ${selected?.id === item.id ? 'bg-accent/30' : ''}`}><td className="max-w-md py-4 pr-4 font-medium"><span className="flex items-center gap-3">{item.type === 'blog' ? <FileText className="size-4 text-primary" /> : <MessageCircle className="size-4 text-primary" />}{item.title}</span></td><td className="py-4">{item.type === 'blog' ? 'Blog' : 'Tweet'}</td><td className="py-4 text-muted-foreground">{item.locale}</td><td className="py-4 text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</td><td className="py-4"><span className={item.status === 'published' ? 'text-primary' : 'text-muted-foreground'}>{item.status === 'published' ? '已发布' : '草稿'}</span></td></tr>)}</tbody></table></div>
    </section>
    <aside className="border-t p-5 lg:border-l lg:border-t-0 lg:p-8">{selected ? <div className="flex h-full flex-col"><div className="mb-3 text-xs font-medium uppercase tracking-wide text-primary">{selected.type === 'blog' ? 'Blog' : 'Tweet'} · {selected.locale}</div><h2 className="font-serif text-3xl leading-tight">{selected.title}</h2><dl className="mt-8 space-y-5 text-sm"><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">状态</dt><dd className="mt-1">{selected.status === 'published' ? '已发布' : '草稿'}</dd></div><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">最近更新</dt><dd className="mt-1">{new Date(selected.updatedAt).toLocaleString('zh-CN', { hour12: false })}</dd></div></dl><Button className="mt-auto w-full" render={<a href={selected.href} />}><ExternalLink />打开编辑器</Button></div> : <p className="text-sm text-muted-foreground">没有匹配的内容。</p>}</aside>
  </main>;
}
