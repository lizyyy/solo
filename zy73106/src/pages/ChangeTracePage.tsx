import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, History, MapPin, ShieldAlert } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { ValueChangeLog, NoteBlock, DrawingMetrics } from '@/types';
import { METRIC_FIELD_LABELS } from '@/types';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/lib/utils';

function MetricBadge({ label, value, count }: { label: string; value: number; count: number }) {
  return (
    <div className="flex-1 bg-steel-800 rounded-sm border border-steel-600 shadow-sm p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-steel-300">{label}</span>
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-sm font-bold',
          count > 0 ? 'bg-[#1A5276]/30 text-[#5DADE2]' : 'bg-steel-700/40 text-steel-300',
        )}>
          变动 {count} 次
        </span>
      </div>
      <div className="text-2xl font-bold text-steel-100">{value}</div>
    </div>
  );
}

function ChangeLogCard({ log }: { log: ValueChangeLog }) {
  const delta = log.newValue - log.oldValue;
  const isImprove = delta < 0;
  const pct = log.oldValue !== 0 ? Math.abs(delta / log.oldValue) * 100 : 100;

  return (
    <div className="bg-steel-800 rounded-sm border border-steel-600 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-steel-700 border-b border-steel-600">
        <div className={cn(
          'w-8 h-8 rounded-sm flex items-center justify-center shrink-0',
          isImprove ? 'bg-emerald-900/40' : 'bg-[#E74C3C]/20',
        )}>
          <History className={cn('w-4 h-4', isImprove ? 'text-emerald-400' : 'text-[#E74C3C]')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-steel-100">{log.fieldLabel}</div>
          <div className="text-xs text-steel-300">
            {log.operatorName} · {formatDateTime(log.changedAt)}
          </div>
        </div>
        <div className={cn(
          'text-xs font-bold px-2 py-1 rounded-sm shrink-0',
          isImprove ? 'bg-emerald-900/40 text-emerald-400' : 'bg-[#E74C3C]/20 text-[#E74C3C]',
        )}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} ({pct.toFixed(0)}%)
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 bg-steel-700 rounded-sm px-3 py-2 text-center">
            <div className="text-[10px] text-steel-400 mb-0.5">原值</div>
            <div className="text-lg font-bold text-steel-300 line-through decoration-[#E74C3C]/70 decoration-2">
              {log.oldValue}
            </div>
          </div>
          <div className="shrink-0">
            <ArrowRight className="w-5 h-5 text-steel-400" />
          </div>
          <div className="flex-1 bg-emerald-900/20 rounded-sm px-3 py-2 text-center">
            <div className="text-[10px] text-emerald-400 mb-0.5">新值</div>
            <div className="text-lg font-bold text-emerald-400">{log.newValue}</div>
          </div>
        </div>
        <div className="border-t border-dashed border-steel-600 pt-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-semibold text-amber-400 mb-0.5">变更原因</div>
              <div className="text-sm text-steel-100">{log.reason}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BimClueBlock({ note }: { note: NoteBlock }) {
  return (
    <blockquote className="relative bg-steel-700 border border-steel-600 rounded-sm p-4 pl-6">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-steel-400 rounded-l-sm" />
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-steel-300 shrink-0" />
        <span className="text-xs font-bold text-steel-100">{note.authorName}</span>
        <span className="text-xs text-steel-300">{formatDateTime(note.createdAt)}</span>
      </div>
      <p className="text-sm text-steel-100 whitespace-pre-wrap leading-relaxed">{note.content}</p>
    </blockquote>
  );
}

export default function ChangeTracePage() {
  const { id } = useParams<{ id: string }>();
  const { drawings, changeLogs, notes } = useAppStore(
    useShallow((s) => ({
      drawings: s.drawings,
      changeLogs: s.changeLogs,
      notes: s.notes,
    })),
  );
  const drawing = drawings.find(d => d.id === id);

  const dChanges = useMemo(() =>
    changeLogs.filter(c => c.drawingId === id).sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    ), [changeLogs, id]);

  const dBimNotes = useMemo(() =>
    notes.filter(n => n.drawingId === id && n.isRawBimClue).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ), [notes, id]);

  const changeCounts = useMemo(() => {
    const counts: Record<keyof DrawingMetrics, number> = {
      collisionPoints: 0, unqualifiedItems: 0, sunShadowRisk: 0, volumeDeviation: 0,
    };
    for (const c of dChanges) counts[c.fieldName as keyof DrawingMetrics]++;
    return counts;
  }, [dChanges]);

  if (!drawing) {
    return <div className="p-8 text-center text-steel-300">图纸不存在</div>;
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-[#1A5276]/30 border border-[#3498DB] flex items-center justify-center">
          <Activity className="w-5 h-5 text-[#5DADE2]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-steel-100">变更溯源 · {drawing.name}</h1>
          <p className="text-sm text-steel-300">{drawing.projectNo} · {drawing.buildingName}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {(Object.keys(drawing.metrics) as (keyof DrawingMetrics)[]).map(k => (
          <MetricBadge
            key={k}
            label={METRIC_FIELD_LABELS[k]}
            value={drawing.metrics[k]}
            count={changeCounts[k]}
          />
        ))}
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-steel-300" />
          <h2 className="text-base font-bold text-steel-100">变更记录 ({dChanges.length})</h2>
          <span className="text-xs text-steel-400">按时间倒序</span>
        </div>
        {dChanges.length === 0 ? (
          <div className="bg-steel-800 rounded-sm border border-dashed border-steel-500 p-12 text-center">
            <History className="w-10 h-10 text-steel-400 mx-auto mb-3" />
            <div className="text-steel-300 text-sm">暂无变更记录</div>
          </div>
        ) : (
          <div className="space-y-4">
            {dChanges.map(c => <ChangeLogCard key={c.id} log={c} />)}
          </div>
        )}
      </div>

      <div className="bg-steel-700/40 rounded-sm p-5 border border-steel-600">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-sm bg-steel-500 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-steel-100" />
          </div>
          <div>
            <h2 className="text-base font-bold text-steel-100">BIM原始线索 · {dBimNotes.length}条</h2>
            <p className="text-xs text-[#E74C3C] font-medium">⚠ 处理异常时不可删除</p>
          </div>
        </div>
        {dBimNotes.length === 0 ? (
          <div className="bg-steel-800/50 rounded-sm p-8 text-center text-steel-400 text-sm italic">
            该图纸无BIM原始线索记录
          </div>
        ) : (
          <div className="space-y-3">
            {dBimNotes.map(n => <BimClueBlock key={n.id} note={n} />)}
          </div>
        )}
      </div>
    </div>
  );
}
