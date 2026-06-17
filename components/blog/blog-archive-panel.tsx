'use client';

import { useMemo, useState } from 'react';
import { Pin, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { BLOG_LOCALES, localeLabels, type BlogLocale } from './blog-locale-labels';

type AccessMode = 'public' | 'totp';

export type BlogIndexItem = {
  slug: string;
  date: string;
  updatedAt: string;
  tags: string[];
  pinned: boolean;
  access: { mode: AccessMode; group?: string };
  availableLocales: BlogLocale[];
  variants: Partial<Record<BlogLocale, { title: string; excerpt: string; originLocale?: BlogLocale }>>;
};

type BlogArchivePanelProps = {
  loading: boolean;
  items: BlogIndexItem[];
  selectedKey: string;
  onSelect: (item: BlogIndexItem, locale: BlogLocale) => void;
  onCreate: () => void;
};

type DateGranularity = 'year' | 'month' | 'day';

type BlogDateGroup = {
  key: string;
  label: string;
  items: BlogIndexItem[];
};

function getDateGroupKey(value: string, granularity: DateGranularity) {
  if (granularity === 'year') return value.slice(0, 4);
  if (granularity === 'day') return value.slice(0, 10);
  return value.slice(0, 7);
}

function formatDateGroupLabel(key: string, granularity: DateGranularity) {
  if (granularity === 'year') {
    const date = new Date(`${key}-01-01T00:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(date);
  }

  if (granularity === 'day') {
    const date = new Date(`${key}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Shanghai',
    }).format(date);
  }

  const date = new Date(`${key}-01T00:00:00+08:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

export default function BlogArchivePanel({
  loading,
  items,
  selectedKey,
  onSelect,
  onCreate,
}: BlogArchivePanelProps) {
  const [granularity, setGranularity] = useState<DateGranularity>('month');

  function getDefaultLocale(item: BlogIndexItem): BlogLocale {
    if (item.availableLocales.includes('zh-CN')) {
      return 'zh-CN';
    }
    if (item.availableLocales.includes('en')) {
      return 'en';
    }
    return item.availableLocales[0] ?? 'zh-CN';
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, BlogDateGroup>();
    for (const item of items) {
      const key = getDateGroupKey(item.date, granularity);
      const current = grouped.get(key) ?? {
        key,
        label: formatDateGroupLabel(key, granularity),
        items: [],
      };
      current.items.push(item);
      grouped.set(key, current);
    }

    return [...grouped.values()].sort((left, right) => right.key.localeCompare(left.key));
  }, [granularity, items]);

  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle>文章档案</CardTitle>
          <Button variant="outline" size="sm" onClick={onCreate}>
            新建文章
          </Button>
        </div>
        <Tabs value={granularity} onValueChange={(value) => setGranularity((value ?? 'month') as DateGranularity)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="year">年</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="day">日</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前还没有任何文章。</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)] pr-3 lg:h-[calc(100vh-220px)]">
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-medium text-muted-foreground">{group.label}</h3>
                    <span className="text-xs text-muted-foreground">{group.items.length} 篇</span>
                  </div>
                  {group.items.map((item) => {
                    const selectedSlug = selectedKey.split(':')[0];
                    const cardActive = selectedSlug === item.slug;
                    return (
                      <Card
                        key={item.slug}
                        className={
                          cardActive
                            ? 'cursor-pointer border-primary/40 bg-muted/40 ring-1 ring-primary/30'
                            : 'cursor-pointer bg-muted/30 transition-colors hover:bg-muted/40'
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(item, getDefaultLocale(item))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(item, getDefaultLocale(item));
                          }
                        }}
                      >
                        <CardContent className="flex flex-col gap-2 p-4">
                          <div className="flex items-baseline justify-between gap-2">
                            <strong className="text-sm">{item.slug}</strong>
                            <span className="text-xs text-muted-foreground">{item.date}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={item.access.mode === 'totp' ? 'secondary' : 'outline'}>
                              {item.access.mode === 'totp' ? <Shield /> : <Globe />}
                              {item.access.mode === 'totp' ? `受保护 · ${item.access.group || '未分组'}` : '公开'}
                            </Badge>
                            {item.pinned ? (
                              <Badge variant="default">
                                <Pin /> 置顶
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {BLOG_LOCALES.map((locale) => {
                              if (!item.availableLocales.includes(locale)) return null;
                              const key = `${item.slug}:${locale}`;
                              const active = selectedKey === key;
                              return (
                                <Button
                                  key={key}
                                  type="button"
                                  size="xs"
                                  variant={active ? 'default' : 'outline'}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onSelect(item, locale);
                                  }}
                                >
                                  {localeLabels[locale]}
                                </Button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </section>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
