import { useEffect } from "react";
import { LeftPanel } from "@/components/workspace/LeftPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import { BottomBar } from "@/components/workspace/BottomBar";
import { ImportDrawer } from "@/components/workspace/ImportDrawer";
import { Scene3D } from "@/components/scene3d/Scene3D";
import { usePreviewStore } from "@/store/usePreviewStore";

export default function Workbench() {
  const init = usePreviewStore((s) => s.initMondayScenario);
  const sourceRows = usePreviewStore((s) => s.sourceRows);

  useEffect(() => {
    if (!sourceRows.length) init();
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
  return (
    <div className="absolute bottom-3 right-3 pointer-events-none max-w-sm bg-paper-100/95 backdrop-blur-sm border border-blueprint-300 px-3 py-2 shadow-eng-inset animate-slide-in-right">
      <div className="font-eng text-[9px] text-blueprint-500 tracking-[0.25em] mb-1">
        MONDAY · MORNING · CHECKLIST
      </div>
      <ol className="text-[10.5px] leading-relaxed text-steel-600 space-y-0.5 list-decimal list-inside marker:text-blueprint-500 marker:font-eng">
        <li>
          <span className="font-semibold text-steel-700">步骤1</span>
          ：点击"导入旧材料"，V1 节点生成
        </li>
        <li>
          <span className="font-semibold text-steel-700">步骤2</span>
          ：点击"补录附件"，触发结论改判并留痕
        </li>
        <li>
          <span className="font-semibold text-steel-700">步骤3</span>
          ：左侧筛等级为严重 → 点"导出 CSV"
        </li>
      </ol>
      <div className="mt-1.5 pt-1.5 border-t border-dashed border-paper-300 text-[9.5px] text-steel-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-fire-pass animate-pulse" />
        数据已预填 V1+V2 场景，可直接切换时间轴与导出验证
      </div>
    </div>
  );
}
