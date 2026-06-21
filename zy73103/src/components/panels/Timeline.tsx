import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useStore';
import HudCard from '../common/HudCard';
import {
  History,
  HistoryIcon,
  CircleDot,
  AlertTriangle,
  RefreshCw,
  Paperclip,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Activity,
  FileText,
  GitBranch,
} from 'lucide-react';
import { eventTypeLabel, formatDate, formatTimeShort } from '../../utils/helpers';
import { twMerge } from 'tailwind-merge';
import type { TimelineEvent } from '../../types';

const eventIcon: Record<TimelineEvent['eventType'], React.ReactNode> = {
  scheme_created: <GitBranch size={11} />,
  note_imported: <FileText size={11} />,
  anomaly_detected: <AlertTriangle size={11} />,
  anomaly_resolved: <CheckCircle2 size={11} />,
  material_arrived: <Paperclip size={11} />,
  material_late: <Paperclip size={11} />,
  status_changed: <Activity size={11} />,
  comparison_rerun: <RefreshCw size={11} />,
  scheme_updated: <HistoryIcon size={11} />,
};

const eventAccent: Record<TimelineEvent['eventType'], { dot: string; card: string; text: string; chip: string }> = {
  scheme_created: {
    dot: 'bg-blue-500',
    card: 'border-blue-500/30 bg-blue-500/[0.04]',
    text: 'text-blue-200',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
  },
  note_imported: {
    dot: 'bg-sky-500',
    card: 'border-sky-500/25 bg-sky-500/[0.03]',
    text: 'text-sky-200',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/35',
  },
  anomaly_detected: {
    dot: 'bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.55)]',
    card: 'border-red-500/40 bg-red-500/[0.06]',
    text: 'text-red-200',
    chip: 'bg-red-500/20 text-red-300 border-red-500/45',
  },
  anomaly_resolved: {
    dot: 'bg-emerald-500',
    card: 'border-emerald-500/30 bg-emerald-500/[0.05]',
    text: 'text-emerald-200',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
  },
  material_arrived: {
    dot: 'bg-emerald-400',
    card: 'border-emerald-400/30 bg-emerald-400/[0.04]',
    text: 'text-emerald-200',
    chip: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/35',
  },
  material_late: {
    dot: 'bg-orange-500',
    card: 'border-orange-500/40 border-dashed bg-orange-500/[0.05]',
    text: 'text-orange-200',
    chip: 'bg-orange-500/20 text-orange-200 border-orange-500/50',
  },
  status_changed: {
    dot: 'bg-amber-400',
    card: 'border-amber-400/30 bg-amber-400/[0.04]',
    text: 'text-amber-100',
    chip: 'bg-amber-400/15 text-amber-200 border-amber-400/35',
  },
  comparison_rerun: {
    dot: 'bg-amber-500 shadow-[0_0_10px_2px_rgba(245,158,11,0.55)]',
    card: 'border-amber-500/45 bg-gradient-to-br from-amber-500/[0.08] to-slate-900/40',
    text: 'text-amber-100',
    chip: 'bg-amber-500/25 text-amber-100 border-amber-500/55',
  },
  scheme_updated: {
    dot: 'bg-indigo-400',
    card: 'border-indigo-400/25 bg-indigo-400/[0.03]',
    text: 'text-indigo-200',
    chip: 'bg-indigo-400/15 text-indigo-200 border-indigo-400/30',
  },
};

