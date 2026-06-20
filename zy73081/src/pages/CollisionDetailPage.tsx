import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, Download, Edit3, History, UserRound, CalendarDays, FileWarning,
  Building2, Layers, Box, GitCompare, AlertOctagon, Share2
} from 'lucide-react';
import { useCollisionStore } from '@/store/useCollisionStore';
import { StatusTag } from '@/components/StatusTag';
import { ViewScreenshots } from '@/components/ViewScreenshots';
import { ClueChain } from '@/components/ClueChain';
import { RejudgeModal } from '@/components/RejudgeModal';
import { HistoryDrawer } from '@/components/HistoryDrawer';

export default function CollisionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { detail, loading, actions } = useCollisionStore();
  const [showRejudge, setShowRejudge] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    actions.loadDetail(id);
    actions.loadHistory(id);
  }, [id, actions]);

  if (loading && !detail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-500 text-sm animate-pulse">加载碰撞详情中…</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-md">
          <AlertOctagon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <div className="text-lg font-bold text-slate-700 mb-1">记录不存在</div>
          <div className="text-sm text-slate-500 mb-5">碰撞编号 {id} 未找到，可能已删除</div>
          <Link to="/collisions" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-500 rounded-lg hover:bg-brand-600">
            <ArrowLeft className="w-4 h-4" /> 返回列表
          </Link>
        </div>
      </div>
    );
  }

  const r = detail;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/30 pb-32">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200/70">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => nav(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回列表</span>
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-slate-800">碰撞预审详情</h1>
                <code className="tnum font-mono text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded border border-brand-100">
                  {r.id}
                </code>
                {r.isSample && (
                  <button
                    onClick={() => actions.toggleSample(r.id, false)}
                    title="取消样例标记"
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded bg-sample-soft text-sample-star border border-sample-star/30 hover:opacity-80 transition-opacity"
                  >
                    <Star className="w-3 h-3 fill-sample-star/30" />
                    <span>样例</span>
                  </button>
                )}
                {!r.isSample && (
                  <button
                    onClick={() => actions.toggleSample(r.id, true)}
                    title="标记为样例"
                    className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-sample-star px-2 py-0.5 rounded hover:bg-sample-soft/60 border border-transparent hover:border-sample-star/20 transition-colors"
                  >
                    <Star className="w-3 h-3" />
                    <span>标记样例</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {r.projectName} · {r.floor} · {r.nodeCode}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusTag status={r.status} rejudgeCount={r.rejudgeCount} />
            <button
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>历史 ({r.history.length})</span>
            </button>
            <button
              onClick={() => actions.exportCSV({ keyword: r.id })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出单条</span>
            </button>
            <button
              onClick={() => setShowRejudge(true)}
              className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-status-manual hover:bg-violet-600 rounded-lg shadow-sm shadow-status-manual/25 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>改判</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">
        <ViewScreenshots record={r} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ClueChain nodes={r.clueChain} highlightOffset={r.isCoordinateOffset} />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Box className="w-4 h-4 text-brand-500" />
                <span>基本信息</span>
              </h3>
              <dl className="divide-y divide-slate-100 text-xs">
                <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="项目" value={r.projectName} />
                <InfoRow icon={<Layers className="w-3.5 h-3.5" />} label="楼层 / 节点" value={`${r.floor}  ·  ${r.nodeCode}`} mono />
                <InfoRow icon={<GitCompare className="w-3.5 h-3.5" />} label="碰撞类型" value={r.collisionType} />
                <InfoRow icon={<Box className="w-3.5 h-3.5" />} label="构件 A" value={r.elementA} strong />
                <InfoRow icon={<Box className="w-3.5 h-3.5 text-status-manual" />} label="构件 B" value={r.elementB} strong />
                <InfoRow icon={<UserRound className="w-3.5 h-3.5" />} label="负责人" value={r.responsiblePerson} />
                <InfoRow icon={<CalendarDays className="w-3.5 h-3.5" />} label="创建时间" value={r.createdAt.replace('T', ' ').slice(0, 16)} mono />
                <InfoRow icon={<Share2 className="w-3.5 h-3.5" />} label="最后修改" value={r.updatedAt.replace('T', ' ').slice(0, 16)} mono />
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-status-pending" />
                <span>初判结论摘要</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed bg-gradient-to-br from-amber-50/70 to-white p-3 rounded-lg border border-amber-100">
                {r.initialConclusion}
              </p>
            </div>

            {r.isCoordinateOffset && (
              <div className="rounded-xl border border-status-rejected/40 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm shadow-status-rejected/10">
                <h3 className="text-sm font-bold text-status-rejected mb-2 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4" />
                  <span>坐标偏移异常说明</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed mb-3">
                  {r.coordinateOffsetNote}
                </p>
                <div className="text-[11px] tnum font-mono bg-white/80 p-2 rounded border border-status-rejected/20 text-status-rejected/80">
                  ⚠ NOT_A_NORMAL_RECORD · COORDINATE_OFFSET = TRUE
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/10 px-4 py-2.5 flex items-center gap-2 backdrop-blur">
          <div className="text-[11px] text-slate-500 pr-3 border-r border-slate-200">
            <span className="font-medium text-slate-700">快捷操作：</span>
            样例在哪 → 顶部 ★ 按钮；异常在哪 → 顶部红条；结果怎么导出 → 右上「导出单条」或列表页「导出 CSV」
          </div>
          <button
            onClick={() => setShowRejudge(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-status-manual hover:bg-violet-600 rounded-lg transition-colors"
          >
            立即改判
          </button>
          <button
            onClick={() => actions.exportCSV()}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
          >
            导出全部 CSV
          </button>
        </div>
      </div>

      <RejudgeModal
        open={showRejudge}
        record={r}
        onClose={() => setShowRejudge(false)}
        onSuccess={() => {
          setShowRejudge(false);
          actions.loadDetail(r.id);
          actions.loadHistory(r.id);
        }}
      />
      <HistoryDrawer
        open={showHistory}
        record={r}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}

function InfoRow({
  icon, label, value, strong, mono,
}: { icon: React.ReactNode; label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start py-2.5 gap-3 first:pt-0 last:pb-0">
      <div className="w-8 flex-shrink-0 text-slate-400 pt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</div>
        <div className={`${strong ? 'font-semibold' : ''} ${mono ? 'font-mono tnum' : ''} text-slate-700`}>
          {value}
        </div>
      </div>
    </div>
  );
}
