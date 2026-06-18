import { useEffect, useRef } from "react";
import { LineChart, LayoutDashboard, Layers } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { PlaybackControls } from "@/components/PlaybackControls";
import { FilterBar } from "@/components/FilterBar";
import { Timeline } from "@/components/Timeline";
import { PositionMap } from "@/components/PositionMap";
import { RecordDetail } from "@/components/RecordDetail";
import { StatusKanban } from "@/components/StatusKanban";
import { ProjectSummaryView } from "@/components/ProjectSummaryView";
import { StatusBadge } from "@/components/Badges";
import type { SamplingParameter } from "@/types";

const parameters: SamplingParameter[] = ["temperature", "salinity", "pressure", "dissolved_oxygen", "ph"];

export default function Home() {
  const { activeTab, setActiveTab, selectedRecordId, selectRecord, playback, getFilteredRecords } = useStore();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (playback.isPlaying && activeTab === "timeline") {
      intervalRef.current = window.setInterval(() => {
        const filtered = getFilteredRecords();
        if (playback.currentIndex < filtered.length - 1) {
          useStore.getState().stepForward();
        } else {
          useStore.setState({ playback: { ...playback, isPlaying: false } });
        }
      }, 1000 / playback.speed);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playback.isPlaying, playback.speed, playback.currentIndex, activeTab]);

  const tabs = [
    { id: "timeline" as const, label: "时序回放", icon: LineChart },
    { id: "kanban" as const, label: "状态看板", icon: Layers },
    { id: "summary" as const, label: "项目汇报", icon: LayoutDashboard },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-6 h-6 text-blue-600" />
              深海采样时序回放
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              港口工程海上作业数据追溯系统 · 交班工具
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400">当前记录状态</div>
              {(() => {
                const rec = getFilteredRecords()[playback.currentIndex];
                return rec ? <StatusBadge status={rec.status} /> : null;
              })()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {activeTab === "timeline" && (
        <>
          <PlaybackControls />
          <FilterBar />
        </>
      )}

      <div className="flex-1 overflow-hidden">
        {activeTab === "timeline" && (
          <div className="h-full flex">
            <div className={cn(
              "flex-1 overflow-y-auto p-6 space-y-6",
              selectedRecordId ? "mr-96" : ""
            )}>
              <PositionMap />

              <div className="space-y-4">
                {parameters.map((param) => (
                  <Timeline key={param} parameter={param} />
                ))}
              </div>
            </div>

            {selectedRecordId && (
              <div className="fixed right-0 top-[140px] bottom-0 w-96 z-20">
                <RecordDetail onClose={() => selectRecord(null)} />
              </div>
            )}
          </div>
        )}

        {activeTab === "kanban" && (
          <div className="h-full overflow-y-auto p-6">
            <StatusKanban />
          </div>
        )}

        {activeTab === "summary" && (
          <div className="h-full overflow-y-auto p-6">
            <ProjectSummaryView />
          </div>
        )}
      </div>
    </div>
  );
}
