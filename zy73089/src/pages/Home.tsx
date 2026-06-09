import { Link } from 'react-router-dom';
import {
  PlaySquare,
  DatabaseZap,
  History,
  Plus,
  LayoutDashboard,
  HardHat,
  ArrowRight,
} from 'lucide-react';
import { useChecklistStore } from '@/store/checklistStore';
import { BatchCard } from '@/components/BatchCard';
import { HistoryTimeline } from '@/components/HistoryTimeline';

export function Home() {
  const batches = useChecklistStore((s) => s.getAllBatchesSorted());
  const createBatch = useChecklistStore((s) => s.createBatch);
  const setCurrentBatchId = useChecklistStore((s) => s.setCurrentBatchId);

  const handleNew = () => {
    const id = createBatch('新建结构加固交底批次');
    setCurrentBatchId(id);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#EFF6FF_0%,#F1F5F9_40%,#FAFAF9_100%)]">
      <header
        className="relative overflow-hidden border-b border-blue-200"
        style={{
          backgroundImage:
            'linear-gradient(135deg, #1E3A8A 0%, #1E40AF 45%, #2563EB 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white/30 bg-white/10 backdrop-blur">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-wide" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                结构加固交底清单
              </div>
              <div className="text-[10.5px] text-blue-200">
                Web3D + 签证单 + 材料送审 · 原始数据不清洗 · 疑点暂缓可重跑
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-[12px] text-blue-100">
            <Link to="/" className="rounded-md bg-white/10 px-3 py-1.5 font-bold border border-white/20">
              <LayoutDashboard className="inline h-3.5 w-3.5 mr-1" /> 工作台
            </Link>
            <Link to="/sample" className="rounded-md px-3 py-1.5 hover:bg-white/10 transition-colors">
              <DatabaseZap className="inline h-3.5 w-3.5 mr-1" /> 样例
            </Link>
            <Link to="/history" className="rounded-md px-3 py-1.5 hover:bg-white/10 transition-colors">
              <History className="inline h-3.5 w-3.5 mr-1" /> 历史时间线
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            to="/sample"
            className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <DatabaseZap className="mb-2 h-9 w-9 text-emerald-600" />
            <div className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              载入样例
            </div>
            <div className="mt-1 text-xs text-slate-500">
              一键导入一包"像现场会收到的材料"：签证单涂改、批号磨损、坐标偏移、层数对不上等典型脏数据。
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700">
              开始体验 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <button
            onClick={handleNew}
            className="group relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <PlaySquare className="mb-2 h-9 w-9 text-blue-600" />
            <div className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              跑新批次
            </div>
            <div className="mt-1 text-xs text-slate-500">
              先上传自有签证单与材料送审，再创建新批次执行比对。适用于已有现场资料的情况。
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-700">
              <Plus className="h-3.5 w-3.5" /> 创建批次
            </div>
          </button>

          <Link
            to="/history"
            className="group relative overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <History className="mb-2 h-9 w-9 text-indigo-600" />
            <div className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              历史时间线
            </div>
            <div className="mt-1 text-xs text-slate-500">
              查看每次跑批次和重跑的痕迹：首次跑、补备注重跑、导出快照全记录；支持两批次并排对照。
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-700">
              查看记录 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                批次概览 · 共 {batches.length} 个
              </h2>
              <button
                onClick={handleNew}
                className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
              >
                <Plus className="h-3 w-3" /> 新建批次
              </button>
            </div>

            {batches.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center">
                <div className="mb-3 text-sm text-slate-500">还没有批次记录</div>
                <Link
                  to="/sample"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-emerald-600 hover:to-emerald-700"
                >
                  <DatabaseZap className="h-3.5 w-3.5" /> 先载入样例看看效果
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {batches.map((b) => (
                  <BatchCard key={b.batchId} batch={b} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-base font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              近期事件
            </h2>
            <HistoryTimeline compact />
          </div>
        </section>

        <footer className="mt-10 rounded-xl border border-slate-200 bg-white/70 p-4 text-[11px] text-slate-500 backdrop-blur">
          <div className="font-bold text-slate-600 mb-1">施工经理阿乔 · 使用提示：</div>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>先点【载入样例】，系统会自动跑一个批次，包含典型的坐标偏移疑点和口径对不上场景。</li>
            <li>样例跑好后，进入【交底清单】：左侧 3D 模型点选构件（橙色闪烁=有疑点），右侧查看清单与原始来源。</li>
            <li>补备注后点"补备注重跑"生成新批次，再去【历史时间线】对照前后变化。</li>
            <li>所有数据保存在浏览器 localStorage 中，换浏览器或清缓存会丢失，记得导出 JSON/CSV 留底。</li>
          </ol>
        </footer>
      </main>
    </div>
  );
}
