import { ShieldCheck, RefreshCw, RotateCcw } from "lucide-react";
import { useExplanationStore, useLiveSummary } from "@/store/useExplanationStore";
import { SOURCE_META, type NoteSourceType } from "@/types";
import { formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { StatBlock } from "@/components/ui/StatBlock";

export function PageSummaryPanel() {
  const live = useLiveSummary();
  const snapshot = useExplanationStore((s) => s.summarySnapshot);
  const reverify = useExplanationStore((s) => s.reverify);
  const resetAll = useExplanationStore((s) => s.resetAll);

  const rows: { label: string; snap: number; live: number }[] = [
    { label: "总单元数", snap: snapshot?.totalCells ?? 0, live: live.totalCells },
    { label: "观测单元数", snap: snapshot?.observedCells ?? 0, live: live.observedCells },
    { label: "异常数", snap: snapshot?.anomalyCount ?? 0, live: live.anomalyCount },
    { label: "单位缺失（含已恢复）", snap: snapshot?.unitMissingCount ?? 0, live: live.unitMissingCount },
    { label: "单位缺失（隔离中）", snap: snapshot?.unitMissingActiveCount ?? 0, live: live.unitMissingActiveCount },
  ];
  (["oldVersion", "normal", "verbal"] as NoteSourceType[]).forEach((s) => {
    rows.push({
      label: `${SOURCE_META[s].label} 备注`,
      snap: snapshot?.notesBySource[s] ?? 0,
      live: live.notesBySource[s],
    });
  });

  const mismatchCount = rows.filter((r) => snapshot && r.snap !== r.live).length;
  const verified = snapshot && mismatchCount === 0;

  return (
    <SectionCard
      title="页面摘要 · 交叉印证"
      subtitle="当前状态 vs 上次印证的摘要基准，一致才算稳"
      icon={<ShieldCheck className="h-4 w-4" />}
      tone={verified ? "default" : "unit-missing"}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reverify}>
            重新印证
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => {
              if (window.confirm("重置为示例数据？将清空你本地新增的备注与隔离决策。")) resetAll();
            }}
            title="重置为示例数据"
          >
            重置
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="总单元" value={live.totalCells} />
        <StatBlock label="异常" value={live.anomalyCount} tone="anomaly" />
        <StatBlock label="隔离中" value={live.unitMissingActiveCount} tone="unit-missing" />
        <StatBlock label="影响结论备注" value={live.notesBySource.oldVersion + live.notesBySource.normal + live.notesBySource.verbal > 0 ? Object.values(live.conclusionInfluencingBySource).reduce((a, b) => a + b, 0) : 0} />
      </div>

      <div
        className={`mt-4 flex items-center gap-2 rounded-md border p-3 text-sm ${
          verified
            ? "border-normal/40 bg-normal-soft/40 text-normal"
            : "border-unit-missing/40 bg-unit-missing-soft/40 text-unit-missing"
        }`}
      >
        <ShieldCheck className="h-4 w-4" />
        {snapshot ? (
          verified ? (
            <span>印证一致。页面摘要基准（{formatTime(snapshot.lastSavedAt)}）与当前状态完全吻合。</span>
          ) : (
            <span>印证失败：{mismatchCount} 处不一致。当前状态已变更，建议"重新印证"刷新基准。</span>
          )
        ) : (
          <span>尚未建立印证基准，点"重新印证"建立。</span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono-data text-[10px] uppercase tracking-wider text-ink-mute">
              <th className="py-2 pr-4 font-normal">字段</th>
              <th className="py-2 pr-4 font-normal">摘要基准</th>
              <th className="py-2 pr-4 font-normal">当前状态</th>
              <th className="py-2 font-normal">状态</th>
            </tr>
          </thead>
          <tbody className="font-mono-data text-xs">
            {rows.map((r) => {
              const diff = snapshot && r.snap !== r.live;
              return (
                <tr key={r.label} className="border-b border-line/60">
                  <td className="py-1.5 pr-4 text-ink-soft">{r.label}</td>
                  <td className="py-1.5 pr-4 text-ink-mute">{snapshot ? r.snap : "—"}</td>
                  <td className={`py-1.5 pr-4 ${diff ? "font-semibold text-unit-missing" : "text-ink"}`}>
                    {r.live}
                  </td>
                  <td className="py-1.5">
                    {!snapshot ? (
                      <span className="text-ink-mute">—</span>
                    ) : diff ? (
                      <span className="text-unit-missing">不符</span>
                    ) : (
                      <span className="text-normal">一致</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
