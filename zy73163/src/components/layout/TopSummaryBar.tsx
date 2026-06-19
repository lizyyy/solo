import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, CircleDashed } from "lucide-react";
import { useExplanationStore, useLiveSummary } from "@/store/useExplanationStore";
import { SOURCE_META } from "@/types";
import { formatTime } from "@/utils/matrix";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type VerifyStatus = "empty" | "ok" | "stale" | "fail";

function compareSummaries(
  snap: ReturnType<typeof useLiveSummary> | null,
  live: ReturnType<typeof useLiveSummary>,
): { status: VerifyStatus; diffCount: number } {
  if (!snap) return { status: "empty", diffCount: 0 };
  let diff = 0;
  if (snap.totalCells !== live.totalCells) diff++;
  if (snap.observedCells !== live.observedCells) diff++;
  if (snap.anomalyCount !== live.anomalyCount) diff++;
  if (snap.unitMissingCount !== live.unitMissingCount) diff++;
  if (snap.unitMissingActiveCount !== live.unitMissingActiveCount) diff++;
  (["oldVersion", "normal", "verbal"] as const).forEach((s) => {
    if (snap.notesBySource[s] !== live.notesBySource[s]) diff++;
    if (snap.conclusionInfluencingBySource[s] !== live.conclusionInfluencingBySource[s]) diff++;
  });
  return { status: diff === 0 ? "ok" : "fail", diffCount: diff };
}

export function TopSummaryBar() {
  const live = useLiveSummary();
  const snapshot = useExplanationStore((s) => s.summarySnapshot);
  const reverify = useExplanationStore((s) => s.reverify);
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const currentSpecId = useExplanationStore((s) => s.currentCalcSpecId);

  const calcSpec = calcSpecs.find((c) => c.id === currentSpecId);
  const { status, diffCount } = compareSummaries(snapshot, live);

  // 首次进入若没有快照，自动印证一次，建立基准
  useEffect(() => {
    if (!snapshot) reverify();
  }, [snapshot, reverify]);

  const statusMeta: Record<
    VerifyStatus,
    { label: string; tone: string; icon: typeof CheckCircle2 }
  > = {
    empty: { label: "待印证", tone: "text-ink-mute", icon: CircleDashed },
    ok: { label: "印证一致", tone: "text-normal", icon: CheckCircle2 },
    stale: { label: "待重新印证", tone: "text-anomaly", icon: AlertTriangle },
    fail: { label: `印证失败 · ${diffCount} 处不符`, tone: "text-unit-missing", icon: AlertTriangle },
  };
  const meta = statusMeta[status];
  const StatusIcon = meta.icon;

  const sources = (["oldVersion", "normal", "verbal"] as const).map((s) => ({
    key: s,
    count: live.notesBySource[s],
    infl: live.conclusionInfluencingBySource[s],
  }));

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
            当前口径
          </span>
          <span className="font-display text-sm font-semibold text-ink">
            {calcSpec?.name ?? currentSpecId}
          </span>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {sources.map((s) => {
            const m = SOURCE_META[s.key];
            return (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: m.colorVar }}
                  title={m.label}
                />
                <span className="font-mono-data text-xs text-ink-soft">{s.count}</span>
                {s.infl > 0 && (
                  <span className="font-mono-data text-[10px] text-ink-mute">
                    /{s.infl}影响
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 font-mono-data text-xs">
          <Metric label="单元" value={live.totalCells} />
          <Metric label="观测" value={live.observedCells} />
          <Metric label="异常" value={live.anomalyCount} tone="anomaly" />
          <Metric label="单位缺失" value={live.unitMissingActiveCount} tone="unit-missing" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-atlas border border-line bg-surface-2 px-2 py-1 font-mono-data text-[11px]",
              meta.tone,
            )}
            title={
              status === "ok"
                ? "页面摘要与当前状态一致"
                : status === "fail"
                  ? "页面摘要与当前状态不符，请重新印证"
                  : "尚未建立印证基准"
            }
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {meta.label}
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3 w-3" />}
            onClick={reverify}
            title="用当前状态刷新页面摘要基准"
          >
            重新印证
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-line/60 px-6 py-1 font-mono-data text-[10px] text-ink-mute">
        <span>
          摘要基准（上次印证）：{snapshot ? formatTime(snapshot.lastSavedAt) : "—"}
        </span>
        <span>历史备注持久于本地 · 重启不丢</span>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "anomaly" | "unit-missing";
}) {
  const toneCls =
    tone === "anomaly" ? "text-anomaly" : tone === "unit-missing" ? "text-unit-missing" : "text-ink";
  return (
    <span className="flex items-center gap-1">
      <span className="text-ink-mute">{label}</span>
      <span className={cn("font-semibold", toneCls)}>{value}</span>
    </span>
  );
}
