import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useCarbonStore } from '@/store/useCarbonStore';
import type { AnomalyItem } from '@/types/carbon';

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertCircle; color: string; bg: string }> = {
  error: { icon: AlertCircle, color: 'text-warm-red', bg: 'bg-red-50' },
  warning: { icon: AlertTriangle, color: 'text-amber-accent', bg: 'bg-amber-50' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
};

function AnomalyRow({ item }: { item: AnomalyItem }) {
  const resolveAnomaly = useCarbonStore((s) => s.resolveAnomaly);
  const config = SEVERITY_CONFIG[item.severity];
  const Icon = config.icon;

  if (item.resolved) return null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${config.bg}`}>
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{item.message}</p>
        <p className="mt-1 text-xs text-cool-gray">{item.explanation}</p>
        <p className="mt-1 text-xs text-forest-green">{item.suggestion}</p>
      </div>
      <button
        onClick={() => resolveAnomaly(item.id, 'resolved')}
        className="flex-shrink-0 rounded-md bg-forest-green px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-forest-green-600"
      >
        处理
      </button>
    </div>
  );
}

export default function AnomalyBanner() {
  const anomalies = useCarbonStore((s) => s.anomalies);
  const [expanded, setExpanded] = useState(false);

  const unresolved = anomalies.filter((a) => !a.resolved);
  const count = unresolved.length;

  if (count === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-accent" />
          <span className="text-sm font-medium text-gray-800">
            检测到 {count} 条数据异常
          </span>
          <span className="rounded-full bg-warm-red px-2 py-0.5 text-xs font-bold text-white">
            {count}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-cool-gray" />
        ) : (
          <ChevronDown className="h-4 w-4 text-cool-gray" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-amber-200 px-5 py-4">
          {unresolved.map((item) => (
            <AnomalyRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
