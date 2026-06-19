import { BookOpenCheck } from "lucide-react";
import { PageHead } from "./ChartAnomaly";
import { HandoverZones } from "@/components/handover/HandoverZones";
import { GrayscaleExplainer } from "@/components/handover/GrayscaleExplainer";
import { PageSummaryPanel } from "@/components/handover/PageSummaryPanel";

export default function Handover() {
  return (
    <div className="space-y-6">
      <PageHead
        icon={<BookOpenCheck className="h-5 w-5" />}
        title="交接与讲解"
        desc="算法值班人接手不问也知道：放材料、看异常、重新导出；灰度发布前能讲给不看代码的人听。"
      />

      <HandoverZones />

      <div className="grid gap-4 lg:grid-cols-2">
        <GrayscaleExplainer />
        <PageSummaryPanel />
      </div>
    </div>
  );
}
