import { BookOpenCheck, AlertOctagon, GitBranch, ShieldAlert, Database } from "lucide-react";
import { useExplanationStore } from "@/store/useExplanationStore";
import { SOURCE_META, type NoteSourceType } from "@/types";
import { formatTime } from "@/utils/matrix";
import { SectionCard } from "@/components/ui/SectionCard";

export function GrayscaleExplainer() {
  const calcSpecs = useExplanationStore((s) => s.calcSpecs);
  const currentSpecId = useExplanationStore((s) => s.currentCalcSpecId);
  const cells = useExplanationStore((s) => s.cells);
  const notes = useExplanationStore((s) => s.notes);
  const unitMissing = useExplanationStore((s) => s.unitMissing);
  const calcSpec = calcSpecs.find((c) => c.id === currentSpecId)!;

  const anomalyCount = cells.filter((c) => c.anomaly).length;
  const influenceCount = notes.filter((n) => n.influencesConclusion).length;
  const activeQuarantine = unitMissing.filter((u) => !u.restored).length;

  const sourceLine = (["oldVersion", "normal", "verbal"] as NoteSourceType[])
    .map((s) => {
      const cnt = notes.filter((n) => n.sourceType === s).length;
      return `${SOURCE_META[s].label} ${cnt} 条`;
    })
    .join("；");

  const blocks = [
    {
      icon: Database,
      title: "这张图在算什么",
      body: `矩阵分解把"用户×物品"的评分矩阵拆成两组隐因子相乘，重建出每个格子的预测评分。本次用的是「${calcSpec.name}」：隐因子 k=${calcSpec.factors}、正则 ${calcSpec.regularization}、迭代 ${calcSpec.iterations} 轮。图里颜色越深，预测分越高。`,
    },
    {
      icon: AlertOctagon,
      title: "异常先讲清",
      body: `橙色脉冲框是异常格——预测和实际观测差得太多。当前共 ${anomalyCount} 项异常。点任意异常，能直接跳到对应的评分备注和这次用的计算口径，看到底是口径问题还是数据问题。`,
    },
    {
      icon: GitBranch,
      title: "数字从哪来",
      body: `每个关键数字旁边都有"来源"入口，沿"计算口径 → 评分备注 → 记录来源"三层追问。本次共 ${notes.length} 条备注（${sourceLine}），其中 ${influenceCount} 条被判定影响了结论。`,
    },
    {
      icon: ShieldAlert,
      title: "单位缺失单独拎出来",
      body: `红色斜纹格是"单位缺失"——比如外壳评分分不清是百分比还是计数。这类记录不揉进正常结果，单独隔离在隔离区，当前隔离 ${activeQuarantine} 项。补齐量纲后可"恢复为正常"。`,
    },
  ];

  return (
    <SectionCard
      title="灰度发布讲解 · 给不看代码的人"
      subtitle="用大白话把这套解释讲清楚，评审同事照着读即可"
      icon={<BookOpenCheck className="h-4 w-4" />}
    >
      <ol className="space-y-3">
        {blocks.map((b, i) => (
          <li key={b.title} className="flex gap-3 rounded-md border border-line bg-surface-2/40 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink font-mono-data text-xs font-semibold text-bg">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <b.icon className="h-4 w-4 text-ink-soft" />
                <h4 className="font-display text-sm font-semibold text-ink">{b.title}</h4>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 border-t border-line pt-3 font-mono-data text-[11px] text-ink-mute">
        口径更新于 {formatTime(calcSpec.createdAt)} · 历史备注持久于本地，重启不丢
      </p>
    </SectionCard>
  );
}
