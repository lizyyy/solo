import QuickGuideCard from '@/components/history/QuickGuideCard';
import RunHistoryPanel from '@/components/history/RunHistoryPanel';
import ExportCenter from '@/components/history/ExportCenter';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" style={{ fontFamily: 'Noto Serif SC, serif' }}>
              历史与导出
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              执行历史对比 · 补备注重跑 · CSV/JSON 报告导出
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1 shadow-sm">
              💡 按三步指引完成首次追踪
            </span>
          </div>
        </header>

        <QuickGuideCard />

        <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 380px)' }}>
          <RunHistoryPanel />
          <ExportCenter />
        </div>
      </div>
    </div>
  );
}
