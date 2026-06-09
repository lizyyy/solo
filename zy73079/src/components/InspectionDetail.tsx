import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  formatTime,
  getMetricStatus,
  statusLabel,
  statusColor,
  statusTextColor,
  metricLabel,
  metricUnit,
} from '../utils';
import {
  AlertTriangle,
  Thermometer,
  Activity,
  Gauge,
  Wrench,
  FileText,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react';

function MetricCard({
  icon: Icon,
  name,
  value,
  threshold,
  unit,
  colorClass,
}: {
  icon: any;
  name: string;
  value: number;
  threshold: number;
  unit: string;
  colorClass: string;
}) {
  const status = getMetricStatus(value, threshold);
  const pct = Math.min(100, (value / threshold) * 100);
  return (
    <div className={`rounded-lg border px-3 py-2.5 bg-slate-800/50 ${status === 'anomaly' ? 'border-red-500/50' : status === 'warning' ? 'border-amber-500/50' : 'border-slate-700'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
          <Icon size={13} className={colorClass} />
          {name}
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor(status)} text-white font-medium`}
        >
          {statusLabel(status)}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold text-slate-100" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {value.toFixed(1)}
        </span>
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
      <div className="mt-1.5 h-1 bg-slate-700 rounded overflow-hidden">
        <div
          className={`h-full transition-all ${statusColor(status)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
        <span>阈值 {threshold}{unit}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function ImpactBadge({ before, after }: { before: string; after: string }) {
  const iconMap: Record<string, any> = {
    normal: CheckCircle2,
    warning: MinusCircle,
    anomaly: XCircle,
  };
  const colorMap: Record<string, string> = {
    normal: 'text-emerald-400',
    warning: 'text-amber-400',
    anomaly: 'text-red-400',
  };
  const BIcon = iconMap[before] || MinusCircle;
  const AIcon = iconMap[after] || MinusCircle;
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs">
      <BIcon size={12} className={colorMap[before]} />
      <span className={colorMap[before]}>{statusLabel(before as any)}</span>
      <ArrowRight size={11} className="text-slate-500" />
      <AIcon size={12} className={colorMap[after]} />
      <span className={colorMap[after]}>{statusLabel(after as any)}</span>
    </div>
  );
}

export default function InspectionDetail() {
  const {
    selectedInspectionId,
    inspections,
    remarks,
    criterion,
    replacements,
    setActiveTab,
    toggleRemarkForm,
    setScrollToReportId,
  } = useAppStore();

  const selected = useMemo(
    () => inspections.find((i) => i.id === selectedInspectionId),
    [inspections, selectedInspectionId]
  );

  const relatedRemarks = useMemo(
    () => remarks.filter((r) => r.inspectionId === selectedInspectionId),
    [remarks, selectedInspectionId]
  );

  const relatedReplacements = useMemo(() => {
    if (!selected) return [];
    return replacements.filter((r) =>
      r.relatedInspectionIds.includes(selected.id)
    );
  }, [replacements, selected]);

  if (!selected) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm p-6">
        请在左侧图表中点击数据点，或在下方异常列表中选择一条记录
      </div>
    );
  }

  const reportAnchors = relatedRemarks
    .filter((r) => r.reportAnchorId)
    .map((r) => r.reportAnchorId!);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-4">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-slate-100 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                巡检记录详情
              </h3>
              {selected.isAlarm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-medium">
                  <AlertTriangle size={11} />
                  报警触发
                  {selected.alarmType ? ` · ${metricLabel(selected.alarmType)}` : ''}
                </span>
              )}
              {!selected.isAlarm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
                  正常巡检
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {formatTime(selected.inspectionTime)} · 设备 {selected.deviceId} · 巡检员 {selected.inspector}
            </p>
          </div>
          <button
            onClick={() => toggleRemarkForm()}
            className="px-3 py-1.5 text-xs rounded bg-orange-500 hover:bg-orange-600 text-white font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <FileText size={12} /> 补录备注
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
          <MetricCard
            icon={Thermometer}
            name="刀盘温度"
            value={selected.temperature}
            threshold={criterion.temperatureThreshold}
            unit={metricUnit('temperature')}
            colorClass="text-orange-400"
          />
          <MetricCard
            icon={Activity}
            name="振动值"
            value={selected.vibration}
            threshold={criterion.vibrationThreshold}
            unit={metricUnit('vibration')}
            colorClass="text-purple-400"
          />
          <MetricCard
            icon={Gauge}
            name="转速"
            value={selected.rotationSpeed}
            threshold={3}
            unit={metricUnit('rotationSpeed')}
            colorClass="text-sky-400"
          />
          <MetricCard
            icon={Wrench}
            name="刀具磨损"
            value={selected.cutterWear}
            threshold={criterion.wearThreshold}
            unit={metricUnit('cutterWear')}
            colorClass="text-blue-400"
          />
        </div>
      </div>

      {relatedReplacements.length > 0 && (
        <div className="rounded-lg border-2 border-orange-500/40 bg-orange-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold">
              <Wrench size={13} />
              关联备件型号替换（单独拎出，不混入正常巡检结果）
            </div>
            <button
              onClick={() => setActiveTab('replace')}
              className="text-[11px] text-orange-400 hover:text-orange-300 underline"
            >
              查看全部 →
            </button>
          </div>
          <div className="space-y-1.5">
            {relatedReplacements.map((rp) => (
              <div
                key={rp.id}
                className="text-xs bg-slate-800/80 rounded p-2 border border-slate-700"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-300 font-medium">{rp.partName}</span>
                  <span className="text-slate-500">·</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30`}>
                    型号变更
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-500 line-through">{rp.oldModel}</span>
                  <ArrowRight size={11} className="text-orange-400" />
                  <span className="text-orange-300">{rp.newModel}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  数据影响提示：{rp.dataImpactNote}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-slate-200 font-medium text-sm flex items-center gap-1.5">
            <FileText size={14} className="text-slate-400" />
            人工备注（{relatedRemarks.length}）
          </h4>
          {relatedRemarks.some((r) => r.isSupplementary) && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
              含补录备注
            </span>
          )}
        </div>
        {relatedRemarks.length === 0 ? (
          <p className="text-xs text-slate-500">暂无人工备注，可点击右上角"补录备注"新增</p>
        ) : (
          <div className="space-y-3">
            {relatedRemarks.map((r) => (
              <div
                key={r.id}
                className={`rounded border p-3 ${
                  r.isSupplementary
                    ? 'bg-amber-500/5 border-amber-500/40'
                    : 'bg-slate-900/40 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-300 font-medium">{r.author}</span>
                    {r.isSupplementary && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 font-medium">
                        换班前补录
                      </span>
                    )}
                    {r.judgementImpacts.length > 0 && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-medium">
                        已改变 {r.judgementImpacts.length} 项判断
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {formatTime(r.supplementaryTime || r.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {r.content}
                </p>
                {r.judgementImpacts.length > 0 && (
                  <div className="mt-2.5 space-y-1.5 pt-2 border-t border-slate-700/60">
                    <div className="text-[11px] text-slate-500 mb-1">
                      ▼ 此备注改变了以下归因判断：
                    </div>
                    {r.judgementImpacts.map((imp) => (
                      <div
                        key={imp.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-1.5 bg-slate-800/70 rounded p-2 text-xs"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 ${statusTextColor(imp.metric === 'overall' ? imp.afterStatus : 'warning')}`}>
                          {metricLabel(imp.metric)}
                        </span>
                        <ImpactBadge before={imp.beforeStatus} after={imp.afterStatus} />
                        <span className="text-slate-400 flex-1">理由：{imp.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
                {r.reportAnchorId && (
                  <div className="mt-2 pt-2 border-t border-slate-700/60">
                    <button
                      onClick={() => {
                        setActiveTab('report');
                        setTimeout(() => setScrollToReportId(r.reportAnchorId!), 100);
                      }}
                      className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
                    >
                      🔗 追溯到 Markdown 报告结论 →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {reportAnchors.length > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="text-xs text-blue-400 font-medium mb-1.5 flex items-center gap-1.5">
            🔗 历史备注追溯链（服务重启后仍可从 localStorage 恢复）
          </div>
          <div className="text-[11px] text-slate-400">
            本巡检记录共关联 <span className="text-blue-300 font-medium">{reportAnchors.length}</span> 处报告结论，切换至"报告结论"Tab可跳转查看。
          </div>
        </div>
      )}
    </div>
  );
}
