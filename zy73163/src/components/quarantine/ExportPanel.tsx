import { Download, FileDown, History, CheckCircle2 } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";

export function ExportPanel() {
  const exports = useExplanationStore((s) => s.exports);
  const exportSnapshot = useExplanationStore((s) => s.exportSnapshot);
  const notes = useExplanationStore((s) => s.notes);
  const cells = useExplanationStore((s) => s.cells);
  const unitMissing = useExplanationStore((s) => s.unitMissing);
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const currentSpecId = useExplanationStore((s) => s.currentCalcSpecId);

  const doExport = () => {
    const snap = exportSnapshot();
    const calcSpec = calcSpecs.find((c) => c.id === currentSpecId);
    const payload = {
      exportedAt: snap.createdAt,
      calcSpec,
      summary: snap.summary,
      notes,
      unitMissing,
      anomalyCells: cells.filter((c) => c.anomaly).map((c) => ({
        userId: c.userId,
        itemId: c.itemId,
        predicted: c.predictedRating,
        actual: c.actualRating,
        error: c.error,
        reason: c.anomalyReason,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mf-atlas-snapshot-${snap.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SectionCard
      title="重新导出"
      subtitle="把当前解释（含备注、口径、隔离、异常）打包成快照，供灰度发布评审"
      icon={<FileDown className="h-4 w-4" />}
      action={
        <Button size="sm" variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={doExport}>
          导出快照
        </Button>
      }
    >
      <div className="flex items-start gap-2 rounded-md border border-line bg-surface-2/50 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-normal" />
        <p className="text-xs text-ink-soft">
          导出会同时刷新顶部"页面摘要"印证基准（重新印证），并下载一份 JSON 快照。快照含本次口径、所有备注、隔离记录与异常清单，可直接交给不看代码的评审同事。
        </p>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
          <History className="h-3 w-3" />
          导出历史（{exports.length}）
        </div>
        <ul className="space-y-1.5">
          {exports.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-atlas border border-line bg-surface-2/40 px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono-data text-[11px] text-ink-soft">{e.id}</span>
                <span className="text-xs text-ink-mute">·</span>
                <span className="text-xs text-ink-soft">{e.calcSpecName}</span>
              </div>
              <div className="flex items-center gap-3 font-mono-data text-[11px] text-ink-mute">
                <span>备注 {e.noteCount}</span>
                <span>异常 {e.summary.anomalyCount}</span>
                <span>{formatTime(e.createdAt)}</span>
              </div>
            </li>
          ))}
          {exports.length === 0 && (
            <li className="rounded-md border border-dashed border-line py-5 text-center text-xs text-ink-mute">
              还没有导出记录
            </li>
          )}
        </ul>
      </div>
    </SectionCard>
  );
}
