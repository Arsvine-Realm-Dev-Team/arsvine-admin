'use client';

import { CodeXml, GitBranch, FileCode2, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { TweetsDashboardData } from '../../lib/tweets-types';

type RepositoryPanelProps = {
  data: TweetsDashboardData | null;
  targetPath: string;
};

export default function RepositoryPanel({ data, targetPath }: RepositoryPanelProps) {
  const repo = data?.repo;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <CodeXml /> 内容仓库
        </CardTitle>
        <CardDescription>
          保存会直接提交到私有内容仓库，并在成功后触发公开推文页刷新。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <RepoStat icon={<CodeXml />} label="Repository" value={repo?.name ?? '加载中…'} />
          <RepoStat
            icon={<GitBranch />}
            label="Branch"
            value={repo?.branch ?? '加载中…'}
          />
          <RepoStat
            icon={<MapPin />}
            label="Source"
            value={repo?.originUrl ?? 'GitHub Contents API'}
          />
          <RepoStat
            icon={<FileCode2 />}
            label="Current File"
            value={targetPath}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RepoStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}
