'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import TweetCard from './tweet-card';

import { FILTER_LABELS, TWEET_FILTERS } from './filter-labels';
import { formatMonthLabel } from './tweet-utils';
import type { TweetFilter, TweetItem } from '../../lib/tweets-types';

type TweetListPanelProps = {
  monthLabel: string;
  filter: TweetFilter;
  onFilterChange: (filter: TweetFilter) => void;
  onCreate: () => void;
  loading: boolean;
  emptyHint: string;
  tweets: TweetItem[];
  onEdit: (tweet: TweetItem) => void;
  onDelete: (tweet: TweetItem) => void;
};

export default function TweetListPanel({
  monthLabel,
  filter,
  onFilterChange,
  onCreate,
  loading,
  emptyHint,
  tweets,
  onEdit,
  onDelete,
}: TweetListPanelProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{monthLabel}</h2>
            <p className="text-xs text-muted-foreground">这里显示的是读者最终会看到的排列顺序</p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(value) => onFilterChange((value ?? 'all') as TweetFilter)}>
              <TabsList>
                {TWEET_FILTERS.map((f) => (
                  <TabsTrigger key={f} value={f}>
                    {FILTER_LABELS[f]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button type="button" onClick={onCreate} size="icon-sm" aria-label="新建推文" title="新建推文">
              <Plus />
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">正在读取内容仓库推文数据…</p>
        ) : tweets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tweets.map((tweet) => (
              <TweetCard
                key={tweet.id}
                tweet={tweet}
                onEdit={() => onEdit(tweet)}
                onDelete={() => onDelete(tweet)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { formatMonthLabel };
