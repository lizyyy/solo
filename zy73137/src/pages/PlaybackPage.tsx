import { AnomalyPanel } from "@/components/AnomalyPanel";
import { Header } from "@/components/Header";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { QuickStartCard } from "@/components/QuickStartCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineChart } from "@/components/TimelineChart";
import { TimelineController } from "@/components/TimelineController";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import {
  selectBuoyLogs,
  selectManualRecords,
  selectSupplementaryNotes,
  usePlaybackStore,
} from "@/store/usePlaybackStore";

function downloadJSON(name: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PlaybackPage() {
  const logs = selectBuoyLogs();
  const manual = selectManualRecords();
  const notes = selectSupplementaryNotes();
  const anomalies = usePlaybackStore((s) => s.anomalies);
  const history = usePlaybackStore((s) => s.history);
  const activeVersionTag = usePlaybackStore((s) => s.activeVersionTag);
  const triggerSupplementRerun = usePlaybackStore((s) => s.triggerSupplementRerun);
  const { fmtFull } = useTimeFormatter();

  const handleExport = () => {
    const activeVersion = history.find((h) => h.versionTag === activeVersionTag);
    downloadJSON(`coastal-water-playback-${activeVersionTag}-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      activeVersion: activeVersionTag,
      buoyLogs: logs,
      manualRecords: manual,
      supplementaryNotes: notes,
      anomalies,
      calculationSpec: activeVersion?.spec,
      history: history.map((h) => ({
        versionTag: h.versionTag,
        createdAt: h.createdAt,
        createdBy: h.createdBy,
        trigger: h.trigger,
        hasManualEdit: h.hasManualEdit,
        manualEditFields: h.manualEditFields,
        continuityReport: h.continuityReport,
        spec: h.spec,
      })),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <Header onExport={handleExport} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="absolute right-4 top-4 z-10 w-80">
                <QuickStartCard />
              </div>
              <TimelineChart />
            </div>
            <TimelineController />

            <div className="glass-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    事件列表
                  </h3>
                  <p className="text-xs text-ink-200">
                    点击事件进入详情，可查看浮标日志、计算口径与待确认原因
                  </p>
                </div>
                <button className="btn-primary" onClick={triggerSupplementRerun}>
                  补录后重跑（模拟）
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {anomalies.map((a) => (
                  <EventCard key={a.id} id={a.id} />
                ))}
              </ul>
            </div>
          </div>

          <div className="flex min-h-[600px] flex-col gap-4">
            <AnomalyPanel />
            <div className="glass-card p-4">
              <p className="text-xs text-ink-200">
                当前口径快照时间：
                <span className="ml-1 font-mono text-tide-400">
                  {fmtFull(history.find((h) => h.versionTag === activeVersionTag)?.spec.timestamp ?? 0)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      <HistoryDrawer />
    </div>
  );
}

function EventCard({ id }: { id: string }) {
  const anomalies = usePlaybackStore((s) => s.anomalies);
  const sel = usePlaybackStore((s) => s.selectedAnomalyId);
  const selectAnomaly = usePlaybackStore((s) => s.selectAnomaly);
  const { fmtFull } = useTimeFormatter();
  const a = anomalies.find((x) => x.id === id);
  if (!a) return null;
  const active = sel === a.id;
  return (
    <li
      className={`cursor-pointer rounded-xl border p-3 transition ${
        active
          ? "border-tide-500/50 bg-tide-500/10"
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
      onClick={() => selectAnomaly(a.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge
            kind={
              a.type === "anomaly"
                ? "anomaly"
                : a.confirmed
                  ? "ok"
                  : "pending"
            }
          />
          <span className="text-sm font-medium text-white">{a.reason}</span>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-300">
          {fmtFull(a.timestamp)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-ink-200">{a.detail}</p>
    </li>
  );
}
