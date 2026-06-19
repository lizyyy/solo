import { Grid3x3, Info } from "lucide-react";
import { AnomalyExplainer } from "@/components/anomaly/AnomalyExplainer";
import { CalcSpecBar } from "@/components/anomaly/CalcSpecBar";
import { PredictionHeatmap } from "@/components/heatmap/PredictionHeatmap";
import { SectionCard } from "@/components/ui/SectionCard";
import { useExplanationStore } from "@/store/useExplanationStore";

export default function ChartAnomaly() {
  const anomalyCount = useExplanationStore((s) => s.cells.filter((c) => c.anomaly).length);

  return (
    <div className="space-y-6">
      <PageHead
        icon={<Grid3x3 className="h-5 w-5" />}
        title="图表与异常"
        desc="预测评分矩阵热力图。异常置顶先讲清，点击即可回到评分备注与本次计算口径。"
        meta={`异常 ${anomalyCount} 项`}
      />

      <AnomalyExplainer />

      <CalcSpecBar />

      <SectionCard
        title="预测评分矩阵 · 矩阵分解重建"
        subtitle="行=用户，列=物品；色阶为预测评分，橙框脉冲=异常，红斜纹=单位缺失已隔离"
        icon={<Grid3x3 className="h-4 w-4" />}
        bodyClassName="overflow-x-auto"
      >
        <PredictionHeatmap />
        <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-mute">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          单元格右上角小圆点标注来源类型；单位缺失格不计入正常结果，点击异常格跳转评分备注。
        </p>
      </SectionCard>
    </div>
  );
}

export function PageHead({
  icon,
  title,
  desc,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-bg">
          {icon}
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold leading-tight text-ink">{title}</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-ink-soft">{desc}</p>
        </div>
      </div>
      {meta && (
        <span className="font-mono-data text-xs uppercase tracking-wider text-ink-mute">
          {meta}
        </span>
      )}
    </div>
  );
}
