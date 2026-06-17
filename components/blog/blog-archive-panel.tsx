'use client';

import { Pin, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function BlogArchivePanel({
  loading,
  items,
  selectedKey,
  onSelect,
  onCreate,
}: BlogArchivePanelProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>文章档案</CardTitle>
        <Button variant="outline" size="sm" onClick={onCreate}>
          新建文章
        </Button>
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
              {items.map((item) => (
                <Card key={item.slug} className="bg-muted/30">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-sm">{item.slug}</strong>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={item.access.mode === 'totp' ? 'secondary' : 'outline'}>
                        {item.access.mode === 'totp' ? (
                          <Shield />
                        ) : (
                          <Globe />
                        )}
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
                            onClick={() => onSelect(item, locale)}
                          >
                            {localeLabels[locale]}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
