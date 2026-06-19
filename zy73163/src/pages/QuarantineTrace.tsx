import { ShieldAlert } from "lucide-react";
import { PageHead } from "./ChartAnomaly";
import { QuarantineZone } from "@/components/quarantine/QuarantineZone";
import { ProvenancePanel } from "@/components/quarantine/ProvenancePanel";
import { ExportPanel } from "@/components/quarantine/ExportPanel";
import { useExplanationStore } from "@/store/useExplanationStore";

export default function QuarantineTrace() {
  const activeQuarantine = useExplanationStore(
    (s) => s.unitMissing.filter((u) => !u.restored).length,
  );

  return (
    <div className="space-y-6">
      <PageHead
        icon={<ShieldAlert className="h-5 w-5" />}
        title="隔离与溯源"
        desc="单位缺失记录单独隔离、不揉进正常结果；数字来源可逐层追溯；一键重新导出快照。"
        meta={`隔离中 ${activeQuarantine} 项`}
      />

      <QuarantineZone />

      <ProvenancePanel />

      <ExportPanel />
    </div>
  );
}
