import { useState, useMemo } from 'react';
import { useMidiStore } from '@/store/useMidiStore';
import type { Conflict, TraceEntry } from '@/types/midi';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Shield,
  Zap,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | Conflict['type'];
type SeverityFilter = 'all' | Conflict['severity'];
type StatusFilter = 'active' | 'resolved';

const typeLabels: Record<Conflict['type'], string> = {
  channel_collision: '通道冲突',
  polarity_reversed: '极性反转',
  preset_override: '预设覆盖',
};

const typeColors: Record<Conflict['type'], string> = {
  channel_collision: 'bg-red-500/20 text-red-400',
  polarity_reversed: 'bg-amber-500/20 text-amber-400',
  preset_override: 'bg-purple-500/20 text-purple-400',
};

const traceIcons: Record<TraceEntry['type'], React.ReactNode> = {
  event: <Zap size={12} />,
  preset: <Layers size={12} />,
  mapping: <ArrowRight size={12} />,
  parameter: <RotateCcw size={12} />,
};

function TracePath({ entries }: { entries: TraceEntry[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 pl-4 pt-2 font-mono text-xs text-zinc-400">
      {entries.map((entry, i) => (
        <span key={entry.targetId + i} className="flex items-center gap-1">
          {i > 0 && <ArrowRight size={10} className="text-zinc-600" />}
          <span className="flex items-center gap-0.5 rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            {traceIcons[entry.type]}
            {entry.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const [expanded, setExpanded] = useState(false);
  const resolveConflict = useMidiStore((s) => s.resolveConflict);
  const isResolved = conflict.resolvedAt != null;

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 bg-zinc-900/50 p-4 transition-opacity',
        conflict.severity === 'critical' ? 'border-l-red-500' : 'border-l-amber-500',
        isResolved && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', typeColors[conflict.type])}>
            {typeLabels[conflict.type]}
          </span>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              conflict.severity === 'critical'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-500/20 text-amber-400',
            )}
          >
            {conflict.severity === 'critical' ? <AlertOctagon size={12} /> : <AlertTriangle size={12} />}
            {conflict.severity === 'critical' ? '严重' : '警告'}
          </span>
          {isResolved && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              <CheckCircle size={12} />
              已解决
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {new Date(conflict.detectedAt).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isResolved && (
            <button
              onClick={() => resolveConflict(conflict.id)}
              className="rounded bg-emerald-600/20 px-3 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/40"
            >
              解决
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-zinc-500 hover:text-zinc-300">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      <p className={cn('mt-2 text-sm text-zinc-300', isResolved && 'line-through')}>
        {conflict.description}
      </p>

      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          expanded ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <TracePath entries={conflict.sourceTrace} />
        </div>
      </div>
    </div>
  );
}

export default function Conflicts() {
  const conflicts = useMidiStore((s) => s.conflicts);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const filtered = useMemo(() => {
    return conflicts.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
      if (statusFilter === 'active' && c.resolvedAt != null) return false;
      if (statusFilter === 'resolved' && c.resolvedAt == null) return false;
      return true;
    });
  }, [conflicts, typeFilter, severityFilter, statusFilter]);

  const criticalCount = conflicts.filter((c) => c.severity === 'critical' && c.resolvedAt == null).length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning' && c.resolvedAt == null).length;
  const resolvedCount = conflicts.filter((c) => c.resolvedAt != null).length;

  return (
    <div className="min-h-screen bg-[#0D1117] p-6 font-['Noto_Sans_SC',sans-serif]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">冲突检测面板</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-red-400">
              <AlertOctagon size={16} />
              {criticalCount} 严重
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle size={16} />
              {warningCount} 警告
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle size={16} />
              {resolvedCount} 已解决
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-[#00FF87]"
          >
            <option value="all">全部类型</option>
            <option value="channel_collision">通道冲突</option>
            <option value="polarity_reversed">极性反转</option>
            <option value="preset_override">预设覆盖</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-[#00FF87]"
          >
            <option value="all">全部严重度</option>
            <option value="warning">警告</option>
            <option value="critical">严重</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-[#00FF87]"
          >
            <option value="active">活跃</option>
            <option value="resolved">已解决</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
            <Shield size={48} className="mb-4 text-zinc-600" />
            <p className="text-lg font-medium">无冲突检测</p>
            <p className="mt-1 text-sm">所有映射运行正常</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
