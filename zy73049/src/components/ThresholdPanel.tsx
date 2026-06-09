import { useMemo } from "react";
import { Settings2, CheckCircle2, AlertTriangle, CircleDot } from "lucide-react";
import { useAppStore, SAMPLE_PACKS } from "@/store/useAppStore";

const STEPS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0];

export function ThresholdPanel() {
  const thresholdMm = useAppStore((s) => s.thresholdMm);
  const setThreshold = useAppStore((s) => s.setThreshold);
  const packId = useAppStore((s) => s.packId);
  const setPackId = useAppStore((s) => s.setPackId);
  const pulseKey = useAppStore((s) => s.pulseKey);

  const pack = useMemo(
    () => SAMPLE_PACKS.find((p) => p.id === packId) ?? SAMPLE_PACKS[0],
    [packId],
  );

  const pct = useMemo(() => {
    const min = STEPS[0];
    const max = STEPS[STEPS.length - 1];
    return Math.max(0, Math.min(1, (thresholdMm - min) / (max - min)));
  }, [thresholdMm]);

  return (
    <aside className="h-full w-[300px] shrink-0 bg-ink-900/70 border-r border-ink-700/60 backdrop-blur-sm grain overflow-y-auto scrollbar-thin">
      <div className="p-5 border-b border-ink-700/60">
        <div className="flex items-center gap-2 text-ink-600 text-xs uppercase tracking-widest mb-4">
          <Settings2 size={14} /> 控制台
        </div>
        <h1 className="font-serif text-2xl leading-tight text-white">
          桥梁支座
          <br />
          <span className="text-alert-orange">异常归因</span>
        </h1>
      </div>

      <section className="p-5 border-b border-ink-700/60">
        <div className="text-xs text-ink-600 mb-2">试样包</div>
        <select
          value={packId}
          onChange={(e) => setPackId(e.target.value)}
          className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-alert-orange/70"
        >
          {SAMPLE_PACKS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.hasBoundary ? "（含边界样本）" : ""}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-600">
          {pack.description}
        </p>
      </section>

      <section className="p-5 border-b border-ink-700/60">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs text-ink-600">异常阈值（mm）</div>
          <div
            key={pulseKey}
            className="animate-stagger-in font-mono text-3xl text-alert-orange"
          >
            {thresholdMm.toFixed(2)}
          </div>
        </div>

        <div className="relative h-2 rounded-full bg-ink-800 mb-5">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${pct * 100}%`,
              background:
                "linear-gradient(90deg, #27A36E 0%, #F59E0B 60%, #D72638 100%)",
            }}
          />
          <input
            type="range"
            min={STEPS[0]}
            max={STEPS[STEPS.length - 1]}
            step={0.05}
            value={thresholdMm}
            onChange={(e) => setThreshold(+parseFloat(e.target.value).toFixed(2))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-5">
          {STEPS.map((s) => (
            <button
              key={s}
              onClick={() => setThreshold(s)}
              className={`px-1 py-1.5 text-[11px] font-mono rounded border transition ${
                Math.abs(thresholdMm - s) < 0.001
                  ? "bg-alert-orange/20 border-alert-orange/60 text-alert-orange"
                  : "bg-ink-800/40 border-ink-700/50 text-ink-600 hover:text-white hover:border-ink-600"
              }`}
            >
              {s.toFixed(1)}
            </button>
          ))}
        </div>

        <div className="space-y-2 text-[11px]">
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 size={12} className="text-alert-green" />
            已同步至图表水印
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 size={12} className="text-alert-green" />
            已同步至异常明细表头
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <CheckCircle2 size={12} className="text-alert-green" />
            已同步至 CSV 首行注释
          </div>
        </div>
      </section>

      <section className="p-5 text-[11px] text-ink-600 leading-relaxed space-y-2">
        <div className="flex items-center gap-2 text-white/70 mb-1">
          <AlertTriangle size={12} className="text-alert-amber" /> 判定说明
        </div>
        <p>
          超过 <span className="font-mono text-alert-orange">{thresholdMm.toFixed(2)} mm</span>
          或排除后组均值变化超过 15% 的强拉动样本会被标记为异常。
        </p>
        <div className="flex items-start gap-2 pt-1">
          <CircleDot size={12} className="text-alert-red mt-0.5 shrink-0" />
          <span>
            边界样本：偏差落在阈值 ±5% 带内或字段异常的记录，单独放在明细顶部供人工复核。
          </span>
        </div>
      </section>
    </aside>
  );
}
