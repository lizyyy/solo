import { PawPrint, Shell } from 'lucide-react';
import { FilterPanel } from '../components/FilterPanel';
import { StatsCards } from '../components/StatsCards';
import { SummaryCard } from '../components/SummaryCard';
import { DetailTable } from '../components/DetailTable';

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#F5F5F0]/85 border-b border-stone-200/80">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#E87722] to-[#F5A25C] shadow-md shadow-orange-900/10 flex items-center justify-center">
                <Shell size={24} className="text-white" strokeWidth={2.2} />
              </div>
              <PawPrint
                size={12}
                className="absolute -bottom-0.5 -right-0.5 text-[#2D6A4F]"
                fill="#2D6A4F"
                strokeWidth={0}
              />
            </div>
            <div>
              <h1
                className="text-[22px] font-bold text-stone-800 leading-tight"
                style={{ fontFamily: '"ZCOOL XiaoWei", "LXGW WenKai", serif' }}
              >
                异宠温控排程对账
              </h1>
              <p className="text-[12px] text-stone-500 tracking-wide">
                Exotic Pet Temperature Schedule Reconciliation · 救助站月度复核
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-stone-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            统一结果集 · 四区域实时联动
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        <FilterPanel />
        <StatsCards />
        <SummaryCard />
        <DetailTable />
      </main>

      <footer className="mt-8 border-t border-stone-200/70 bg-white/50">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-5 text-xs text-stone-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span>
            🐢 为救助站志愿者小乔设计 · 筛选条件、统计、摘要、明细表共用同一套
            <span className="text-[#E87722] font-semibold mx-1">derivedResult</span>
            结果集生成
          </span>
          <span>月末复核 · 已确认 / 待补件 / 退回 · 三分明</span>
        </div>
      </footer>
    </div>
  );
}
