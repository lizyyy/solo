import { useAppStore } from '@/store/appStore';
import { SEVERITY_LABEL, STATUS_LABEL, OPERATORS } from '@/types';
import type { Severity, AlertStatus } from '@/types';
import { X, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { useState } from 'react';

const SEVERITIES: Severity[] = ['mild', 'moderate', 'severe'];
const STATUSES: AlertStatus[] = ['pending', 'in_progress', 'follow_up', 'resolved'];

const sevChipColor = (s: Severity) =>
  s === 'mild'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : s === 'moderate'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';

const statusChipColor = (s: AlertStatus) =>
  s === 'pending'
    ? 'bg-slate-100 text-slate-700 border-slate-200'
    : s === 'in_progress'
      ? 'bg-brand-100 text-brand-700 border-brand-200'
      : s === 'follow_up'
        ? 'bg-violet-100 text-violet-700 border-violet-200'
        : 'bg-emerald-100 text-emerald-700 border-emerald-200';

export default function FilterPanel() {
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);
  const [openGroup, setOpenGroup] = useState<string | null>('severity');

  const toggleArr = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const hasActive =
    filter.keyword ||
    filter.dateFrom ||
    filter.dateTo ||
    filter.severities.length ||
    filter.statuses.length ||
    filter.assignedTo;

  return (
    <aside className="w-72 shrink-0 space-y-4 pr-1 overflow-y-auto h-[calc(100vh-88px)]">
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 section-title">
            <Filter size={16} className="text-brand-500" />
            筛选条件
          </div>
          {hasActive && (
            <button
              onClick={resetFilter}
              className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1 transition"
            >
              <RefreshCw size={12} />
              重置
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label className="label">关键字</label>
          <div className="relative">
            <input
              className="input pl-8"
              placeholder="宠物名 / 主人 / 品种 / 电话"
              value={filter.keyword}
              onChange={(e) => setFilter({ keyword: e.target.value })}
            />
            {filter.keyword && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setFilter({ keyword: '' })}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="label">提醒日期范围</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="input text-xs"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ dateFrom: e.target.value })}
            />
            <input
              type="date"
              className="input text-xs"
              value={filter.dateTo}
              onChange={(e) => setFilter({ dateTo: e.target.value })}
            />
          </div>
        </div>

        <Collapse
          title="异常等级"
          count={filter.severities.length}
          open={openGroup === 'severity'}
          onToggle={() => setOpenGroup(openGroup === 'severity' ? null : 'severity')}
        >
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => {
              const active = filter.severities.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setFilter({ severities: toggleArr(filter.severities, s) })}
                  className={`chip border transition ${
                    active ? sevChipColor(s) + ' shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {SEVERITY_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Collapse>

        <Collapse
          title="处理状态"
          count={filter.statuses.length}
          open={openGroup === 'status'}
          onToggle={() => setOpenGroup(openGroup === 'status' ? null : 'status')}
        >
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => {
              const active = filter.statuses.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setFilter({ statuses: toggleArr(filter.statuses, s) })}
                  className={`chip border transition ${
                    active ? statusChipColor(s) + ' shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </Collapse>

        <Collapse
          title="负责人"
          count={filter.assignedTo ? 1 : 0}
          open={openGroup === 'assignee'}
          onToggle={() => setOpenGroup(openGroup === 'assignee' ? null : 'assignee')}
        >
          <select
            className="input text-xs"
            value={filter.assignedTo}
            onChange={(e) => setFilter({ assignedTo: e.target.value })}
          >
            <option value="">全部负责人</option>
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </Collapse>
      </div>

      <div className="card p-4">
        <div className="label mb-2">当前条件摘要</div>
        <div className="text-xs text-slate-600 space-y-1.5 min-h-[40px]">
          {!hasActive && <p className="text-slate-400 italic">暂无筛选条件，展示全部异常提醒</p>}
          {filter.keyword && <Line label="关键字" value={filter.keyword} onClear={() => setFilter({ keyword: '' })} />}
          {(filter.dateFrom || filter.dateTo) && (
            <Line
              label="日期"
              value={`${filter.dateFrom || '…'} ~ ${filter.dateTo || '…'}`}
              onClear={() => setFilter({ dateFrom: '', dateTo: '' })}
            />
          )}
          {filter.severities.length > 0 && (
            <Line
              label="等级"
              value={filter.severities.map((s) => SEVERITY_LABEL[s]).join('/')}
              onClear={() => setFilter({ severities: [] })}
            />
          )}
          {filter.statuses.length > 0 && (
            <Line
              label="状态"
              value={filter.statuses.map((s) => STATUS_LABEL[s]).join('/')}
              onClear={() => setFilter({ statuses: [] })}
            />
          )}
          {filter.assignedTo && (
            <Line label="负责人" value={filter.assignedTo} onClear={() => setFilter({ assignedTo: '' })} />
          )}
        </div>
      </div>
    </aside>
  );
}

function Collapse({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          {title}
          {!!count && (
            <span className="chip bg-brand-50 text-brand-600 border border-brand-100 text-[10px]">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-3 pb-3 pt-1 bg-slate-50/50 border-t border-slate-100">{children}</div>}
    </div>
  );
}

function Line({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex gap-1.5 flex-1 min-w-0">
        <span className="text-slate-400 shrink-0">{label}:</span>
        <span className="font-medium text-slate-700 truncate">{value}</span>
      </div>
      <button onClick={onClear} className="text-slate-400 hover:text-danger shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}
