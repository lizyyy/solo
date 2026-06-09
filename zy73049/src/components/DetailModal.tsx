import { useMemo } from "react";
import { X, Download, AlertTriangle, ExternalLink, Layers } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { selectRecordsByBin } from "@/utils/anomalyAlgo";
import { buildCsv, downloadCsv } from "@/utils/csvExport";
import { SAMPLE_PACKS, MATERIAL_BATCHES } from "@/data/mockData";
import type { DetectionRecord } from "@/data/types";

function fmtShortTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function DetailModal() {
  const selectedWindow = useAppStore((s) => s.selectedWindow);
  const selectWindow = useAppStore((s) => s.selectWindow);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectedRecordId = useAppStore((s) => s.selectedRecordId);
  const result = useAppStore((s) => s.lastAlgoResult);
  const thresholdMm = useAppStore((s) => s.thresholdMm);
  const packId = useAppStore((s) => s.packId);
  const pulseKey = useAppStore((s) => s.pulseKey);

  const records = useMemo<DetectionRecord[]>(() => {
    if (!result || !selectedWindow) return [];
    return selectRecordsByBin(result, selectedWindow);
  }, [result, selectedWindow]);

  const boundaryRecs = useMemo(
    () => records.filter((r) => r.status === "boundary"),
    [records],
  );
  const anomalousRecs = useMemo(
    () => records.filter((r) => r.status === "anomalous"),
    [records],
  );
  const normalRecs = useMemo(
    () =>
      records
        .filter((r) => r.status === "normal")
        .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
        .slice(0, 8),
    [records],
  );

  if (!selectedWindow) return null;

  const handleExport = () => {
    if (!result) return;
    const pack = SAMPLE_PACKS.find((p) => p.id === packId);
    const csv = buildCsv({
      result,
      thresholdMm,
      packName: pack?.name ?? packId,
    });
    downloadCsv(csv, packId, thresholdMm);
  };

  const rec = (id: string) => records.find((r) => r.id === id);
  const selected = selectedRecordId ? rec(selectedRecordId) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-stagger-in"
      onClick={() => {
        selectWindow(null);
        selectRecord(null);
      }}
    >
      <div
        key={pulseKey + selectedWindow}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[86vh] rounded-md border border-ink-700/70 bg-ink-900/95 backdrop-blur grain overflow-hidden flex flex-col shadow-2xl animate-stagger-in"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-ink-700/60">
          <div>
            <div className="flex items-center gap-2 text-ink-600 text-[11px] uppercase tracking-widest mb-1">
              <Layers size={12} /> 异常明细 · 时间窗口
            </div>
            <div className="font-serif text-2xl text-white leading-tight">
              {fmtShortTime(selectedWindow)}
              <span className="ml-4 text-sm text-ink-600 font-mono align-middle">
                当前阈值 {thresholdMm.toFixed(2)} mm · 共 {records.length} 条样本
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded border border-alert-orange/60 bg-alert-orange/10 text-alert-orange hover:bg-alert-orange/20 transition text-xs font-mono"
            >
              <Download size={14} /> 导出 CSV
            </button>
            <button
              onClick={() => {
                selectWindow(null);
                selectRecord(null);
              }}
              className="p-2 rounded border border-ink-700/60 text-ink-600 hover:text-white hover:border-ink-600 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-5">
          {boundaryRecs.length > 0 && (
            <div className="animate-breath-red rounded border border-alert-red/60 bg-gradient-to-br from-alert-red/15 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-sm bg-alert-red/30 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-alert-red" />
                </div>
                <div>
                  <div className="font-serif text-lg text-alert-red">
                    边界 / 脏数据 · {boundaryRecs.length} 条
                  </div>
                  <div className="text-[11px] text-ink-500 font-mono">
                    已被反掩盖算法单独拎出，未参与均值重算
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {boundaryRecs.map((r) => (
                  <BoundaryRow
                    key={r.id}
                    r={r}
                    active={selected?.id === r.id}
                    onSelect={() => selectRecord(selected?.id === r.id ? null : r.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {anomalousRecs.length > 0 && (
            <RecordsBlock
              title="异常样本"
              subtitle="超过阈值或强拉动样本"
              accent="text-alert-orange"
              records={anomalousRecs}
              thresholdMm={thresholdMm}
              activeId={selected?.id}
              onSelect={(id) => selectRecord(selected?.id === id ? null : id)}
            />
          )}

          {normalRecs.length > 0 && (
            <RecordsBlock
              title="正常样本（按拉动贡献排序）"
              subtitle="Top 8，显示贡献较大的正常记录供参考"
              accent="text-alert-green"
              records={normalRecs}
              thresholdMm={thresholdMm}
              activeId={selected?.id}
              onSelect={(id) => selectRecord(selected?.id === id ? null : id)}
              muted
            />
          )}

          {records.length === 0 && (
            <div className="text-center py-20 text-ink-600">该时间窗口下无记录</div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-ink-700/60 text-[11px] text-ink-600 flex items-center justify-between font-mono">
          <span>CSV 首行将打印：阈值、试样包、生成时间</span>
          <span>判定与页面完全一致 · 按贡献占比排序</span>
        </div>
      </div>
    </div>
  );
}

function BoundaryRow({
  r,
  active,
  onSelect,
}: {
  r: DetectionRecord;
  active: boolean;
  onSelect: () => void;
}) {
  const mat = MATERIAL_BATCHES[r.batchId];
  return (
    <button
      onClick={onSelect}
      className={`text-left grid grid-cols-[auto_1fr_auto] gap-4 items-center rounded px-3 py-2.5 border transition ${
        active
          ? "bg-alert-red/25 border-alert-red/80"
          : "bg-ink-900/40 border-alert-red/25 hover:border-alert-red/50"
      }`}
    >
      <div className="w-16">
        <div className="font-mono text-[11px] text-ink-600">检测时间</div>
        <div className="font-mono text-xs text-white">{fmtShortTime(r.detectTime)}</div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-white text-sm">
            raw = {r.rawValue.toFixed(3)} mm
          </span>
          <span className="px-1.5 py-0.5 rounded bg-alert-amber/20 text-alert-amber text-[10px] font-mono">
            {r.anomalyReason ?? "边界"}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-ink-800 text-ink-400 text-[10px] font-mono">
            批次 {r.batchId}
          </span>
          {mat?.notes && (
            <span className="text-[10px] text-ink-500 font-mono italic">
              材料备注：{mat.notes}
            </span>
          )}
        </div>
      </div>
      <span className="text-ink-600 hover:text-white flex items-center gap-1 text-[11px] font-mono">
        <ExternalLink size={12} /> 查看材料
      </span>
    </button>
  );
}

function RecordsBlock({
  title,
  subtitle,
  accent,
  records,
  thresholdMm,
  activeId,
  onSelect,
  muted,
}: {
  title: string;
  subtitle: string;
  accent: string;
  records: DetectionRecord[];
  thresholdMm: number;
  activeId: string | undefined;
  onSelect: (id: string) => void;
  muted?: boolean;
}) {
  const maxDev = Math.max(...records.map((r) => Math.abs(r.deviation ?? 0)), thresholdMm);
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className={`font-serif text-lg ${accent}`}>{title}</div>
          <div className="text-[11px] text-ink-600 font-mono">{subtitle}</div>
        </div>
        <div className="text-[11px] text-ink-600 font-mono">{records.length} 条</div>
      </div>
      <div
        className={`rounded border overflow-hidden ${
          muted ? "border-ink-700/40" : "border-ink-700/70"
        }`}
      >
        <div className="grid grid-cols-[90px_100px_1fr_120px_110px] gap-3 px-3 py-2 bg-ink-800/60 text-[10px] uppercase tracking-wider text-ink-600 font-mono">
          <div>时间</div>
          <div>检测值</div>
          <div>拉动因素</div>
          <div>判定</div>
          <div className="text-right pr-4">材料溯源</div>
        </div>
        {records.map((r, i) => {
          const mat = MATERIAL_BATCHES[r.batchId];
          const active = activeId === r.id;
          const contrPct = (r.contribution ?? 0) * 100;
          const devRatio = Math.min(100, (Math.abs(r.deviation ?? 0) / maxDev) * 100);
          const barColor =
            r.status === "boundary"
              ? "#F59E0B"
              : r.isStrongPull
                ? "#D72638"
                : r.status === "anomalous"
                  ? "#FF6B35"
                  : "#27A36E";
          return (
            <div
              key={r.id}
              onClick={() => onSelect(r.id)}
              style={{ animationDelay: `${i * 20}ms` }}
              className={`animate-stagger-in grid grid-cols-[90px_100px_1fr_120px_110px] gap-3 px-3 py-2.5 items-center border-t border-ink-800/60 cursor-pointer transition ${
                active ? "bg-ink-800/80" : i % 2 ? "bg-ink-900/30" : ""
              } hover:bg-ink-800/50`}
            >
              <div className="font-mono text-[11px] text-white/80">
                {fmtShortTime(r.detectTime)}
              </div>
              <div className="font-mono text-sm text-white">
                {r.rawValue.toFixed(3)}
                <span className="text-ink-600 text-[10px] ml-1">mm</span>
              </div>
              <div>
                <div className="relative h-1.5 rounded bg-ink-800 mb-1.5 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${devRatio}%`, background: barColor }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-ink-500">
                    偏离均值{" "}
                    <span className={r.deviation && r.deviation > 0 ? "text-alert-orange" : "text-alert-green"}>
                      {r.deviation && r.deviation >= 0 ? "+" : ""}
                      {(r.deviation ?? 0).toFixed(3)} mm
                    </span>
                  </span>
                  <span className="text-white/80">贡献 {contrPct.toFixed(1)}%</span>
                </div>
                {r.anomalyReason && (
                  <div className="mt-1 text-[10px] text-ink-600 italic font-mono">
                    · {r.anomalyReason}
                    {r.isStrongPull ? "（反掩盖已拎出）" : ""}
                  </div>
                )}
              </div>
              <div>
                {r.status === "anomalous" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-alert-orange/15 text-alert-orange text-[10px] font-mono border border-alert-orange/40">
                    {r.isStrongPull ? "强拉动异常" : "异常"}
                  </span>
                ) : r.status === "boundary" ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-alert-amber/15 text-alert-amber text-[10px] font-mono border border-alert-amber/40">
                    边界
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-alert-green/10 text-alert-green text-[10px] font-mono border border-alert-green/30">
                    正常
                  </span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(r.id);
                }}
                className="justify-self-end flex items-center gap-1 px-2 py-1 rounded border border-ink-700/60 text-ink-500 hover:text-white hover:border-alert-orange/60 hover:text-alert-orange transition text-[10px] font-mono"
              >
                <ExternalLink size={11} />
                {mat?.supplier?.slice(0, 4) ?? "材料"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
