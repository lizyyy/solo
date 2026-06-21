import { useEffect } from "react";
import TopSummaryBar from "@/components/layout/TopSummaryBar";
import LeftPanel from "@/components/layout/LeftPanel";
import CenterPanel from "@/components/layout/CenterPanel";
import RightPanel from "@/components/layout/RightPanel";
import { useAppStore } from "@/store/useAppStore";

export default function Home() {
  const { refreshAll } = useAppStore();

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopSummaryBar />
      <main className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto">
        <div className="flex h-[calc(100vh-60px)] min-h-[760px]">
          <LeftPanel />
          <CenterPanel />
          <RightPanel />
        </div>
      </main>
    </div>
  );
}
