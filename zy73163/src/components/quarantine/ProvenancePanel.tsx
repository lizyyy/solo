import { GitBranch, HelpCircle } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { SOURCE_META, type NoteSourceType } from "@/types";
import { cellKeyOf, formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";
import { ProvenanceChip } from "@/components/ui/ProvenanceChip";

export function ProvenancePanel() {
  const cells = useExplanationStore((s) => s.cells);
  const notes = useExplanationStore((s) => s.notes);
  const unitMissing = useExplanationStore((s) => s.unitMissing);
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const currentSpecId = useExplanationStore((s) => s.currentCalcSpecId);
  const calcSpec = calcSpecs.find((c) => c.id === currentSpecId)!;

  const anomalies = cells.filter((c) => c.anomaly);
  const anomalyCellsNotes = notes.filter((n) =>
    anomalies.some((a) => n.cellKey === `${a.userId}:${a.itemId}`),
  );
  const activeQuarantine = unitMissing.filter((u) => !u.restored);
  const influenceNotes = notes.filter((n) => n.influencesConclusion);

  const figures: {
    label: string;
    value: string;
    trail: string;
    calcSpecId?: string;
    notes: typeof notes;
    sourceType?: NoteSourceType;
    plain: string;
  }[] = [
    {
      label: "异常总数",
      value: String(anomalies.length),
      trail: "异常格 → 相关备注",
      notes: anomalyCellsNotes,
      plain: "预测与观测偏离超阈值的格子数，来自当前口径下的矩阵分解重建。",
    },
    {
      label: "影响结论的备注",
      value: String(influenceNotes.length),
      trail: "按来源统计",
      notes: influenceNotes,
      plain: "被勾选为「影响本次结论」的备注数，按旧版/正常/口头三类来源汇总。",
    },
    {
      label: "单位缺失（隔离中）",
      value: String(activeQuarantine.length),
      trail: "隔离区记录",
      notes: notes.filter((n) =>
        activeQuarantine.some((u) => n.cellKey === u.cellKey),
      ),
      plain: "因缺量纲被单独隔离、不计入正常结果的记录数。",
    },
  ];

  return (
    <SectionCard
      title="数字溯源线索 · 数字从哪来"
      subtitle="给不看代码的人：每个关键数字都能沿口径→备注→记录逐层追问"
      icon={<GitBranch className="h-4 w-4" />}
    >
      <ul className="space-y-3">
        {figures.map((f) => (
          <li
            key={f.label}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2/50 p-3"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono-data text-2xl font-semibold text-ink">{f.value}</span>
              <span className="text-sm text-ink-soft">{f.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <ProvenanceChip
                label={f.trail}
                calcSpec={calcSpec}
                notes={f.notes}
                sourceType={f.sourceType}
              />
            </div>
            <p className="basis-full text-xs text-ink-mute">{f.plain}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-md border border-dashed border-line p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink">
          <HelpCircle className="h-3.5 w-3.5 text-ink-mute" />
          一句话讲清（给非代码者）
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">
          本次结论建立在口径「{calcSpec.name}」之上，共 {notes.length} 条评分备注
          （{(["oldVersion", "normal", "verbal"] as NoteSourceType[])
            .map((s) => `${SOURCE_META[s].short} ${notes.filter((n) => n.sourceType === s).length}`)
            .join("、")}
          ），其中 {influenceNotes.length} 条被判定影响结论；
          另有 {activeQuarantine.length} 条单位缺失记录已隔离、不进正常结果。任意数字点"来源"即可看到它由哪条口径、哪些备注支撑。
          <span className="mt-1 block font-mono-data text-[11px] text-ink-mute">
            口径更新于 {formatTime(calcSpec.createdAt)}
          </span>
        </p>
      </div>
    </SectionCard>
  );
}
