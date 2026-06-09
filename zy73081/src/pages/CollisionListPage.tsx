import { useEffect, useState } from 'react';
import { useCollisionStore } from '@/store/useCollisionStore';
import { SummaryCards } from '@/components/SummaryCards';
import { FilterBar } from '@/components/FilterBar';
import { CollisionTable } from '@/components/CollisionTable';
import { RejudgeModal } from '@/components/RejudgeModal';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import type { CollisionRecord } from '@/types';
import { Layers, Sparkles, Info } from 'lucide-react';

export default function CollisionListPage() {
  const { list, summary, loading, filters, actions } = useCollisionStore();
  const [rejudgeTarget, setRejudgeTarget] = useState<CollisionRecord | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CollisionRecord | null>(null);

  useEffect(() => {
    actions.loadList();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => actions.loadList(), 50);
    return () => clearTimeout(t);
  }, [
    filters.status,
    filters.coordinateOffsetOnly,
    filters.keyword,
    filters.project,
    filters.floor,
  ]);

  const jumpTo = (key: 'offset' | 'passed' | 'pending' | 'manual') => {
    if (key === 'offset') {
      actions.setFilters({ coordinateOffsetOnly: true });
    } else {
      const map = { passed: 'PASSED', pending: 'PENDING_EVIDENCE', manual: 'MANUAL_REJUDGED' } as const;
      actions.setFilters({ status: map[key], coordinateOffsetOnly: false });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/30">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200/70">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-700 flex items-center justify-center shadow-md shadow-brand-500/30">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">幕墙节点碰撞预审</h1>
              <p className="text-xs text-slate-500 mt-0.5">Curtain Wall Node Collision Pre-review</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-start gap-2 max-w-md text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <Info className="w-3.5 h-3.5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-slate-700">老叶接班速览：</span>
                顶部汇总<span className="text-brand-600 mx-1">扫数字</span>→异常卡片<span className="text-status-rejected mx-1">点一下</span>筛选→列表里
                <span className="text-status-rejected mx-1">红竖条</span>是坐标偏移、<span className="text-sample-star mx-1">★</span>是样例→导出CSV前选好状态
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-status-manual" />
              <span className="text-xs text-slate-600 font-medium">结构工程师 · 老叶</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6 space-y-5 pb-20">
        <SummaryCards data={summary} onJump={jumpTo} />
        <FilterBar />

        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-slate-500">
            筛选结果 <span className="tnum font-bold text-slate-800">{list.length}</span> / {summary.total} 条
            {loading && <span className="ml-3 text-brand-500 animate-pulse">加载中…</span>}
          </div>
          {historyTarget && (
            <button
              onClick={() => setHistoryTarget(historyTarget)}
              className="text-xs text-brand-600 hover:underline"
            >
              查看 {historyTarget.id} 的历史 →
            </button>
          )}
        </div>

        <CollisionTable
          rows={list}
          onOpenRejudge={(r) => setRejudgeTarget(r)}
        />
      </main>

      <RejudgeModal
        open={!!rejudgeTarget}
        record={rejudgeTarget}
        onClose={() => setRejudgeTarget(null)}
        onSuccess={(updated) => {
          setRejudgeTarget(null);
          actions.loadHistory(updated.id);
        }}
      />

      <HistoryDrawer
        open={!!historyTarget}
        record={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
