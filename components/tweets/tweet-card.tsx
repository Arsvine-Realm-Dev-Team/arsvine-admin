'use client';

import { ChevronDown, ChevronUp, Globe, Shield, EyeOff, Pin, Hash } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { VISIBILITY_LABELS } from './filter-labels';
import { SITE_TWEET_LOCALES } from '../../lib/tweets-types';
import type { TweetItem, TweetVisibility } from '../../lib/tweets-types';

type TweetCardProps = {
  tweet: TweetItem;
  onEdit: () => void;
  onDelete: () => void;
};

export default function TweetCard({ tweet, onEdit, onDelete }: TweetCardProps) {
  const [translationsOpen, setTranslationsOpen] = useState(false);
  const hasTranslations = Boolean(tweet.translations && Object.keys(tweet.translations).length > 0);
  const visibility: TweetVisibility = (tweet.visibility ?? 'public') as TweetVisibility;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-mono text-sm font-medium">{tweet.id}</span>
            <span className="text-xs text-muted-foreground">
              创建于 {tweet.createdAt} · 更新于 {tweet.updatedAt ?? '—'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{tweet.lang ?? 'zh-CN'}</Badge>
            <Badge variant={visibilityBadgeVariant(visibility)}>
              {visibilityIcon(visibility)}
              {VISIBILITY_LABELS[visibility]}
            </Badge>
            {tweet.pinned ? (
              <Badge variant="default">
                <Pin /> 置顶
              </Badge>
            ) : null}
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">{tweet.content}</p>

        {tweet.tags && tweet.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {tweet.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1">
                <Hash className="size-3" /> {tag}
              </span>
            ))}
          </div>
        ) : null}

        {hasTranslations ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit"
              aria-expanded={translationsOpen}
              onClick={() => setTranslationsOpen((value) => !value)}
            >
              {translationsOpen ? <ChevronUp /> : <ChevronDown />}
              {translationsOpen ? '收起译文' : '查看译文'}
            </Button>
            {translationsOpen ? (
              <div className="flex flex-col gap-2">
                {SITE_TWEET_LOCALES.map((locale) => {
                  const translation = tweet.translations?.[locale];
                  if (!translation) return null;
                  return (
                    <div
                      key={locale}
                      className="rounded-md border bg-muted/30 p-3 text-sm"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">{locale}</span>
                        {translation.stale ? (
                          <Badge variant="secondary">已过期</Badge>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{translation.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            编辑
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function visibilityIcon(v: TweetVisibility) {
  if (v === 'public') return <Globe />;
  if (v === 'private') return <Shield />;
  return <EyeOff />;
}

function visibilityBadgeVariant(v: TweetVisibility): 'default' | 'secondary' | 'destructive' {
  if (v === 'public') return 'default';
  if (v === 'private') return 'secondary';
  return 'destructive';
}
