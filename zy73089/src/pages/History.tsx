import { Link } from 'react-router-dom';
import { History as HistoryIcon, HardHat, LayoutDashboard, DatabaseZap, GitCompare } from 'lucide-react';
import { HistoryTimeline } from '@/components/HistoryTimeline';
import { BatchDiff } from '@/components/BatchDiff';

export function History() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50">
      <header className="border-b border-indigo-200 bg-gradient-to-r from-indigo-800 via-violet-800 to-purple-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                结构加固交底清单 · 历史时间线
              </div>
              <div className="text-[10.5px] text-indigo-200">
                首次跑 / 补备注重跑 / 导出快照 全记录 · 可前后批次对照
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-[12px] text-indigo-100">
            <Link to="/" className="rounded-md px-3 py-1.5 hover:bg-white/10">
              <LayoutDashboard className="inline h-3.5 w-3.5 mr-1" /> 工作台
            </Link>
            <Link to="/sample" className="rounded-md px-3 py-1.5 hover:bg-white/10">
              <DatabaseZap className="inline h-3.5 w-3.5 mr-1" /> 样例
            </Link>
            <Link to="/history" className="rounded-md bg-white/10 px-3 py-1.5 font-bold border border-white/20">
              <HistoryIcon className="inline h-3.5 w-3.5 mr-1" /> 历史时间线
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.1fr]">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              事件时间线（从新到旧）
            </h2>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/60 p-3 backdrop-blur shadow-sm">
            <HistoryTimeline />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-violet-600" />
            <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              批次前后对照
            </h2>
          </div>
          <BatchDiff />
        </section>
      </main>
    </div>
  );
}
