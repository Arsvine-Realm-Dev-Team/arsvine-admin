'use client';

import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { formatTimestamp, type DateGranularity, type TweetDateGroup } from './tweet-utils';

type MonthIndexPanelProps = {
  groups: TweetDateGroup[];
  activeGroupKey: string;
  granularity: DateGranularity;
  onGranularityChange: (granularity: DateGranularity) => void;
  onSelect: (key: string) => void;
};

export default function MonthIndexPanel({
  groups,
  activeGroupKey,
  granularity,
  onGranularityChange,
  onSelect,
}: MonthIndexPanelProps) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar /> 时间索引
        </CardTitle>
        <Tabs value={granularity} onValueChange={(value) => onGranularityChange((value ?? 'month') as DateGranularity)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="year">年</TabsTrigger>
            <TabsTrigger value="month">月</TabsTrigger>
            <TabsTrigger value="day">日</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前范围下还没有任何推文数据。</p>
        ) : (
          <ScrollArea className="max-h-[420px] pr-2">
            <div className="flex flex-col gap-1">
              {groups.map((group) => {
                const active = group.key === activeGroupKey;
                return (
                  <Button
                    key={group.key}
                    type="button"
                    variant={active ? 'default' : 'ghost'}
                    onClick={() => onSelect(group.key)}
                    className="h-auto justify-start py-2 text-left"
                  >
                    <span className="flex w-full flex-col items-start gap-0.5">
                      <span className="text-sm font-medium">{group.label}</span>
                      <span className="text-xs opacity-80">
                        {group.count} 条 ·{' '}
                        {group.updatedAt ? (
                          <time dateTime={group.updatedAt}>{formatTimestamp(group.updatedAt)}</time>
                        ) : (
                          '—'
                        )}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
