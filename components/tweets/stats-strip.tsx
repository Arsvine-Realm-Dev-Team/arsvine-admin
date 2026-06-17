'use client';

import { Archive, Globe, Shield, EyeOff, Pin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type StatsStripProps = {
  total: number;
  publicCount: number;
  privateCount: number;
  hiddenCount: number;
  pinnedCount: number;
};

export default function StatsStrip({
  total,
  publicCount,
  privateCount,
  hiddenCount,
  pinnedCount,
}: StatsStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard icon={<Archive />} label="Archive" value={total} />
      <StatCard icon={<Globe />} label="Public" value={publicCount} />
      <StatCard icon={<Shield />} label="Private" value={privateCount} />
      <StatCard icon={<EyeOff />} label="Hidden" value={hiddenCount} />
      <StatCard icon={<Pin />} label="Pinned" value={pinnedCount} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <strong className="text-2xl">{value}</strong>
      </CardContent>
    </Card>
  );
}
