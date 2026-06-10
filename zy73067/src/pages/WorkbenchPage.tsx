import { useState } from "react";
import SummaryCards from "@/components/workbench/SummaryCards";
import FilterBar from "@/components/workbench/FilterBar";
import AlertTable from "@/components/workbench/AlertTable";
import DetailDrawer from "@/components/workbench/DetailDrawer";
import ProgressRestoreBar from "@/components/workbench/ProgressRestoreBar";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useReviewStore } from "@/store/reviewStore";
import type { StatusFilter } from "@/types";

export default function WorkbenchPage() {
  const { attachScrollListener } = useAutoSave();
  const { targetRef, showBanner, dismissBanner } = useScrollRestore();
  const pageSnapshot = useReviewStore((s) => s.pageSnapshot);

  const [activeFilter, setActiveFilter] = useState<StatusFilter | "temp">("all");

  return (
    <div className="space-y-5">
      <ProgressRestoreBar
        visible={showBanner}
        onDismiss={dismissBanner}
        timestamp={pageSnapshot?.timestamp}
      />

      <div>
        <h2 className="text-2xl font-bold text-industrial-800 mb-1">
          风机叶片阈值预警 · 复核工作台
        </h2>
        <p className="text-sm text-gray-500">
          维保主管阿敏，服务重启后自动接上上次进度 · 设备编号自动归一化 · 临时阈值单独拎出
        </p>
      </div>

      <SummaryCards activeFilter={activeFilter} onActiveChange={setActiveFilter} />

      <FilterBar />

      <div
        ref={(el) => {
          attachScrollListener(el);
          if (targetRef) targetRef.current = el;
        }}
        className="max-h-[calc(100vh-380px)] overflow-y-auto pr-1"
      >
        <AlertTable />
      </div>

      <DetailDrawer />
    </div>
  );
}
