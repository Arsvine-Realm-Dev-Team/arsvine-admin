'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, MessageCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Item = { id: string; type: 'blog' | 'tweet'; title: string; locale: string; status: 'draft' | 'published'; updatedAt: string; href: string };
type Response = { ok: true; data: { items: Item[] } } | { ok: false; error: { message: string } };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function Detail({ item }: { item: Item }) {
  return <div className="flex h-full flex-col gap-6 p-4">
    <div><Badge variant="secondary">{item.type === 'blog' ? 'Blog' : 'Tweets'} · {item.locale}</Badge><h2 className="mt-4 text-xl font-semibold leading-tight">{item.title}</h2></div>
    <dl className="grid gap-4 text-sm"><div><dt className="text-muted-foreground">状态</dt><dd className="mt-1">{item.status === 'published' ? '已发布' : '草稿'}</dd></div><div><dt className="text-muted-foreground">最近更新</dt><dd className="mt-1 font-mono text-xs">{formatDate(item.updatedAt)}</dd></div></dl>
    <Button className="mt-auto" render={<a href={item.href} />}><ExternalLink data-icon="inline-start" />打开编辑器</Button>
  </div>;
}

export default function LibraryPageClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | Item['type']>('all');
  const [status, setStatus] = useState<'all' | Item['status']>('all');
  const [language, setLanguage] = useState('all');
  const [loading, setLoading] = useState(true);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => { void (async () => {
    try {
      const response = await fetch('/api/admin/library', { cache: 'no-store' });
      const json = await response.json() as Response;
      if (!response.ok || !json.ok) throw new Error(json.ok ? '' : json.error.message);
      setItems(json.data.items); setSelectedId(json.data.items[0]?.id);
    } finally { setLoading(false); }
  })(); }, []);

  const languages = useMemo(() => [...new Set(items.flatMap((item) => item.locale.split(' · ')))].sort(), [items]);
  const filtered = useMemo(() => items.filter((item) => (type === 'all' || item.type === type) && (status === 'all' || item.status === status) && (language === 'all' || item.locale.split(' · ').includes(language)) && `${item.title} ${item.locale}`.toLowerCase().includes(deferredQuery.trim().toLowerCase())), [items, type, status, language, deferredQuery]);
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];

  function select(item: Item) { setSelectedId(item.id); setMobileDetailOpen(true); }

  return <main className="min-h-[calc(100svh-3.5rem)] bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_19rem]">
    <section className="min-w-0 p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">内容库</h1><p className="mt-1 text-sm text-muted-foreground">检索自己的 Blog 与 Tweets，然后进入专注编辑。</p></div><Button render={<a href="/blog" />}><Plus data-icon="inline-start" />新建文章</Button></div>
      <div className="mb-4 flex flex-wrap gap-2 border-y py-3">
        <InputGroup className="min-w-56 flex-1"><InputGroupAddon><Search /></InputGroupAddon><InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或语言" /></InputGroup>
        <Select value={type} onValueChange={(value) => setType(value as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">所有类型</SelectItem><SelectItem value="blog">Blog</SelectItem><SelectItem value="tweet">Tweets</SelectItem></SelectGroup></SelectContent></Select>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">所有状态</SelectItem><SelectItem value="draft">草稿</SelectItem><SelectItem value="published">已发布</SelectItem></SelectGroup></SelectContent></Select>
        <Select value={language} onValueChange={(value) => setLanguage(value ?? 'all')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">所有语言</SelectItem>{languages.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select>
      </div>
      <Table><TableHeader><TableRow><TableHead>内容</TableHead><TableHead>类型</TableHead><TableHead>语言</TableHead><TableHead>更新</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>) : filtered.map((item) => <TableRow key={item.id} data-state={selected?.id === item.id ? 'selected' : undefined} className="cursor-pointer" onClick={() => select(item)}><TableCell className="max-w-sm font-medium"><span className="flex items-center gap-2 truncate">{item.type === 'blog' ? <FileText className="text-primary" /> : <MessageCircle className="text-primary" />}{item.title}</span></TableCell><TableCell>{item.type === 'blog' ? 'Blog' : 'Tweets'}</TableCell><TableCell className="text-muted-foreground">{item.locale}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{formatDate(item.updatedAt)}</TableCell><TableCell><Badge variant={item.status === 'published' ? 'secondary' : 'outline'}>{item.status === 'published' ? '已发布' : '草稿'}</Badge></TableCell></TableRow>)}{!loading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">没有匹配的内容。</TableCell></TableRow>}</TableBody></Table>
    </section>
    <aside className="hidden border-l lg:block">{selected ? <Detail item={selected} /> : <p className="p-8 text-sm text-muted-foreground">选择内容以查看详情。</p>}</aside>
    <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}><SheetContent side="bottom" className="max-h-[85svh] overflow-auto"><SheetHeader><SheetTitle>内容详情</SheetTitle><SheetDescription>检查状态后进入编辑器。</SheetDescription></SheetHeader>{selected && <Detail item={selected} />}</SheetContent></Sheet>
  </main>;
}
