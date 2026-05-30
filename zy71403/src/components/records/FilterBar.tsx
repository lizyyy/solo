import { useValuationStore } from '../../store/useValuationStore';
import { STATUS_LABELS, SUBMIT_TYPE_LABELS, type RecordStatus, type SubmitType } from '../../types';
import { Filter, RotateCcw, Download, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

export function FilterBar() {
  const { filters, setFilters, resetFilters, funds } = useValuationStore(useShallow((state) => ({
    filters: state.filters,
    setFilters: state.setFilters,
    resetFilters: state.resetFilters,
    funds: state.funds,
  })));
  
  const valuationVersions = Array.from(new Set(useValuationStore.getState().valuations.map(v => v.valuationVersion))).sort();
  
  const hasActiveFilters = 
    filters.fundIds.length > 0 || 
    filters.dateRange !== null || 
    filters.statuses.length > 0 || 
    filters.valuationVersions.length > 0 || 
    filters.submitTypes.length > 0 || 
    filters.hasAnomaly !== null;
  
  const handleFundChange = (fundId: string) => {
    const newFundIds = filters.fundIds.includes(fundId)
      ? filters.fundIds.filter(id => id !== fundId)
      : [...filters.fundIds, fundId];
    setFilters({ fundIds: newFundIds });
  };
  
  const handleStatusChange = (status: RecordStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    setFilters({ statuses: newStatuses });
  };
  
  const handleSubmitTypeChange = (type: SubmitType) => {
    const newTypes = filters.submitTypes.includes(type)
      ? filters.submitTypes.filter(t => t !== type)
      : [...filters.submitTypes, type];
    setFilters({ submitTypes: newTypes });
  };
  
  const handleVersionChange = (version: string) => {
    const newVersions = filters.valuationVersions.includes(version)
      ? filters.valuationVersions.filter(v => v !== version)
      : [...filters.valuationVersions, version];
    setFilters({ valuationVersions: newVersions });
  };
  
  const handleAnomalyChange = (value: boolean | null) => {
    setFilters({ hasAnomaly: value });
  };
  
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (!filters.dateRange) {
      if (type === 'start') {
        setFilters({ dateRange: [value, ''] });
      } else {
        setFilters({ dateRange: ['', value] });
      }
    } else {
      const newRange: [string, string] = type === 'start' 
        ? [value, filters.dateRange[1]]
        : [filters.dateRange[0], value];
      setFilters({ dateRange: newRange });
    }
  };
  
  return (
    <div className="bg-white border-b border-slate-200 p-4 sticky top-[65px] z-30">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">筛选条件</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </button>
        )}
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 text-white text-xs font-medium rounded-lg hover:bg-navy-800 transition-colors btn-click">
          <Download className="w-3.5 h-3.5" />
          导出
        </button>
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">基金:</label>
          <div className="flex flex-wrap gap-1.5">
            {funds.map(fund => (
              <button
                key={fund.fundId}
                onClick={() => handleFundChange(fund.fundId)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  filters.fundIds.includes(fund.fundId)
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
              >
                {fund.fundCode}
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-px h-6 bg-slate-200" />
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">状态:</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABELS) as RecordStatus[]).map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  filters.statuses.includes(status)
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-px h-6 bg-slate-200" />
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">估值日期:</label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filters.dateRange?.[0] || ''}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-sky-400"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={filters.dateRange?.[1] || ''}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-sky-400"
            />
          </div>
        </div>
        
        <div className="w-px h-6 bg-slate-200 hidden md:block" />
        
        <div className="flex items-center gap-2 hidden md:flex">
          <label className="text-xs text-slate-500 whitespace-nowrap">提交类型:</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SUBMIT_TYPE_LABELS) as SubmitType[]).map(type => (
              <button
                key={type}
                onClick={() => handleSubmitTypeChange(type)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  filters.submitTypes.includes(type)
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
              >
                {SUBMIT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-px h-6 bg-slate-200 hidden lg:block" />
        
        <div className="flex items-center gap-2 hidden lg:flex">
          <label className="text-xs text-slate-500 whitespace-nowrap">版本:</label>
          <div className="flex flex-wrap gap-1.5">
            {valuationVersions.map(version => (
              <button
                key={version}
                onClick={() => handleVersionChange(version)}
                className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                  filters.valuationVersions.includes(version)
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
              >
                {version}
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-px h-6 bg-slate-200 hidden lg:block" />
        
        <div className="flex items-center gap-2 hidden lg:flex">
          <label className="text-xs text-slate-500 whitespace-nowrap">异常:</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleAnomalyChange(true)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                filters.hasAnomaly === true
                  ? 'bg-rose-500 text-white border-rose-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
              }`}
            >
              有异常
            </button>
            <button
              onClick={() => handleAnomalyChange(false)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                filters.hasAnomaly === false
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
              }`}
            >
              无异常
            </button>
            {filters.hasAnomaly !== null && (
              <button
                onClick={() => handleAnomalyChange(null)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
