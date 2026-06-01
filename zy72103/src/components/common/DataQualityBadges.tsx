import type { DataQuality } from '@/types';
import { AlertTriangle, Copy, MinusCircle, Flame } from 'lucide-react';

interface DataQualityBadgesProps {
  quality: DataQuality;
  showAll?: boolean;
}

export function DataQualityBadges({ quality, showAll = false }: DataQualityBadgesProps) {
  const badges = [];

  if (quality.isNull) {
    badges.push(
      <span
        key="null"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-600 text-slate-300"
        title="包含空值"
      >
        <MinusCircle className="w-3 h-3" />
        空值
      </span>,
    );
  }

  if (quality.isDuplicate) {
    badges.push(
      <span
        key="duplicate"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30"
        title="重复记录"
      >
        <Copy className="w-3 h-3" />
        重复
      </span>,
    );
  }

  if (quality.isBoundary) {
    badges.push(
      <span
        key="boundary"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30"
        title="边界值"
      >
        <AlertTriangle className="w-3 h-3" />
        边界
      </span>,
    );
  }

  if (quality.isExtreme) {
    badges.push(
      <span
        key="extreme"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
        title="极端值"
      >
        <Flame className="w-3 h-3" />
        极端值
      </span>,
    );
  }

  if (badges.length === 0 && showAll) {
    badges.push(
      <span
        key="normal"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400"
      >
        正常
      </span>,
    );
  }

  return <div className="flex gap-1.5">{badges}</div>;
}
