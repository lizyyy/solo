import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HistoryTimeline } from '@/components/common/HistoryTimeline';
import { Search, History as HistoryIcon, Filter } from 'lucide-react';
import type { HistoryAction } from '../../shared/types';
import { ACTION_LABELS } from '../../shared/types';
import { clsx } from 'clsx';

function HistoryPage() {
  const fetchHistoryAll = useAppStore(s => s.fetchHistoryAll);
  const history = useAppStore(s => s.historyAll);
  const total = useAppStore(s => s.historyTotal);
  const loading = useAppStore(s => s.loading);

  const [keyword, setKeyword] = useState('');
  const [action, setAction] = useState<HistoryAction | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setPage(1);
  }, [keyword, action]);

  useEffect(() => {
    fetchHistoryAll({ action: action || undefined, keyword, page, pageSize });
  }, [keyword, action, page, fetchHistoryAll]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const ACTION_OPTIONS: Array<{ key: HistoryAction | ''; label: string }> = [
    { key: '', label: '全部操作类型' },
    { key: 'create', label: ACTION_LABELS.create },
    { key: 'update', label: ACTION_LABELS.update },
    { key: 'rejudge', label: ACTION_LABELS.rejudge },
    { key: 'cad_note', label: ACTION_LABELS.cad_note },
    { key: 'change_order', label: ACTION_LABELS.change_order },
    { key: 'csv_import', label: ACTION_LABELS.csv_import },
    { key: 'csv_update', label: ACTION_LABELS.csv_update },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: '"Source Han Serif SC", serif' }}>
            全量操作历史
          </h1>
          <p className="text-sm text-slate-500 mt-1">所有改判、补录、CSV导入均在此留痕，重启后不丢失</p>
        </div>
        <div className="text-xs text-slate-500">
          共 <span className="font-semibold text-slate-700">{total}</span> 条记录
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="搜索：材料编号/操作人/备注内容"
                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={action}
                onChange={e => setAction(e.target.value as HistoryAction | '')}
                className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 appearance-none"
              >
                {ACTION_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-16 text-slate-400">
              <div className="inline-flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1e3a5f] rounded-full animate-spin" />
                加载中...
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <HistoryIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
              暂无操作记录
            </div>
          ) : (
            <HistoryTimeline history={history} />
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              第 {page} / {totalPages} 页（每页 {pageSize} 条）
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={clsx(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                )}
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={clsx(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                  'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
                )}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
