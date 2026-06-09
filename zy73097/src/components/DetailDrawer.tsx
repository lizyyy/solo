import { X, Layers, CalendarDays, User, Building2 } from 'lucide-react';
import { useSelectedRecord, useMaterialStore } from '../store';
import { StatusTag, AbnormalBadge } from './Tags';
import { OpinionCompare } from './OpinionCompare';
import { SupplementaryNotesPanel } from './SupplementaryNotesPanel';
import { AbnormalityCard } from './AbnormalityCard';
import { HistoryTimeline } from './HistoryTimeline';
import { cn } from '../lib/utils';

export function DetailDrawer() {
  const r = useSelectedRecord();
  const select = useMaterialStore((s) => s.selectRecord);
  const open = !!r;

  return (
    <>
      {/* 遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy-900/40 backdrop-blur-[1px] anim-fade-in lg:hidden"
          onClick={() => select(null)}
        />
      )}

      {/* 抽屉 */}
      <aside
        className={cn(
          'fixed right-0 top-0 h-full w-full lg:static lg:w-[44%] xl:w-[42%]',
          'z-40 bg-ink-100 border-l-2 border-navy-200',
          'transition-transform duration-300 ease-out anim-fade-in',
          open
            ? 'translate-x-0 shadow-2xl'
            : 'translate-x-full lg:translate-x-0 lg:!bg-navy-50 lg:border-l-0 lg:bg-noise-light',
          !open && 'pointer-events-none lg:pointer-events-auto',
        )}
      >
        {!r ? (
          <EmptyPanel />
        ) : (
          <div className="h-full flex flex-col anim-slide-in">
            {/* 头部 */}
            <header className="bg-navy-grad text-white px-5 py-4 flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-lg tracking-wide tabular-nums">
                    {r.code}
                  </span>
                  {r.layerAbnormality.hasAbnormality && !r.layerAbnormality.reviewed && (
                    <AbnormalBadge />
                  )}
                  <StatusTag status={r.status} size="md" />
                </div>
                <div className="font-song font-bold text-base leading-tight">{r.name}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-navy-200">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} />
                    {r.fireZone}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers size={12} />
                    {r.layerName}
                  </span>
                  <span className="flex items-center gap-1 font-mono tabular-nums">
                    <CalendarDays size={12} />
                    送审 {r.submissionDate}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-navy-300">
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    送审人：{r.submitter}
                  </span>
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    审核：{r.reviewer}
                  </span>
                </div>
              </div>
              <button
                onClick={() => select(null)}
                className="shrink-0 p-1.5 hover:bg-white/15 transition rounded"
                aria-label="关闭详情"
              >
                <X size={18} />
              </button>
            </header>

            {/* 滚动内容 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <AbnormalityCard recordId={r.id} abnormal={r.layerAbnormality} />
              <OpinionCompare opinions={r.opinions} />
              <SupplementaryNotesPanel recordId={r.id} notes={r.supplementaryNotes} />
              <HistoryTimeline history={r.history} />
            </div>

            <footer className="shrink-0 px-4 py-2.5 border-t-2 border-ink-200 bg-white text-[11px] text-ink-500 flex items-center justify-between">
              <span>
                数据源：<b className="text-navy-600">同一筛选结果集</b> · 与主工作台明细表、统计卡片一致
              </span>
              <span className="font-mono">#{r.id}</span>
            </footer>
          </div>
        )}
      </aside>
    </>
  );
}

function EmptyPanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 rounded-full bg-navy-100 flex items-center justify-center mb-4 border-4 border-white shadow-inner">
        <Layers size={42} className="text-navy-400" />
      </div>
      <h3 className="font-song font-bold text-navy-700 text-lg mb-1">选择左侧记录查看详情</h3>
      <p className="text-sm text-ink-500 max-w-xs">
        详情面板包含 <b>交底清单 vs 旧意见比对</b>、
        <b>后补备注处理过程</b>、
        <b>图层异常原因说明</b> 与完整 <b>历史变更时间线</b>
      </p>
      <div className="mt-6 space-y-2 text-left max-w-sm w-full">
        {[
          '🔴 遗漏旧意见会红色高亮（交底清单漏了哪些一眼看清）',
          '📝 每条后补备注强制记录处理过程（不能只留一句备注）',
          '⚠️ 图层异常原因会写清楚，不会看起来像顺利通过',
          '⏳ 每次改状态都要填原因，历史全部可见（不只看最终值）',
        ].map((t) => (
          <div
            key={t}
            className="text-xs text-ink-700 bg-white border border-ink-200 px-3 py-2 shadow-sm"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
