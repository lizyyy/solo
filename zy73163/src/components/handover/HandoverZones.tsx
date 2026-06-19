import { useNavigate } from "react-router-dom";
import { StickyNote, Grid3x3, FileDown, ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

const ZONES = [
  {
    to: "/notes",
    title: "哪里放材料",
    icon: StickyNote,
    desc: "评分备注与材料页。新增备注、投放材料、标注边界样本直觉，都从这里进。",
    step: "1",
  },
  {
    to: "/",
    title: "哪里看异常",
    icon: Grid3x3,
    desc: "图表与异常页。进来先看置顶异常解释，点击异常即可回到备注与本次计算口径。",
    step: "2",
  },
  {
    to: "/quarantine",
    title: "哪里重新导出",
    icon: FileDown,
    desc: "隔离与溯源页。单位缺失隔离、数字溯源、一键导出快照供灰度评审。",
    step: "3",
  },
];

export function HandoverZones() {
  const navigate = useNavigate();
  return (
    <SectionCard
      title="交接三区 · 不问也知道"
      subtitle="算法值班人接手时，按这三步就能上手，不用问任何人"
    >
      <div className="grid gap-3 md:grid-cols-3">
        {ZONES.map((z) => (
          <button
            key={z.to}
            onClick={() => navigate(z.to)}
            className="group flex flex-col rounded-md border border-line bg-surface-2/40 p-4 text-left transition-colors hover:border-ink-mute hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-bg">
                <z.icon className="h-4 w-4" />
              </span>
              <span className="font-display text-3xl font-semibold text-line-strong">
                {z.step}
              </span>
            </div>
            <h4 className="mt-3 font-display text-base font-semibold text-ink">{z.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{z.desc}</p>
            <span className="mt-3 flex items-center gap-1 font-mono-data text-[11px] uppercase tracking-wider text-ink-mute group-hover:text-ink">
              前往 <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
