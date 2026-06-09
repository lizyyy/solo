import { useMemo, useState } from 'react';
import { Clock, User, Search } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import { HistoryTimeline } from '../components/HistoryTimeline';

export function HistoryPage() {
  const { getAllHistory } = useReviewStore();
  const [keyword, setKeyword] = useState('');
  const [onlyYe, setOnlyYe] = useState(true);

  const all = useMemo(() => getAllHistory(), [getAllHistory]);

  const filtered = useMemo(() => {
    return all.filter((h) => {
      if (onlyYe && h.changedBy !== '老叶') return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        return (
          h.reviewId.toLowerCase().includes(kw) ||
          h.projectName.toLowerCase().includes(kw) ||
          h.changeReason.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [all, keyword, onlyYe]);

  const yeToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return all.filter(
      (h) => h.changedBy === '老叶' && new Date(h.changedAt).toISOString().slice(0, 10) === today,
    ).length;
  }, [all]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            结论历史追溯
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            所有复核记录的结论变更均在此 · 老叶当日改过的 <span className="font-semibold text-amber-600">{yeToday}</span> 条都能翻到
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:border-slate-300 transition-colors">
            <input
              type="checkbox"
              checked={onlyYe}
              onChange={(e) => setOnlyYe(e.target.checked)}
              className="w-4 h-4 accent-slate-900"
            />
            <User size={14} className="text-amber-500" />
            <span className="text-sm font-medium text-slate-700">只看老叶的修改</span>
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索编号 / 项目 / 理由…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input-field w-64 pl-8"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Clock size={13} />
              总修改记录
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{all.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500">涉及复核数</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {new Set(all.map((h) => h.reviewId)).size}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500">老叶修改</div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            {all.filter((h) => h.changedBy === '老叶').length}
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="text-xs font-semibold text-amber-700">老叶今日修改</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{yeToday}</div>
          <div className="mt-1 text-[11px] text-amber-600/80">
            {yeToday >= 3 ? '超过早会前预警阈值，注意交底清单不漏意见' : '在正常范围内'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="font-semibold text-slate-800">
            修改时间线
            <span className="ml-2 text-xs font-normal text-slate-400">
              共 {filtered.length} 条
              {onlyYe && keyword.trim() ? '（已筛选）' : onlyYe ? '（仅老叶）' : keyword.trim() ? '（已搜索）' : ''}
            </span>
          </div>
        </div>
        <div className="card-body max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin pr-2">
          <HistoryTimeline items={filtered} />
        </div>
      </div>
    </div>
  );
}
