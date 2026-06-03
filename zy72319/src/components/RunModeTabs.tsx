import { useState } from "react";
import { Play } from "lucide-react";
import type { MaterialSource } from "@/types";
import useAppStore from "@/store/useAppStore";

const tabs: { mode: MaterialSource; label: string }[] = [
  { mode: "normal", label: "正常材料" },
  { mode: "mismatch", label: "错口径材料" },
  { mode: "supplementary", label: "补录材料" },
];

interface RunModeTabsProps {
  activeMode: MaterialSource;
  onChange: (mode: MaterialSource) => void;
  onRun: (mode: MaterialSource) => void;
}

export default function RunModeTabs({ activeMode, onChange, onRun }: RunModeTabsProps) {
  const counterExamples = useAppStore((s) => s.counterExamples);
  const filtered = counterExamples.filter((ce) => ce.source === activeMode);
  const normalCount = filtered.filter((ce) => ce.status === "normal").length;
  const boundaryCount = filtered.filter((ce) => ce.status === "boundary").length;
  const conflictCount = filtered.filter((ce) => ce.status === "conflict").length;
  const pendingCount = filtered.filter((ce) => ce.status === "pending_review").length;

  return (
    <div className="w-full">
      <div className="flex border-b border-[#2a2a4a]">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            onClick={() => onChange(tab.mode)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              activeMode === tab.mode
                ? "text-[#0ff0b3] border-b-2 border-[#0ff0b3]"
                : "text-[#8888aa] hover:text-[#ccccdd] border-b-2 border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onRun(activeMode)}
        className="mt-4 flex items-center gap-2 rounded-lg bg-[#0ff0b3] px-5 py-2 text-sm font-semibold text-[#0d0d1f] transition-opacity hover:opacity-90"
      >
        <Play size={16} />
        运行
      </button>

      <div className="mt-4 rounded-lg bg-[#16163a] border border-[#2a2a4a] px-4 py-3">
        <p className="text-sm text-[#8888aa]">
          当前模式反例总数：<span className="text-[#ccccdd] font-semibold">{filtered.length}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="text-[#0ff0b3]">正常 {normalCount}</span>
          <span className="text-[#ff9f1c]">边界 {boundaryCount}</span>
          <span className="text-[#ff4444]">冲突 {conflictCount}</span>
          <span className="text-[#8888aa]">待审 {pendingCount}</span>
        </div>
      </div>
    </div>
  );
}
