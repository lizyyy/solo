import { AlertTriangle, ChevronRight, History } from 'lucide-react';
import { useMemo } from 'react';
import { selectFilteredSamples, useSampleStore } from '../store/useSampleStore';
import { verdictColorMap } from '../utils/format';
import StatusBadge from './StatusBadge';

export default function SampleTable() {
  const samples = useSampleStore((s) => s.samples);
  const active = useSampleStore((s) => s.ui.activeFilter);
  const keyword = useSampleStore((s) => s.ui.searchKeyword);
  const openDrawer = useSampleStore((s) => s.openDrawer);
  const openHistory = useSampleStore((s) => s.openHistory);
  const selectSample = useSampleStore((s) => s.selectSample);

  const list = useMemo(
    () => selectFilteredSamples(samples, active, keyword),
    [samples, active, keyword],
  );

  if (list.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-500">
        <div className="font-display text-lg text-ink-700">没有符合条件的样本</div>
        <div className="mt-1 text-sm">尝试切换筛选条件或清空搜索关键字。</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-600">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-10"></th>
              <th className="text-left px-3 py-3 font-semibold">学号</th>
              <th className="text-left px-3 py-3 font-semibold">姓名</th>
              <th className="text-left px-3 py-3 font-semibold">题目</th>
              <th className="text-left px-3 py-3 font-semibold">结果摘要</th>
              <th className="text-left px-3 py-3 font-semibold">状态</th>
              <th className="text-left px-3 py-3 font-semibold">审核结论</th>
              <th className="text-left px-3 py-3 font-semibold">提交时间</th>
              <th className="text-right px-4 py-3 font-semibold w-28">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => {
              const vc = s.finalVerdict ? verdictColorMap[s.finalVerdict] : null;
              return (
                <tr
                  key={s.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`border-t border-ink-100 hover:bg-ink-50/60 transition-colors animate-fadeUp relative ${
                    i % 2 === 1 ? 'bg-ink-50/30' : ''
                  }`}
                >
                  {s.isDuplicate && (
                    <td className="absolute left-0 top-0 bottom-0 w-1 bg-amber2-500" aria-hidden />
                  )}
                  <td className="px-4 py-3 align-top">
                    {s.isDuplicate ? (
                      <span title="与其他样本重复" className="inline-flex items-center text-amber2-600">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-ink-600">{s.studentId}</td>
                  <td className="px-3 py-3 align-top font-medium text-ink-900">{s.studentName}</td>
                  <td className="px-3 py-3 align-top text-ink-700">{s.problemTitle}</td>
                  <td className="px-3 py-3 align-top text-ink-700 max-w-xs truncate">
                    <span className="font-medium">{s.resultSummary}</span>
                    {s.isDuplicate && (
                      <span className="ml-1.5 text-[10px] font-semibold text-amber2-700 bg-amber2-50 border border-amber2-200 rounded px-1.5 py-0.5">
                        重复
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    {s.finalVerdict && vc ? (
                      <span className={`chip ${vc.bg} ${vc.text} ${vc.border}`}>{s.finalVerdict}</span>
                    ) : (
                      <span className="text-ink-400 text-xs">— 未审核 —</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-ink-500">{s.submittedAt}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          selectSample(s.id);
                          openHistory();
                        }}
                        title="查看历史变更"
                        className="btn-ghost !p-1.5"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button onClick={() => openDrawer(s.id)} className="btn-primary !py-1.5 !px-2.5 text-xs">
                        查看 <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
