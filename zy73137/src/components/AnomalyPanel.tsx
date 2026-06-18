import { useState } from "react";
import {
  CheckCircle2,
  FileText,
  ListChecks,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import { usePlaybackStore, selectBuoyLogs, selectManualRecords, selectSupplementaryNotes } from "@/store/usePlaybackStore";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import { StatusBadge } from "./StatusBadge";

type Tab = "buoy" | "spec" | "reason";

export function AnomalyPanel() {
  const {
    anomalies,
    selectedAnomalyId,
    selectAnomaly,
    confirmAnomaly,
    activeVersionTag,
    history,
    triggerSupplementRerun,
  } = usePlaybackStore();
  const buoyLogs = selectBuoyLogs();
  const manual = selectManualRecords();
  const notes = selectSupplementaryNotes();
  const { fmtFull, fmtDuration } = useTimeFormatter();
  const [tab, setTab] = useState<Tab>("buoy");

  const current = anomalies.find((a) => a.id === selectedAnomalyId) ?? anomalies[0];
  const ver = history.find((h) => h.versionTag === activeVersionTag);

  if (!current) return null;

  const relatedLogs = buoyLogs.filter((l) => current.relatedBuoyLogIds.includes(l.id));
  const relatedManual = manual.filter((m) => current.relatedManualIds.includes(m.id));
  const relatedNotes = notes.filter(
    (n) =>
      current.timestamp >= n.relatedTimeRange[0] &&
      current.timestamp <= n.relatedTimeRange[1],
  );

  return (
    <div className="glass-card flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-semibold text-white">
                事件详情
              </h2>
              <StatusBadge
                kind={current.type === "anomaly" ? "anomaly" : current.confirmed ? "ok" : "pending"}
                text={
                  current.type === "anomaly"
                    ? "异常"
                    : current.confirmed
                      ? "已确认"
                      : "待确认"
                }
              />
              <span className="chip font-mono text-xs text-tide-400">{current.reason}</span>
            </div>
            <p className="mt-1 text-xs text-ink-200">
              {fmtFull(current.timestamp)} · 严重度 {current.severity.toUpperCase()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {!current.confirmed && (
              <button className="btn-primary" onClick={() => confirmAnomaly(current.id)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> 确认处理
              </button>
            )}
            {current.type === "pending_confirmation" && (
              <button className="btn-ghost" onClick={triggerSupplementRerun}>
                <RefreshCw className="h-3.5 w-3.5" /> 补录后重跑
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-ink-100">
          {current.detail}
        </p>
      </div>

      <div className="flex gap-1 border-b border-white/10 px-2 pt-2">
        <button
          className={`tab-btn ${tab === "buoy" ? "active" : ""}`}
          onClick={() => setTab("buoy")}
        >
          <FileText className="inline h-3.5 w-3.5" /> 浮标日志
        </button>
        <button
          className={`tab-btn ${tab === "spec" ? "active" : ""}`}
          onClick={() => setTab("spec")}
        >
          <Scale className="inline h-3.5 w-3.5" /> 计算口径
        </button>
        <button
          className={`tab-btn ${tab === "reason" ? "active" : ""}`}
          onClick={() => setTab("reason")}
        >
          <ListChecks className="inline h-3.5 w-3.5" /> 待确认原因
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "buoy" && (
          <div className="space-y-4">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
              <Sparkles className="h-3.5 w-3.5 text-tide-400" /> 关联传感器记录 ({relatedLogs.length})
            </h4>
            <div className="space-y-2">
              {relatedLogs.map((l) => (
                <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-tide-400">{l.id}</span>
                    <StatusBadge
                      kind={
                        l.status === "error"
                          ? "anomaly"
                          : l.status === "warning"
                            ? "pending"
                            : "ok"
                      }
                    />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink-200">
                    {fmtFull(l.timestamp)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <Row label="溶解氧" value={`${l.dissolvedOxygen.toFixed(2)} mg/L`} />
                    <Row label="浊度" value={`${l.turbidity.toFixed(1)} NTU`} />
                    <Row label="pH" value={l.ph.toFixed(2)} />
                    <Row label="水温" value={`${l.temperature.toFixed(1)} ℃`} />
                    <Row
                      label="潮位"
                      value={`${l.tideLevel.toFixed(2)} ${l.tideUnit}`}
                      highlight={l.tideUnit === "cm"}
                    />
                    <Row label="设备" value={l.deviceId} />
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-ink-300 hover:text-white">
                      展开原始报文
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-ocean-950/70 p-2 font-mono text-[11px] leading-relaxed text-tide-300">
{l.rawPayload}
                    </pre>
                  </details>
                </div>
              ))}
            </div>

            {relatedManual.length > 0 && (
              <>
                <h4 className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" /> 关联人工记录 ({relatedManual.length})
                </h4>
                <div className="space-y-2">
                  {relatedManual.map((m) => {
                    const late = m.arrivedAt > m.recordedAt + 30 * 60000;
                    return (
                      <div
                        key={m.id}
                        className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-violet-300">{m.id}</span>
                          {late && <StatusBadge kind="late" text={`晚到 ${fmtDuration(m.arrivedAt - m.recordedAt)}`} />}
                        </div>
                        <p className="mt-1 text-xs text-ink-100">
                          <b>{m.operator}</b> @ {m.location}
                        </p>
                        <p className="font-mono text-[11px] text-ink-300">
                          采样 {fmtFull(m.recordedAt)} · 入库 {fmtFull(m.arrivedAt)}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <Row label="船采 DO" value={m.sampleDO != null ? `${m.sampleDO.toFixed(2)} mg/L` : "—"} />
                          <Row label="船采 浊度" value={m.sampleTurbidity != null ? `${m.sampleTurbidity.toFixed(1)} NTU` : "—"} />
                        </div>
                        <p className="mt-2 rounded-lg bg-ocean-950/60 p-2 text-[11px] leading-relaxed text-ink-100">
                          {m.remark}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {relatedNotes.length > 0 && (
              <>
                <h4 className="mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
                  <Sparkles className="h-3.5 w-3.5 text-alert-amber" /> 补充说明附件 ({relatedNotes.length})
                </h4>
                {relatedNotes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-alert-amber/20 bg-alert-amber/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-alert-amber">{n.author}</span>
                      <span className="font-mono text-[11px] text-ink-300">
                        {fmtFull(n.attachedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-100">{n.content}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === "spec" && ver && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">当前计算口径快照</h4>
                <span className="chip font-mono text-tide-400">{ver.spec.version}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-ink-300">
                生成时间 {fmtFull(ver.spec.timestamp)}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-ocean-950/70 p-3 font-mono text-[11px] leading-relaxed text-tide-300">
{ver.spec.formula}
              </pre>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-sm font-semibold text-white">参与字段</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ver.spec.involvedFields.map((f) => (
                  <span key={f} className="chip font-mono text-[11px] text-tide-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-sm font-semibold text-white">单位转换规则</h4>
              <div className="mt-2 space-y-1 text-xs">
                {Object.entries(ver.spec.unitConversions).map(([k, v]) => (
                  <Row key={k} label={k} value={v} mono />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <h4 className="text-sm font-semibold text-white">阈值区间</h4>
              <div className="mt-2 space-y-1 text-xs">
                {Object.entries(ver.spec.thresholds).map(([k, [lo, hi]]) => (
                  <Row key={k} label={k} value={`[${lo}, ${hi}]`} mono />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "reason" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-alert-amber/30 bg-alert-amber/10 p-4">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-alert-amber">
                <ListChecks className="h-4 w-4" /> 自动检测原因
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-100">{current.detail}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-ink-100">
                {current.relatedBuoyLogIds.map((id) => {
                  const log = buoyLogs.find((l) => l.id === id);
                  if (!log) return null;
                  return (
                    <li key={id} className="flex items-center gap-2">
                      <span className="font-mono text-tide-400">{id}</span>
                      <span className="text-ink-300">
                        {fmtFull(log.timestamp)}
                      </span>
                      <span className="font-mono">
                        tide = {log.tideLevel.toFixed(2)} {log.tideUnit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-semibold text-white">为什么进入待确认状态？</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-200">
                潮位字段在相邻记录中出现 <code className="rounded bg-ocean-950/60 px-1 py-0.5 font-mono text-tide-300">m</code> 与{" "}
                <code className="rounded bg-ocean-950/60 px-1 py-0.5 font-mono text-tide-300">cm</code>{" "}
                两种单位混用，系统无法确定是否为传感器上报错误或真实单位切换。为避免错把 2.12cm 当 2.12m 计算而放大 100 倍误差，
                自动将该时段标记为 <b className="text-alert-amber">待确认</b>，直到人工处理并触发重跑。
              </p>
            </div>

            {relatedNotes.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h4 className="text-sm font-semibold text-white">后续补充说明</h4>
                {relatedNotes.map((n) => (
                  <div key={n.id} className="mt-2 border-t border-white/5 pt-2">
                    <p className="text-xs font-semibold text-alert-amber">
                      {n.author} · {fmtFull(n.attachedAt)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-100">{n.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="text-sm font-semibold text-white">下一步处理建议</h4>
              <ol className="mt-2 space-y-1.5 text-xs text-ink-100">
                <li>1. 在「浮标日志」核对原始报文，确认 B-09/B-10 是否确实误写 cm。</li>
                <li>2. 若确认误写，点击「补录后重跑」，系统会把 cm 统一换算为 m (×0.01)。</li>
                <li>3. 重跑后在「历史版本」里对比口径变更，并确认无数据断档。</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] text-ink-300">
          事件 {current.id} · 口径版本 <span className="font-mono text-tide-400">{ver?.spec.version}</span>
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-300">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-alert-amber" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
