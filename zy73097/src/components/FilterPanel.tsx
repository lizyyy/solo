import { Search, RotateCcw, Download, CalendarRange, Layers, Filter } from 'lucide-react';
import { useMaterialStore } from '../store';
import { FIRE_ZONES, MATERIAL_TYPES, STATUS_LABEL } from '../types';
import type { MaterialStatus } from '../types';

export function FilterPanel() {
  const filters = useMaterialStore((s) => s.filters);
  const setFilters = useMaterialStore((s) => s.setFilters);
  const resetFilters = useMaterialStore((s) => s.resetFilters);
  const total = useMaterialStore((s) => s.records.length);

  const hasActive =
    filters.fireZone ||
    filters.type ||
    filters.status ||
    filters.hasAbnormality !== null ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.keyword;

  return (
    <div className="card p-4 bg-ink-100 bg-noise-light relative">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-navy-500" />
        <h2 className="font-song font-bold text-navy-700 text-sm tracking-wide">
          筛选条件（与统计 · 明细表 · 时间线 共用同一结果集）
        </h2>
        <span className="ml-auto text-xs text-ink-500">
          共 <b className="font-mono text-navy-700 tn">{total}</b> 条送审记录
        </span>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-3">
          <div className="field-label">关键字</div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-ink-500" />
            <input
              className="field-input pl-8"
              placeholder="材料编号 / 名称 / 分区 / 图层…"
              value={filters.keyword}
              onChange={(e) => setFilters({ keyword: e.target.value })}
            />
          </div>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label">消防分区</div>
          <select
            className="field-input"
            value={filters.fireZone ?? ''}
            onChange={(e) => setFilters({ fireZone: e.target.value || null })}
          >
            <option value="">全部分区</option>
            {FIRE_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label">材料类型</div>
          <select
            className="field-input"
            value={filters.type ?? ''}
            onChange={(e) => setFilters({ type: e.target.value || null })}
          >
            <option value="">全部类型</option>
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label">审核状态</div>
          <select
            className="field-input"
            value={filters.status ?? ''}
            onChange={(e) =>
              setFilters({ status: (e.target.value as MaterialStatus) || null })
            }
          >
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label flex items-center gap-1">
            <Layers size={11} />
            图层异常
          </div>
          <select
            className="field-input"
            value={
              filters.hasAbnormality === null
                ? ''
                : filters.hasAbnormality
                  ? '1'
                  : '0'
            }
            onChange={(e) =>
              setFilters({
                hasAbnormality:
                  e.target.value === '' ? null : e.target.value === '1',
              })
            }
          >
            <option value="">全部</option>
            <option value="1">仅异常</option>
            <option value="0">仅正常</option>
          </select>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label flex items-center gap-1">
            <CalendarRange size={11} />
            送审起
          </div>
          <input
            type="date"
            className="field-input"
            value={filters.dateFrom ?? ''}
            onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
          />
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="field-label">送审止</div>
          <input
            type="date"
            className="field-input"
            value={filters.dateTo ?? ''}
            onChange={(e) => setFilters({ dateTo: e.target.value || null })}
          />
        </div>

        <div className="col-span-12 md:col-span-2 flex items-end gap-2 md:justify-end">
          <button
            className="btn btn-ghost"
            onClick={resetFilters}
            disabled={!hasActive}
          >
            <RotateCcw size={14} />
            重置
          </button>
          <button
            className="btn"
            onClick={() => {
              alert('导出功能：将当前筛选结果（明细表+统计+时间线）打包为 Excel');
            }}
          >
            <Download size={14} />
            导出
          </button>
        </div>
      </div>
    </div>
  );
}
