import { useReviewStore } from '@/store/reviewStore';
import { StatCards } from '@/components/StatCards';
import { ThresholdAlertPanel } from '@/components/ThresholdAlertPanel';
import { RecordCard } from '@/components/RecordCard';
import { DetailDrawer } from '@/components/DetailDrawer';
import { Search, Filter, SlidersHorizontal, HardHat, ClipboardCheck, FileSpreadsheet } from 'lucide-react';

export default function Home() {
  const {
    statusFilter,
    searchText,
    setSearchText,
    getFilteredRecords,
    getStatusCounts,
    activeRecordId,
  } = useReviewStore();

  const records = getFilteredRecords();
  const counts = getStatusCounts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-blue-50/50">
      <header
        className="sticky top-0 z-30 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b-4 border-amber-500 shadow-lg"
      >
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center shadow-md">
                <HardHat className="w-7 h-7 text-slate-900" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <ClipboardCheck className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h1
                className="text-xl font-bold tracking-wide"
                style={{ fontFamily: 'Noto Serif SC, Songti SC, serif' }}
              >
                电梯故障报告复核工作台
              </h1>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Elevator Fault Report · Review &amp; Traceability System — 老唐 &amp; 交接同事专用
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-xs text-blue-200">
              <div className="text-center">
                <div className="font-mono font-bold text-white text-lg">
                  {counts.confirmed + counts.pending + counts.rejected}
                </div>
                <div>总记录</div>
              </div>
              <div className="w-px h-8 bg-blue-800" />
              <div className="text-center">
                <div className="font-mono font-bold text-amber-400 text-lg">{counts.pending}</div>
                <div>待补件</div>
              </div>
              <div className="w-px h-8 bg-blue-800" />
              <div className="text-center">
                <div className="font-mono font-bold text-red-400 text-lg">{counts.rejected}</div>
                <div>退回</div>
              </div>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold">
              唐
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <section className="mb-6">
          <StatCards />
        </section>

        <section className="mb-6">
          <ThresholdAlertPanel />
        </section>

        <section className="mb-5 bg-white rounded border border-zinc-200 shadow-sm p-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mr-2">
            <SlidersHorizontal className="w-4 h-4 text-blue-700" />
            筛选条件
          </div>
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索报告编号 / 电梯编号 / 故障类型 / 摘要关键词..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-zinc-50 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold">
            {(['all', 'pending', 'confirmed', 'rejected'] as const).map((k) => (
              <button
                key={k}
                onClick={() =>
                  useReviewStore.getState().setStatusFilter(
                    statusFilter === k ? 'all' : k
                  )
                }
                className={
                  'px-3 py-1.5 rounded border transition-colors ' +
                  (statusFilter === k || (k === 'all' && statusFilter === 'all')
                    ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100')
                }
              >
                {k === 'all'
                  ? `全部 (${counts.confirmed + counts.pending + counts.rejected})`
                  : k === 'pending'
                    ? `待补件 (${counts.pending})`
                    : k === 'confirmed'
                      ? `已确认 (${counts.confirmed})`
                      : `退回 (${counts.rejected})`}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {statusFilter === 'all' ? '未按状态筛选' : `当前筛选：${statusFilter}`}
          </div>
        </section>

        <section className="mb-3 flex items-end justify-between">
          <div>
            <h2
              className="text-base font-bold text-zinc-800 flex items-center gap-2"
              style={{ fontFamily: 'Noto Serif SC, serif' }}
            >
              <FileSpreadsheet className="w-4.5 h-4.5 text-blue-700" />
              复核记录列表
            </h2>
            <p className="text-[11px] text-zinc-500 mt-1">
              共 {records.length} 条 · 点击卡片进入详情，可查看变更时间线、原始快照并跳转备件清单源对象
            </p>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {/* 2026-06 复核周期 */}
          </div>
        </section>

        <section className="space-y-3 pb-20">
          {records.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-300 bg-white p-12 text-center">
              <div className="text-5xl mb-3 opacity-50">📭</div>
              <div className="text-sm font-semibold text-zinc-600 mb-1">没有符合条件的记录</div>
              <div className="text-xs text-zinc-500">调整搜索或筛选条件试试</div>
            </div>
          ) : (
            records.map((r) => <RecordCard key={r.id} record={r} />)
          )}
        </section>
      </main>

      {activeRecordId && <DetailDrawer />}
    </div>
  );
}
