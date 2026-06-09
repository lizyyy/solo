import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ShieldCheck,
  User,
  CalendarClock,
  Zap,
  Target,
} from 'lucide-react';
import { formatTime, metricLabel, statusTextColor } from '../utils';

const STATUS_META = {
  pending: {
    label: '待确认',
    icon: CircleHelp,
    bar: 'bg-amber-500',
    border: 'border-amber-500/40',
    chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  confirmed: {
    label: '已确认',
    icon: ShieldCheck,
    bar: 'bg-red-500',
    border: 'border-red-500/40',
    chip: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  clarified: {
    label: '已澄清',
    icon: CheckCircle2,
    bar: 'bg-emerald-500',
    border: 'border-emerald-500/40',
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
} as const;

export default function AnomalyList() {
  const {
    attributions,
    inspections,
    remarks,
    selectedAnomalyId,
    setSelectedAnomaly,
    setSelectedInspection,
    confirmAnomaly,
    clarifyAnomalyByRemark,
    criterion,
  } = useAppStore();

  const sorted = useMemo(
    () =>
      [...attributions].sort((a, b) => {
        const ia = inspections.find((i) => i.id === a.inspectionId);
        const ib = inspections.find((i) => i.id === b.inspectionId);
        return (ib?.inspectionTime || 0) - (ia?.inspectionTime || 0);
      }),
    [attributions, inspections]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 flex-wrap gap-2">
        <div>
          <h3 className="text-slate-100 font-semibold tracking-wide text-sm flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            <AlertTriangle size={15} className="text-red-400" />
            异常归因记录
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            共 {attributions.length} 条 · 待确认 {attributions.filter((a) => a.status === 'pending').length} · 已澄清 {attributions.filter((a) => a.status === 'clarified').length}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${STATUS_META.pending.chip}`}>待确认</span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${STATUS_META.confirmed.chip}`}>已确认</span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${STATUS_META.clarified.chip}`}>已澄清</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            暂无异常归因记录
          </div>
        )}
        {sorted.map((a) => {
          const insp = inspections.find((i) => i.id === a.inspectionId);
          const clarRemark = a.clarifiedRemarkId
            ? remarks.find((r) => r.id === a.clarifiedRemarkId)
            : null;
          const meta = STATUS_META[a.status];
          const Icon = meta.icon;
          const isSelected = a.id === selectedAnomalyId;
          return (
            <div
              key={a.id}
              onClick={() => {
                setSelectedAnomaly(a.id);
                if (insp) setSelectedInspection(insp.id);
              }}
              className={`relative cursor-pointer rounded-lg border-l-4 ${meta.bar} ${meta.border} bg-slate-800/50 p-3 transition hover:bg-slate-800 ${
                isSelected ? 'ring-2 ring-yellow-400/50 bg-slate-800' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${meta.chip}`}>
                    <Icon size={11} />
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-200 font-medium">{a.anomalyType}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-700 ${statusTextColor(a.status === 'clarified' ? 'normal' : a.status === 'confirmed' ? 'anomaly' : 'warning')}`}>
                    {metricLabel(a.relatedMetric)}指标
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={11} className="text-slate-500" />
                  <span className="text-[10px] text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    置信度 {a.confidence}%
                  </span>
                </div>
              </div>

              {insp && (
                <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-2 flex-wrap">
                  <span className="inline-flex items-center gap-0.5">
                    <CalendarClock size={10} />
                    {formatTime(insp.inspectionTime)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <User size={10} />
                    {insp.inspector}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-blue-400">
                    <Target size={10} />
                    口径 {a.calculationVersion}
                  </span>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed mb-2">{a.rootCause}</p>

              {clarRemark && (
                <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-300">
                  ✅ 已通过备注澄清：{clarRemark.content.slice(0, 60)}
                  {clarRemark.content.length > 60 ? '…' : ''}
                </div>
              )}

              {a.status === 'pending' && (
                <div className="flex gap-2 mt-2.5 pt-2 border-t border-slate-700/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmAnomaly(a.id, '维保主管-阿敏');
                    }}
                    className="flex-1 px-2 py-1.5 text-[11px] rounded bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition"
                  >
                    确认为异常
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const lastRemark = remarks
                        .filter((r) => r.inspectionId === a.inspectionId)
                        .slice(-1)[0];
                      if (lastRemark) {
                        clarifyAnomalyByRemark(a.id, lastRemark.id, '维保主管-阿敏');
                      } else {
                        alert('请先在右侧详情页为该巡检记录补录备注，再通过备注澄清。');
                      }
                    }}
                    className="flex-1 px-2 py-1.5 text-[11px] rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition"
                  >
                    用备注澄清
                  </button>
                </div>
              )}

              {a.confirmedBy && a.confirmedAt && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500">
                  {a.status === 'confirmed' ? '确认人' : '澄清人'}：{a.confirmedBy} · {formatTime(a.confirmedAt)}
                  <span className="ml-2 text-slate-600">（口径：{criterion.version}）</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
