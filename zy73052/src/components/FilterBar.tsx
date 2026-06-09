import type { Filters, CraneStatus } from '../types';
import { CRANE_OPTIONS, CATEGORY_OPTIONS, STATUS_OPTIONS } from '../dataService';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onRun: () => void;
  running: boolean;
}

function toggleInList<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function FilterBar({ filters, onChange, onRun, running }: Props) {
  return (
    <section className="panel filter-bar">
      <div className="filter-row">
        <label>
          <span>开始日期</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          />
        </label>
        <label>
          <span>结束日期</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          />
        </label>
        <label className="grow">
          <span>塔吊</span>
          <div className="chip-group">
            {CRANE_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${filters.craneIds.includes(c.id) ? 'chip-on' : ''}`}
                onClick={() => onChange({ ...filters, craneIds: toggleInList(filters.craneIds, c.id) })}
              >
                {c.id}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="filter-row">
        <label className="grow">
          <span>部件类别</span>
          <div className="chip-group">
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${filters.categories.includes(c) ? 'chip-on' : ''}`}
                onClick={() => onChange({ ...filters, categories: toggleInList(filters.categories, c) })}
              >
                {c}
              </button>
            ))}
          </div>
        </label>
        <label className="grow">
          <span>记录状态</span>
          <div className="chip-group">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`chip chip-${s.value} ${filters.statuses.includes(s.value as CraneStatus) ? 'chip-on' : ''}`}
                onClick={() => onChange({ ...filters, statuses: toggleInList(filters.statuses, s.value as CraneStatus) })}
              >
                {s.label}
              </button>
            ))}
          </div>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={filters.onlyAnomaly}
            onChange={(e) => onChange({ ...filters, onlyAnomaly: e.target.checked })}
          />
          <span>只看异常</span>
        </label>
      </div>

      <div className="filter-row actions">
        <button className="btn primary" onClick={onRun} disabled={running}>
          {running ? '生成中…' : '生成排程结果'}
        </button>
        <span className="hint">筛选 → 生成 → 全部数字/明细/摘要 基于同一份结果</span>
      </div>
    </section>
  );
}
