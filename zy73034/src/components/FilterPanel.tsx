import { useMemo } from 'react';
import { Search, Filter, RotateCcw, Database } from 'lucide-react';
import { usePetStore } from '@/store/petStore';
import { anomalyTypeLabel } from '@/components/Badges';
import type { Anomaly, DerivedPet, TrainingProgress, TrainingJudge } from '@/types';

export type FilterState = {
  keyword: string;
  anomalyTypes: Anomaly['type'][];
  progress: TrainingProgress | 'all';
  judge: TrainingJudge | 'all';
  onlyConfirmed: 'all' | 'confirmed' | 'unconfirmed' | 'revoked';
};

type Props = {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  resultCount: number;
};

const ANOMALY_OPTIONS: { value: Anomaly['type']; label: string; hint: string }[] = [
  { value: 'alias_duplicate', label: '别名冲突', hint: '多条宠物共用同一名称/别名' },
  { value: 'self_alias_duplicate', label: '别名自重复', hint: '单条宠物内部别名重复' },
  { value: 'manual_rejudge', label: '人工改判', hint: '评定结果存在改判痕迹' },
  { value: 'pending_confirm', label: '待确认', hint: '尚未完成确认归档' },
  { value: 'conflict_history', label: '版本冲突', hint: '撤回后重新导入' },
];

const PROGRESS_OPTIONS: (TrainingProgress | 'all')[] = ['all', '未开始', '进行中', '已完成', '中止'];
const JUDGE_OPTIONS: (TrainingJudge | 'all')[] = ['all', '待评定', '合格', '不合格'];

export function FilterPanel({ filter, setFilter, resultCount }: Props) {
  const { pets, resetToDemo, clearAll } = usePetStore();

  const anomalyStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pets) for (const a of p.anomalies) map[a.type] = (map[a.type] || 0) + 1;
    return map;
  }, [pets]);

  const toggleAnomaly = (t: Anomaly['type']) => {
    const has = filter.anomalyTypes.includes(t);
    setFilter({
      ...filter,
      anomalyTypes: has ? filter.anomalyTypes.filter((x) => x !== t) : [...filter.anomalyTypes, t],
    });
  };

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-parchment-200 bg-white/70 p-5 shadow-card backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-parchment-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-sage-600 p-1.5 text-white">
            <Filter className="h-4 w-4" />
          </div>
          <h3 className="font-song text-base font-semibold text-sage-800">筛选面板</h3>
        </div>
        <span className="rounded-full bg-sage-50 px-2 py-0.5 text-xs font-mono text-sage-700">
          {resultCount} 条
        </span>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">关键词（宠物名 / 别名 / 品种）</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filter.keyword}
            onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
            placeholder="例如：豆豆、柴犬、豆包…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-slate-600">
          异常类型 <span className="text-slate-400">（含异常痕迹标记的宠物）</span>
        </label>
        <div className="flex flex-col gap-1.5">
          {ANOMALY_OPTIONS.map((opt) => {
            const active = filter.anomalyTypes.includes(opt.value);
            const count = anomalyStats[opt.value] || 0;
            return (
              <label
                key={opt.value}
                className={`group flex cursor-pointer items-start justify-between rounded-lg border px-3 py-2 text-sm transition ${
                  active
                    ? 'border-clay-400 bg-clay-50 text-clay-700 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-sage-300 hover:bg-sage-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleAnomaly(opt.value)}
                    className="mt-0.5 h-4 w-4 accent-sage-600"
                  />
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.hint}</div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                    count > 0 ? 'bg-clay-100 text-clay-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">训练进度</label>
          <select
            value={filter.progress}
            onChange={(e) => setFilter({ ...filter, progress: e.target.value as any })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          >
            {PROGRESS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p === 'all' ? '全部进度' : p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">训练评定</label>
          <select
            value={filter.judge}
            onChange={(e) => setFilter({ ...filter, judge: e.target.value as any })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100"
          >
            {JUDGE_OPTIONS.map((j) => (
              <option key={j} value={j}>
                {j === 'all' ? '全部评定' : j}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">确认状态</label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { v: 'all', label: '全部' },
            { v: 'confirmed', label: '已确认' },
            { v: 'unconfirmed', label: '未确认' },
            { v: 'revoked', label: '已撤回' },
          ].map((x) => {
            const active = filter.onlyConfirmed === x.v;
            return (
              <button
                key={x.v}
                onClick={() => setFilter({ ...filter, onlyConfirmed: x.v as any })}
                className={`rounded-md border px-2 py-1.5 text-xs transition ${
                  active
                    ? 'border-sage-500 bg-sage-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sage-300 hover:text-sage-700'
                }`}
              >
                {x.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 space-y-2 border-t border-parchment-200 pt-3">
        <button
          onClick={resetToDemo}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-sage-300 bg-sage-50 px-3 py-2 text-xs font-medium text-sage-700 transition hover:bg-sage-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置为演示数据
        </button>
        <button
          onClick={clearAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <Database className="h-3.5 w-3.5" />
          清空本地数据
        </button>
      </div>
    </aside>
  );
}

export function applyFilter(pets: DerivedPet[], f: FilterState): DerivedPet[] {
  return pets.filter((p) => {
    if (f.keyword) {
      const k = f.keyword.trim().toLowerCase();
      const hay = [p.name, ...p.aliases, p.breed].join(' ').toLowerCase();
      if (!hay.includes(k)) return false;
    }
    if (f.anomalyTypes.length) {
      const petAnom = p.anomalies.map((a) => a.type);
      if (!f.anomalyTypes.some((t) => petAnom.includes(t))) return false;
    }
    if (f.progress !== 'all' && p.trainingProgress !== f.progress) return false;
    if (f.judge !== 'all' && p.trainingJudge !== f.judge) return false;
    if (f.onlyConfirmed === 'confirmed' && !p.confirmed) return false;
    if (f.onlyConfirmed === 'unconfirmed' && p.confirmed) return false;
    if (f.onlyConfirmed === 'revoked' && !p.revoked) return false;
    return true;
  });
}

export { anomalyTypeLabel };
