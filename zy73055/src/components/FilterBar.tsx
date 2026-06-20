import { Search, RotateCcw, Filter, Calendar } from 'lucide-react';
import { useWorkOrderStore } from '../store/workOrderStore';
import { STATUS_LABELS, JUDGMENT_LABELS, PRIORITY_LABELS, SHIFT_LABELS } from '../types';
import type { OrderStatus, Judgment, Priority, Shift } from '../types';

const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high', 'critical'];

export function FilterBar() {
  const { filters, setFilters, resetFilters, workOrders } = useWorkOrderStore();

  const deviceOptions = Array.from(new Set(workOrders.map(o => o.deviceNo))).sort();
  const dateMin = workOrders.length ? workOrders.reduce((a, b) => a.reportTime < b.reportTime ? a : b).reportTime.slice(0, 10) : '';
  const dateMax = workOrders.length ? workOrders.reduce((a, b) => a.reportTime > b.reportTime ? a : b).reportTime.slice(0, 10) : '';

  const selectCls = "text-xs rounded border border-slate-300 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600/30 focus:border-slate-600";

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Filter className="w-4 h-4" />
          筛选条件 <span className="text-[11px] text-slate-500 font-normal ml-1">（结果驱动统计/明细/异常队列）</span>
        </div>
        <button
          onClick={resetFilters}
          className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> 重置
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="col-span-2 flex items-center gap-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute ml-2 pointer-events-none" />
          <input
            type="text"
            placeholder="搜索 设备/工单编号"
            value={filters.searchKeyword ?? ''}
            onChange={(e) => setFilters({ searchKeyword: e.target.value || null })}
            className="w-full text-xs rounded border border-slate-300 bg-white pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600/30 focus:border-slate-600"
          />
        </div>

        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400 absolute ml-2 pointer-events-none" />
          <input
            type="date"
            value={filters.dateRange?.[0] ?? dateMin}
            min={dateMin}
            max={dateMax}
            onChange={(e) => setFilters({ dateRange: [e.target.value, filters.dateRange?.[1] ?? dateMax] })}
            className={`${selectCls} pl-7 w-full`}
          />
        </div>

        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400 absolute ml-2 pointer-events-none" />
          <input
            type="date"
            value={filters.dateRange?.[1] ?? dateMax}
            min={dateMin}
            max={dateMax}
            onChange={(e) => setFilters({ dateRange: [filters.dateRange?.[0] ?? dateMin, e.target.value] })}
            className={`${selectCls} pl-7 w-full`}
          />
        </div>

        <select
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ status: (e.target.value as OrderStatus) || null })}
          className={selectCls}
        >
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.judgment ?? ''}
          onChange={(e) => setFilters({ judgment: (e.target.value as Judgment) || null })}
          className={selectCls}
        >
          <option value="">全部判断</option>
          {Object.entries(JUDGMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.priority ?? ''}
          onChange={(e) => setFilters({ priority: (e.target.value as Priority) || null })}
          className={selectCls}
        >
          <option value="">全部优先级</option>
          {PRIORITY_ORDER.map(k => (
            <option key={k} value={k}>{PRIORITY_LABELS[k]}</option>
          ))}
        </select>

        <select
          value={filters.shift ?? ''}
          onChange={(e) => setFilters({ shift: (e.target.value as Shift) || null })}
          className={selectCls}
        >
          <option value="">全部班次</option>
          {Object.entries(SHIFT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.hasLateArrival === null ? '' : String(filters.hasLateArrival)}
          onChange={(e) => setFilters({ hasLateArrival: e.target.value === '' ? null : e.target.value === 'true' })}
          className={selectCls}
        >
          <option value="">晚到附件：全部</option>
          <option value="true">含晚到附件</option>
          <option value="false">无晚到附件</option>
        </select>

        <select
          value={filters.hitsOldTerminology === null ? '' : String(filters.hitsOldTerminology)}
          onChange={(e) => setFilters({ hitsOldTerminology: e.target.value === '' ? null : e.target.value === 'true' })}
          className={selectCls}
        >
          <option value="">旧说法：全部</option>
          <option value="true">命中旧说法</option>
          <option value="false">未命中</option>
        </select>

        <div className="col-span-2 lg:col-span-2 flex items-center gap-2">
          <select
            value={filters.exactDeviceNo && deviceOptions.includes(filters.exactDeviceNo) ? filters.exactDeviceNo : ''}
            onChange={(e) => setFilters({ exactDeviceNo: e.target.value || null })}
            className={`${selectCls} flex-1 min-w-0`}
          >
            <option value="">快速选择设备...</option>
            {deviceOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
