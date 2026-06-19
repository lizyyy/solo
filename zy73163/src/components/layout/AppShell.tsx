import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopSummaryBar } from "./TopSummaryBar";

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopSummaryBar />
        <main className="scroll-atlas flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
