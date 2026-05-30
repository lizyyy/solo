import StatsCards from "@/components/StatsCards";
import StatusChart from "@/components/StatusChart";
import FilterBar from "@/components/FilterBar";
import EventTable from "@/components/EventTable";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f1225] text-[#f0ece4]">
      <header className="border-b border-[#2a3050] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#e8a838] animate-pulse" />
          <h1 className="text-lg font-semibold tracking-tight">信用衍生品触发事件复核</h1>
        </div>
        <p className="text-xs text-[#6b7894] mt-1">风控法务 · 证据链管理 · 状态追溯</p>
      </header>

      <main className="max-w-[1440px] mx-auto p-6 space-y-6">
        <StatsCards />

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <StatusChart />
          </div>
          <div className="col-span-8 space-y-4">
            <FilterBar />
            <EventTable />
          </div>
        </div>
      </main>
    </div>
  );
}
