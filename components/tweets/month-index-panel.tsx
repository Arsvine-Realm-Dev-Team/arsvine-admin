'use client';

import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

import { formatMonthLabel, formatTimestamp } from './tweet-utils';
import type { TweetMonthRecord } from '../../lib/tweets-types';

type MonthIndexPanelProps = {
  months: TweetMonthRecord[];
  activeMonth: string;
  onSelect: (month: string) => void;
};

export default function MonthIndexPanel({ months, activeMonth, onSelect }: MonthIndexPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar /> Month Index
        </CardTitle>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有任何月份数据。</p>
        ) : (
          <ScrollArea className="max-h-[420px] pr-2">
            <div className="flex flex-col gap-1">
              {months.map((month) => {
                const active = month.month === activeMonth;
                return (
                  <Button
                    key={month.month}
                    type="button"
                    variant={active ? 'default' : 'ghost'}
                    onClick={() => onSelect(month.month)}
                    className="h-auto justify-between py-2"
                  >
                    <span className="text-sm font-medium">{formatMonthLabel(month.month)}</span>
                    <span className="text-xs opacity-80">
                      {month.count} 条 · {formatTimestamp(month.updatedAt)}
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
