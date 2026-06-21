import { AnomalyPanel } from "@/components/AnomalyPanel";
import { Header } from "@/components/Header";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { QuickStartCard } from "@/components/QuickStartCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TimelineChart } from "@/components/TimelineChart";
import { TimelineController } from "@/components/TimelineController";
import { useTimeFormatter } from "@/hooks/useTimeFormatter";
import { usePlaybackStore } from "@/store/usePlaybackStore";

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
  const { fmtFull, fmtHM } = useTimeFormatter();
  const buoyLogs = usePlaybackStore((s) => s.buoyLogs);
  const manualRecords = usePlaybackStore((s) => s.manualRecords);
  const supplementaryNotes = usePlaybackStore((s) => s.supplementaryNotes);
  const anomalies = usePlaybackStore((s) => s.anomalies);
  const history = usePlaybackStore((s) => s.history);
  const activeVersionTag = usePlaybackStore((s) => s.activeVersionTag);
  const timeRange = usePlaybackStore((s) => s.timeRange);

  const handleExport = () => {
    const activeVersion = history.find((h) => h.versionTag === activeVersionTag);
    const anomalySummaries = anomalies.map((a) => {
      const relatedLogs = buoyLogs.filter((l) => a.relatedBuoyLogIds.includes(l.id));
      const relatedManual = manualRecords.filter((m) => a.relatedManualIds.includes(m.id));
      const relatedNotes = supplementaryNotes.filter(
        (n) => a.timestamp >= n.relatedTimeRange[0] && a.timestamp <= n.relatedTimeRange[1],
      );
      const unitMixed = relatedLogs.some((l) => l.tideUnit === "cm") && !relatedLogs.every((l) => l._correctedFromCm);
      const pendingReasons: string[] = [];
      if (unitMixed) pendingReasons.push("潮位单位混写（m/cm）");
      if (a.type === "pending_confirmation") {
        pendingReasons.unshift(`系统自动检测：${a.reason}`);
      }
      return {
        id: a.id,
        timestamp: a.timestamp,
        reason: a.reason,
        detail: a.detail,
        status: a.confirmed ? "confirmed" : a.type === "pending_confirmation" ? "pending" : "anomaly",
        confirmedBy: a.confirmedBy ?? null,
        evidence: {
          buoyLogIds: a.relatedBuoyLogIds,
          buoyLogCount: relatedLogs.length,
          manualRecords: relatedManual.map((m) => ({ id: m.id, late: m.arrivedAt > m.recordedAt + 30 * 60000, operator: m.operator })),
          supplementaryNotes: relatedNotes.map((n) => ({ id: n.id, author: n.author, attachedAt: n.attachedAt })),
        },
        sources: [
          ...relatedLogs.map((l) => `浮标 ${l.id} @ ${fmtFull(l.timestamp)}`),
          ...relatedManual.map((m) => `人工记录 ${m.id} @ ${fmtFull(m.recordedAt)}`),
        ],
        pendingReasons,
      };
    });

    const manualEditVersions = history.filter((h) => h.hasManualEdit);

    const handoverSummary = {
      threeThingsForNextAnalyst: {
        whereIsSampleData: {
          buoyLogs: `${buoyLogs.length} 条（时间范围 ${fmtHM(timeRange[0])}–${fmtHM(timeRange[1])}）`,
          manualRecords: `${manualRecords.length} 条`,
          supplementaryNotes: `${supplementaryNotes.length} 条`,
        },
        whereIsAnomaly: anomalySummaries.map((a) => ({
          id: a.id,
          time: fmtFull(a.timestamp),
          status: a.status,
          reason: a.reason,
          pendingReasons: a.pendingReasons,
        })),
        howToDeliver: {
          activeVersion: activeVersionTag,
          activeSpecVersion: activeVersion?.spec.version ?? null,
          specFormula: activeVersion?.spec.formula ?? null,
          unitConversions: activeVersion?.spec.unitConversions ?? null,
          totalHistoryVersions: history.length,
          manualEditVersions: manualEditVersions.map((h) => ({
            versionTag: h.versionTag,
            createdBy: h.createdBy,
            trigger: h.trigger,
            manualEditFields: h.manualEditFields,
            createdAt: h.createdAt,
          })),
          exportedAt: new Date().toISOString(),
          filename: `coastal-water-playback-${activeVersionTag}.json`,
        },
      },
    };

    downloadJSON(`coastal-water-playback-${activeVersionTag}-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      activeVersion: activeVersionTag,
      handoverSummary,
      anomalyEvidenceSummary: anomalySummaries,
      calculationSpec: activeVersion?.spec,
      continuityReport: activeVersion?.continuityReport,
      manualEditTrail: history
        .filter((h) => h.hasManualEdit)
        .map((h) => ({
          versionTag: h.versionTag,
          createdAt: h.createdAt,
          createdBy: h.createdBy,
          trigger: h.trigger,
          manualEditFields: h.manualEditFields,
          specDelta: h.spec,
        })),
      buoyLogs,
      manualRecords,
      supplementaryNotes,
      anomalies,
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
                  <h3 className="font-display text-base font-semibold text-white">事件列表</h3>
                  <p className="text-xs text-ink-200">
                    点击事件进入详情，可查看浮标日志、晚到附件、计算口径与待确认原因；待确认事件可在右侧「补录后重跑」提交说明触发重算
                  </p>
                </div>
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
        active ? "border-tide-500/50 bg-tide-500/10" : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
      onClick={() => selectAnomaly(a.id)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge
            kind={a.type === "anomaly" ? "anomaly" : a.confirmed ? "ok" : "pending"}
          />
          <span className="text-sm font-medium text-white">{a.reason}</span>
          {a.confirmed && a.confirmedBy && (
            <span className="text-[10px] text-alert-green">由 {a.confirmedBy} 确认</span>
          )}
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-300">{fmtFull(a.timestamp)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-ink-200">{a.detail}</p>
    </li>
  );
}
