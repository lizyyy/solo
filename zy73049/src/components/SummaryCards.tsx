import { useMemo } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  Flame,
  FilterX,
} from "lucide-react";
import { useAppStore, SummaryFilter } from "@/store/useAppStore";

const FILTERS: { kind: SummaryFilter; label: string; key: keyof ReturnType<typeof useAppStore.getState>["lastAlgoResult"] extends never ? never : any }[] = [];

export function SummaryCards() {
  const result = useAppStore((s) => s.lastAlgoResult);
  const filterKind = useAppStore((s) => s.filterKind);
  const setFilterKind = useAppStore((s) => s.setFilterKind);

  const cards = useMemo(() => {
    const s = result?.summary;
    return [
      {
        kind: "anomalous" as SummaryFilter,
        label: "异常样本",
        value: s?.anomalous ?? 0,
        sub: `占比 ${s?.total ? ((s.anomalous / s.total) * 100).toFixed(1) : 0}%`,
        icon: AlertCircle,
        accent: "border-alert-red/60 text-alert-red",
        fill: "from-alert-red/10 to-transparent",
      },
      {
        kind: "boundary" as SummaryFilter,
        label: "边界/脏数据",
        value: s?.boundary ?? 0,
        sub: s?.boundary ? "需人工复核" : "暂未发现",
        icon: AlertTriangle,
        accent: "border-alert-amber/60 text-alert-amber",
        fill: "from-alert-amber/10 to-transparent",
      },
      {
        kind: "strong" as SummaryFilter,
        label: "强拉动",
        value: s?.strongPullCount ?? 0,
        sub: "反掩盖后单独拎出",
        icon: Flame,
        accent: "border-alert-orange/60 text-alert-orange",
        fill: "from-alert-orange/10 to-transparent",
      },
      {
        kind: "all" as SummaryFilter,
        label: "正常样本",
        value: s?.normal ?? 0,
        sub: `总 ${s?.total ?? 0} 条`,
        icon: Shield,
        accent: "border-alert-green/60 text-alert-green",
        fill: "from-alert-green/10 to-transparent",
      },
    ];
  }, [result]);

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const active = filterKind === c.kind;
        return (
          <button
            key={c.label}
            onClick={() =>
              setFilterKind(active ? ("all" as SummaryFilter) : c.kind)
            }
            style={{ animationDelay: `${i * 50}ms` }}
            className={`animate-stagger-in group relative text-left p-4 rounded border backdrop-blur-sm overflow-hidden transition
              ${active ? c.accent + " " + "bg-ink-800/80 shadow-lg scale-[1.02]" : "border-ink-700/60 bg-ink-800/40 hover:border-ink-600"}
            `}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${c.fill} pointer-events-none`}
            />
            <div className="relative flex items-start justify-between mb-3">
              <div
                className={`text-[11px] uppercase tracking-wider ${active ? c.accent.split(" ")[1] : "text-ink-600"}`}
              >
                {c.label}
              </div>
              <Icon
                size={16}
                className={active ? c.accent.split(" ")[1] : "text-ink-600"}
              />
            </div>
            <div className="relative flex items-baseline gap-2">
              <div className="font-serif text-3xl text-white">{c.value}</div>
              <div className="text-[11px] text-ink-600">{c.sub}</div>
            </div>
            <div className="relative mt-3 h-[2px] overflow-hidden rounded bg-ink-900/60">
              <div
                className={`h-full ${active ? "opacity-100" : "opacity-40"}`}
                style={{
                  width: `${c.kind === "all" ? 100 : Math.min(100, (c.value / Math.max(result?.summary.total ?? 1, 1)) * 100 * 3)}%`,
                  background:
                    c.kind === "all"
                      ? "#27A36E"
                      : c.kind === "anomalous"
                        ? "#D72638"
                        : c.kind === "boundary"
                          ? "#F59E0B"
                          : "#FF6B35",
                }}
              />
            </div>
          </button>
        );
      })}
      {filterKind !== "all" && (
        <button
          onClick={() => setFilterKind("all" as SummaryFilter)}
          className="col-span-4 flex items-center justify-center gap-1 py-2 text-xs text-ink-600 hover:text-white transition"
        >
          <FilterX size={12} /> 清除筛选，显示全部异常
        </button>
      )}
    </div>
  );
}
