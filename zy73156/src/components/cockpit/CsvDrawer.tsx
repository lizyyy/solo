import { ArrowDownToLine, ChevronDown, Table2, X } from "lucide-react";
import { useMemo } from "react";
import { READING_STATUS_META } from "@/data/types";
import { buildCsv, downloadCsv } from "@/lib/csv";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFilteredSamples, useOceanStore } from "@/store/useOceanStore";
import { GlassPanel } from "@/components/ui/Primitives";

export default function CsvDrawer() {
  const csvOpen = useOceanStore((s) => s.csvOpen);
  const toggleCsv = useOceanStore((s) => s.toggleCsv);
  const timeIndex = useOceanStore((s) => s.timeIndex);
  const filtered = useFilteredSamples();

  const rows = useMemo(
    () =>
      filtered.map((s) => {
        const r = s.readings[timeIndex];
        return {
          id: s.id,
          code: s.code,
          station: s.label,
          type: s.anomalyTypeLabel,
          time: r?.timeLabel ?? "-",
          value: r?.value ?? 0,
          avg: r?.avg ?? 0,
          max: r?.max ?? 0,
          min: r?.min ?? 0,
          drift: r?.drift ?? 0,
          status: r?.status ?? "normal",
        };
      }),
    [filtered, timeIndex],
  );

  const handleExport = () => {
    const csv = buildCsv(filtered);
    downloadCsv(`deep-sea-sampling-${Date.now()}.csv`, csv);
  };

  const hiddenByAvg = rows.filter((r) => r.value > r.avg * 1.04 || r.value < r.avg * 0.96).length;

  return (
    <>
      {/* collapsed trigger */}
      <button
        onClick={toggleCsv}
        className={cn(
          "absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-glow-cyan/30 bg-abyss-900/90 px-3 py-2 font-mono text-[11px] text-glow-cyan shadow-glow backdrop-blur-xl transition hover:bg-glow-cyan/15",
          csvOpen && "opacity-0 pointer-events-none",
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        CSV 明细
        <span className="rounded bg-glow-cyan/15 px-1.5 text-[9px]">{rows.length}</span>
      </button>

      {/* drawer */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 transition-transform duration-300",
          csvOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <GlassPanel className="rounded-b-none border-b-0">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-glow-cyan" />
              <span className="hud-label">CSV 明细 · 当前时刻 {rows[0]?.time ?? "--"}</span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                {rows.length} 条记录
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-lg border border-glow-cyan/40 bg-glow-cyan/10 px-2.5 py-1 font-mono text-[10px] text-glow-cyan transition hover:bg-glow-cyan/20"
              >
                <ArrowDownToLine className="h-3 w-3" /> 导出 CSV
              </button>
              <button
                onClick={toggleCsv}
                className="rounded-lg border border-white/10 p-1 text-slate-400 transition hover:bg-white/10"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[34vh] overflow-auto px-2 py-2">
            <table className="w-full border-collapse font-mono text-[10px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-2 py-1 font-medium">采样编号</th>
                  <th className="px-2 py-1 font-medium">站点</th>
                  <th className="px-2 py-1 font-medium">异常类型</th>
                  <th className="px-2 py-1 text-right font-medium">读数</th>
                  <th className="px-2 py-1 text-right font-medium">平均值</th>
                  <th className="px-2 py-1 text-right font-medium">最大值</th>
                  <th className="px-2 py-1 text-right font-medium">最小值</th>
                  <th className="px-2 py-1 text-right font-medium">漂移</th>
                  <th className="px-2 py-1 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = READING_STATUS_META[r.status as keyof typeof READING_STATUS_META];
                  const deviates = r.value > r.avg * 1.04 || r.value < r.avg * 0.96;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-white/[0.04] text-slate-300 hover:bg-white/[0.03]"
                    >
                      <td className="px-2 py-1.5 font-semibold text-slate-200">{r.code}</td>
                      <td className="px-2 py-1.5 text-slate-400">{r.station}</td>
                      <td className="px-2 py-1.5 text-slate-400">{r.type}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5 text-right font-bold tabular-nums",
                          deviates ? "text-warn-amber" : "text-slate-200",
                        )}
                      >
                        {fmtNum(r.value)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                        {fmtNum(r.avg)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
                        {fmtNum(r.max)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
                        {fmtNum(r.min)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
                        {fmtNum(r.drift)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={cn("flex items-center gap-1", meta.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hiddenByAvg > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-warn-amber/30 bg-warn-amber/[0.06] px-3 py-2 font-mono text-[9px] text-warn-amber">
                <X className="h-3 w-3" />
                {hiddenByAvg} 条记录的读数偏离平均值 ±4%，平均值报告会掩盖这些风险——明细已标红。
              </div>
            )}
          </div>
        </GlassPanel>
      </div>
    </>
  );
}