function EventCard({ e, isLate }: { e: TimelineEvent; isLate: boolean }) {
  const [open, setOpen] = useState(e.eventType === 'comparison_rerun' || isLate);
  const a = eventAccent[e.eventType];
  const hasMore = e.description || e.fromState || e.toState;
  return (
    <div className="relative flex gap-2.5 pl-2">
      <div className="relative flex flex-col items-center">
        <div className="mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-slate-900" style={{ background: '' }}>
          <div className={twMerge('h-full w-full rounded-full', a.dot)} />
        </div>
        <div className="mt-1 w-px flex-1 bg-gradient-to-b from-slate-600/50 to-transparent" />
      </div>
      <div className="flex-1 pb-3">
        <div
          className={twMerge(
            'group relative w-full rounded-md border p-2 text-left transition-all hover:brightness-110',
            a.card,
            isLate && 'border-dashed',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={twMerge(
                'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]',
                a.chip,
              )}
            >
              {eventIcon[e.eventType]}
              {eventTypeLabel(e.eventType)}
            </span>
            <span
              className="font-mono text-[10px] text-slate-400"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              #{e.schemeId}
            </span>
            {e.anomalyId && (
              <button
                onClick={() => {
                  useAppStore.getState().setActivePanelTab('anomaly');
                  useAppStore.getState().selectAnomaly(e.anomalyId);
                }}
                className="rounded border border-red-500/35 bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/20 transition-colors"
              >
                <AlertTriangle size={9.5} className="mr-0.5 inline -mt-0.5" />
                跳异常详情 →
              </button>
            )}
            {hasMore && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="ml-auto rounded px-1 py-0.5 text-slate-500 hover:bg-slate-700/50 hover:text-slate-200"
              >
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
          </div>
          <div className={twMerge('mt-1 text-[12px] font-semibold leading-snug', a.text)}>
            {e.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-0.5">
              <CircleDot size={9.5} />
              {formatDate(e.timestamp)}
            </span>
            <span className="flex items-center gap-0.5">
              <Activity size={9.5} />
              {e.actor}
            </span>
            {e.fromState && e.toState && (
              <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                <s className="text-amber-400/70">{e.fromState}</s>
                <span>→</span>
                <span className="font-semibold">{e.toState}</span>
              </span>
            )}
            {isLate && (
              <span className="rounded border border-orange-500/50 bg-orange-500/15 px-1.5 py-0.5 text-[9.5px] text-orange-200">
                待补齐 · 不卡流程
              </span>
            )}
          </div>
          {open && e.description && (
            <div className="mt-2 rounded border border-slate-700/50 bg-slate-950/60 p-2 font-mono text-[10.5px] leading-relaxed text-slate-300 whitespace-pre-line"
                 style={{ fontFamily: '"JetBrains Mono", monospace' }}>
              {e.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const FILTERS: { key: 'all' | 'A' | 'B' | 'C' | 'anomaly' | 'rerun'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'A', label: '方案A' },
  { key: 'B', label: '方案B' },
  { key: 'C', label: '方案C' },
  { key: 'anomaly', label: '仅异常' },
  { key: 'rerun', label: '仅重跑' },
];

export default function Timeline() {
  const timeline = useAppStore((s) => s.timeline);
  const selectedScheme = useAppStore((s) => s.selectedSchemeId);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const rerunCount = useAppStore((s) => s.rerunHistory.length);

  const filtered = useMemo(() => {
    let list = timeline;
    if (filter === 'all') list = timeline;
    else if (filter === 'anomaly')
      list = timeline.filter((t) => t.eventType.includes('anomaly') || t.eventType === 'material_late');
    else if (filter === 'rerun')
      list = timeline.filter((t) => t.eventType === 'comparison_rerun' || t.eventType === 'scheme_updated');
    else list = timeline.filter((t) => t.schemeId === filter);
    return [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [timeline, filter]);

  return (
    <HudCard
      title={`历史时间线 · 最终交付物 · 共 ${filtered.length} 条事件`}
      accent="orange"
      icon={<History size={12} className="text-amber-400" />}
      className="flex h-full min-h-[300px] flex-col"
    >
      <div className="flex items-center gap-1 border-b border-slate-700/50 px-2 py-1.5 text-[10.5px] overflow-x-auto custom-scrollbar">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const hint = f.key === selectedScheme;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={twMerge(
                'shrink-0 rounded px-2 py-0.5 transition-colors whitespace-nowrap',
                active
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50'
                  : hint
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent',
              )}
            >
              {f.label}
              {hint && <span className="ml-1 text-[9px] text-blue-400">●当前</span>}
            </button>
          );
        })}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          RERUN × {rerunCount} · NO DATA LOSS
        </span>
      </div>

      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 via-slate-900/30 to-transparent border-b border-slate-700/40 px-3 py-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-amber-300">
          <RefreshCw size={12} />
        </div>
        <div className="text-[11px] text-amber-200 leading-snug flex-1">
          时间线为最终沟通产物 · 与场景标注 / 侧边说明同源 · 重跑仅追加新状态 ·
          <span className="text-emerald-300"> 历史不丢失、不断线</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 pl-3 pr-2">
        {filtered.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed border-slate-700/60 bg-slate-900/30 text-[12px] text-slate-500">
            当前筛选无事件
          </div>
        ) : (
          <div>
            {filtered.map((e) => (
              <EventCard
                key={e.id}
                e={e}
                isLate={e.eventType === 'material_late'}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-700/50 px-3 py-1.5 text-[10.5px] text-slate-500 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><Layers size={10.5} className="text-red-400" /> 图层异常已拎出</span>
        <span className="flex items-center gap-1"><Paperclip size={10.5} className="text-orange-400" /> 晚到附件延迟归档</span>
        <span className="flex items-center gap-1"><GitBranch size={10.5} className="text-blue-400" /> 责任口径三方一致</span>
        <span className="ml-auto font-mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          ↑ 可直接截图用于早会沟通
        </span>
      </div>
    </HudCard>
  );
}
