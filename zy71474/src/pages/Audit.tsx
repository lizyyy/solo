import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Zap, GitBranch, Download, RefreshCw, Settings, Activity, type LucideIcon } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { formatTimestamp } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import type { AuditEntry } from '@/types';

const TYPE_ICON: Record<string, LucideIcon> = {
  zero_mass: AlertTriangle,
  energy_increase: Zap,
  sequence_overwrite: GitBranch,
  import: Download,
  reupload: RefreshCw,
  parameter_change: Settings,
};

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-brand-amber/20 text-brand-amber',
  critical: 'bg-brand-red/20 text-brand-red',
};

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-blue-500',
  warning: 'bg-brand-amber',
  critical: 'bg-brand-red',
};

const SEVERITY_TEXT: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-brand-amber',
  critical: 'text-brand-red',
};

export default function Audit() {
  const navigate = useNavigate();
  const { experiments, loadFromStorage } = useStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const allEntries = useMemo(() =>
    experiments.flatMap(e =>
      e.auditLog.map(a => ({ ...a, experimentId: a.experimentId || e.id }))
    ).sort((a, b) => b.timestamp - a.timestamp),
  [experiments]);

  const riskEntries = useMemo(() =>
    allEntries.filter(a => a.severity === 'warning' || a.severity === 'critical'),
  [allEntries]);

  const stats = useMemo(() => ({
    totalExperiments: experiments.length,
    totalRisk: riskEntries.length,
    totalEntries: allEntries.length,
  }), [experiments.length, riskEntries.length, allEntries.length]);

  return (
    <div className="min-h-screen bg-brand-bg p-6 font-body space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-brand-card rounded-xl border border-brand-border p-4 text-center">
          <p className="font-display text-2xl text-brand-cyan">{stats.totalExperiments}</p>
          <p className="text-brand-muted text-sm">实验总数</p>
        </div>
        <div className="bg-brand-card rounded-xl border border-brand-border p-4 text-center">
          <p className="font-display text-2xl text-brand-red">{stats.totalRisk}</p>
          <p className="text-brand-muted text-sm">风险项</p>
        </div>
        <div className="bg-brand-card rounded-xl border border-brand-border p-4 text-center">
          <p className="font-display text-2xl text-brand-amber">{stats.totalEntries}</p>
          <p className="text-brand-muted text-sm">审计条目</p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-brand-text text-lg mb-4">风险标记</h2>
        {riskEntries.length === 0 ? (
          <p className="text-brand-muted text-sm">暂无风险项</p>
        ) : (
          <div className="space-y-3">
            {riskEntries.map(entry => {
              const Icon = TYPE_ICON[entry.type] ?? Activity;
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'bg-brand-card rounded-xl border border-brand-border p-4 flex items-start gap-4',
                    entry.severity === 'critical' && 'border-l-4 border-l-brand-red animate-pulse-red',
                    entry.severity === 'warning' && 'border-l-4 border-l-brand-amber',
                  )}
                >
                  <Icon size={18} className={cn('shrink-0 mt-0.5', SEVERITY_TEXT[entry.severity])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', SEVERITY_BADGE[entry.severity])}>
                        {entry.severity}
                      </span>
                      <span className="text-brand-text text-sm">{entry.message}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-brand-muted text-xs">{formatTimestamp(entry.timestamp)}</span>
                      <button
                        onClick={() => navigate(`/detail/${entry.experimentId}`)}
                        className="text-brand-cyan text-xs hover:underline"
                      >
                        查看明细 →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-brand-text text-lg mb-4">操作日志</h2>
        {allEntries.length === 0 ? (
          <p className="text-brand-muted text-sm">暂无审计日志</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-brand-border space-y-4">
            {allEntries.map(entry => {
              const Icon = TYPE_ICON[entry.type] ?? Activity;
              return (
                <div key={entry.id} className="relative">
                  <div
                    className={cn(
                      'absolute -left-[1.85rem] top-1 w-3 h-3 rounded-full border-2 border-brand-bg',
                      SEVERITY_DOT[entry.severity],
                    )}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Icon size={14} className={cn('shrink-0', SEVERITY_TEXT[entry.severity])} />
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', SEVERITY_BADGE[entry.severity])}>
                      {entry.type}
                    </span>
                    <span className="text-brand-text text-sm">{entry.message}</span>
                    <span className="text-brand-muted text-xs ml-auto shrink-0">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
