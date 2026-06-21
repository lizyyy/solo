import { useEffect } from "react";
import { LeftPanel } from "@/components/workspace/LeftPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import { BottomBar } from "@/components/workspace/BottomBar";
import { ImportDrawer } from "@/components/workspace/ImportDrawer";
import { Scene3D } from "@/components/scene3d/Scene3D";
import { usePreviewStore } from "@/store/usePreviewStore";
import { VERSION_V1_ID, VERSION_V2_ID } from "@/data/sourceRows";

export default function Workbench() {
  const resetStore = usePreviewStore((s) => s.resetStore);
  const sourceRows = usePreviewStore((s) => s.sourceRows);
  const versions = usePreviewStore((s) => s.versions);

  useEffect(() => {
    if (!sourceRows.length && !versions.length) {
      resetStore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex">
        <LeftPanel />
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 relative">
            <Scene3D />
            <MondayStepsHint />
          </div>
        </main>
        <RightPanel />
      </div>
      <BottomBar />
      <ImportDrawer />
    </div>
  );
}

function MondayStepsHint() {
  const hasV1 = usePreviewStore((s) => s.hasImportedVersion(VERSION_V1_ID));
  const hasV2 = usePreviewStore((s) => s.hasImportedVersion(VERSION_V2_ID));

  return (
    <div className="absolute bottom-3 right-3 pointer-events-none max-w-sm bg-paper-100/95 backdrop-blur-sm border border-blueprint-300 px-3 py-2 shadow-eng-inset animate-slide-in-right">
      <div className="font-eng text-[9px] text-blueprint-500 tracking-[0.25em] mb-1">
        MONDAY · MORNING · CHECKLIST
      </div>
      <ol className="text-[10.5px] leading-relaxed text-steel-600 space-y-0.5 list-decimal list-inside marker:text-blueprint-500 marker:font-eng">
        <li className={hasV1 ? "line-through opacity-50" : ""}>
          <span className="font-semibold text-steel-700">步骤1</span>
          ：点击"导入旧材料"，V1 节点生成
        </li>
        <li className={hasV2 ? "line-through opacity-50" : hasV1 ? "" : "opacity-40"}>
          <span className="font-semibold text-steel-700">步骤2</span>
          ：点击"补录附件"，触发结论改判并留痕
        </li>
        <li className={hasV2 ? "" : "opacity-40"}>
          <span className="font-semibold text-steel-700">步骤3</span>
          ：左侧筛等级为严重 → 点"导出 CSV"
        </li>
      </ol>
      <div className="mt-1.5 pt-1.5 border-t border-dashed border-paper-300 text-[9.5px] text-steel-500 flex items-center gap-2">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasV2 ? "bg-fire-pass" : hasV1 ? "bg-fire-doubt" : "bg-blueprint-500"} animate-pulse`} />
        {hasV2
          ? "流程已完成 ✔ 可切时间轴查看改判前后对比"
          : hasV1
            ? "V1 已导入 · 请补录晚到附件继续步骤2"
            : "请按顺序执行 · 从步骤1导入旧材料开始"}
      </div>
    </div>
  );
}
