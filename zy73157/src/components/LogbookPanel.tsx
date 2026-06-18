import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { BookOpen, AlertTriangle, Ban, Wind, ChevronRight, User, Clock } from 'lucide-react';

export function LogbookPanel() {
  const {
    logbookEntries, highlightedLogbookId, setHighlightedLogbook,
    selectedAnomalyId, anomalies, driftEvents, selectedDriftId,
    setSelectedDrift, samples,
  } = useAppStore(useShallow((s) => ({
    logbookEntries: s.logbookEntries,
    highlightedLogbookId: s.highlightedLogbookId,
    setHighlightedLogbook: s.setHighlightedLogbook,
    selectedAnomalyId: s.selectedAnomalyId,
    anomalies: s.anomalies,
    driftEvents: s.driftEvents,
    selectedDriftId: s.selectedDriftId,
    setSelectedDrift: s.setSelectedDrift,
    samples: s.samples,
  })));

  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedLogbookId && lineRefs.current[highlightedLogbookId]) {
      lineRefs.current[highlightedLogbookId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLogbookId]);

  const selectedAnomaly = useMemo(() => anomalies.find((a) => a.id === selectedAnomalyId), [anomalies, selectedAnomalyId]);
  const selectedDrift = useMemo(() => driftEvents.find((d) => d.id === selectedDriftId), [driftEvents, selectedDriftId]);
  const withdrawnSamples = useMemo(() => samples.filter((s) => s.isWithdrawn), [samples]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel flex h-full flex-col">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <BookOpen size={14} />
          追溯链路 — 船上记录本 & 异常卡片
        </span>
        <span className="text-[11px] text-deepsea-300">共 {logbookEntries.length} 条记录</span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        <div className="space-y-2">
          {selectedAnomaly && (
            <div className="rounded-lg border border-status-blocked/40 bg-status-blocked/5 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <AlertTriangle size={14} className="text-status-blocked" />
                <span className="text-xs font-semibold text-status-blocked">异常记录 · {selectedAnomaly.id}</span>
                {selectedAnomaly.evidenceStatus === 'complete' && <span className="tag tag-processed">证据齐全</span>}
                {selectedAnomaly.evidenceStatus === 'partial' && <span className="tag tag-pending">待补证据</span>}
                {selectedAnomaly.evidenceStatus === 'none' && <span className="tag tag-blocked">卡着</span>}
              </div>
              <div className="text-sm text-deepsea-100">{selectedAnomaly.description}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-deepsea-300">
                <div>指标：{selectedAnomaly.metric}</div>
                <div>实测：<span className="font-mono text-status-blocked">{selectedAnomaly.value}</span> / 阈值：<span className="font-mono">{selectedAnomaly.threshold}</span></div>
                {selectedAnomaly.handler && <div>处理人：{selectedAnomaly.handler}</div>}
                {selectedAnomaly.nextAction && <div className="col-span-2 text-deepsea-200">下一步：{selectedAnomaly.nextAction}</div>}
              </div>
            </div>
          )}

          {selectedDrift && (
            <div className="rounded-lg border border-status-drift/40 bg-status-drift/5 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <Wind size={14} className="text-status-drift" />
                <span className="text-xs font-semibold text-status-drift">传感器漂移 · {selectedDrift.id}</span>
                {selectedDrift.corrected ? <span className="tag tag-processed">已校准</span> : <span className="tag tag-pending">未校准</span>}
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="text-deepsea-100">{selectedDrift.impact}</div>
                <div className="text-deepsea-300">根因：{selectedDrift.rootCause}</div>
                <div className="grid grid-cols-2 gap-2 text-deepsea-300">
                  <div>开始：{fmtTime(selectedDrift.startTimestamp)}</div>
                  <div>结束：{fmtTime(selectedDrift.endTimestamp)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-deepsea-700 p-2">
            <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] text-status-withdrawn">
              <Ban size={12} />
              <span className="font-medium">撤回记录专区（{withdrawnSamples.length}）</span>
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto scroll-thin">
              {withdrawnSamples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => s.withdrawLogbookId && setHighlightedLogbook(s.withdrawLogbookId)}
                  className="w-full rounded-md bg-status-withdrawn/8 px-2 py-1.5 text-left text-[11px] text-deepsea-100 ring-1 ring-inset ring-status-withdrawn/30 transition hover:bg-status-withdrawn/15"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{s.id}</span>
                    <span className="font-mono text-deepsea-300">{fmtTime(s.timestamp)}</span>
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-status-withdrawn">
                    {s.withdrawReason || '未注明原因'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-deepsea-700 p-2">
            <div className="mb-1.5 flex items-center gap-2 px-1 text-[11px] text-status-drift">
              <Wind size={12} />
              <span className="font-medium">漂移事件清单（{driftEvents.length}）</span>
            </div>
            <div className="space-y-1">
              {driftEvents.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDrift(d.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-[11px] transition ${
                    selectedDriftId === d.id
                      ? 'bg-status-drift/15 ring-1 ring-inset ring-status-drift/40'
                      : 'bg-deepsea-700/30 hover:bg-deepsea-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-deepsea-100">
                      {d.id} · {d.sensorType}
                    </span>
                    {d.corrected ? (
                      <span className="tag tag-processed">已校准</span>
                    ) : (
                      <span className="tag tag-blocked">未校准</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-deepsea-300">{fmtTime(d.startTimestamp)}–{fmtTime(d.endTimestamp)} · 漂移 ±{d.driftMagnitude}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-[460px] flex-col rounded-lg border border-deepsea-700 bg-deepsea-900/60">
          <div className="flex items-center justify-between border-b border-deepsea-700 px-3 py-2">
            <span className="text-[11px] font-medium text-deepsea-200">船上记录本 · 航海日志</span>
            {highlightedLogbookId && (
              <button
                onClick={() => setHighlightedLogbook(null)}
                className="text-[10px] text-deepsea-400 hover:text-deepsea-200"
              >
                清除高亮
              </button>
            )}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin">
            {logbookEntries.map((lb) => {
              const isHi = highlightedLogbookId === lb.id;
              return (
                <div
                  key={lb.id}
                  ref={(el) => (lineRefs.current[lb.id] = el)}
                  onClick={() => setHighlightedLogbook(lb.id)}
                  className={`logbook-line cursor-pointer transition ${
                    isHi
                      ? 'bg-status-processed/15 ring-1 ring-inset ring-status-processed/40'
                      : lb.recordType === 'withdraw'
                      ? 'bg-status-withdrawn/8 hover:bg-status-withdrawn/15'
                      : lb.recordType === 'note'
                      ? 'bg-deepsea-800/60 hover:bg-deepsea-700/60'
                      : 'hover:bg-deepsea-800/50'
                  }`}
                >
                  <div className="flex w-28 shrink-0 flex-col">
                    <span className="font-mono text-[11px] text-deepsea-300">
                      {lb.page} · L{lb.lineNumber.toString().padStart(2, '0')}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-deepsea-400">
                      <Clock size={10} />
                      {fmtTime(lb.timestamp)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className={`text-[12.5px] ${lb.recordType === 'withdraw' ? 'text-status-withdrawn font-bold' : lb.recordType === 'note' ? 'text-deepsea-100' : 'text-deepsea-200'}`}>
                      {lb.content}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-deepsea-400">
                      <span className="flex items-center gap-0.5">
                        <User size={9} />
                        {lb.recorder}
                      </span>
                      {lb.recordType === 'withdraw' && <span className="tag tag-withdrawn">撤回</span>}
                      {lb.recordType === 'note' && <span className="tag tag-pending">备注</span>}
                      {(lb.linkedAnomalyId || lb.linkedDriftId) && (
                        <ChevronRight size={10} className="text-status-processed" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
