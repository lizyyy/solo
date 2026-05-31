import React from 'react';
import { Filter, X, RotateCcw, Hash } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { FilterConditions, RecordStatus } from '@/types';

export const FilterPanel: React.FC = () => {
  const { filterConditions, filterFingerprint, applyFilter, resetFilter, isFilterPanelOpen, toggleFilterPanel } = useAppStore();

  const handleChange = (key: keyof FilterConditions, value: any) => {
    const newConditions = { ...filterConditions };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newConditions[key];
    } else {
      (newConditions as any)[key] = value;
    }
    applyFilter(newConditions);
  };

  const handleStatusChange = (status: RecordStatus, checked: boolean) => {
    const currentStatuses = filterConditions.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status);
    handleChange('status', newStatuses);
  };

  const hasActiveFilters = Object.keys(filterConditions).length > 0;

  if (!isFilterPanelOpen) {
    return (
      <div className="border-b border-primary-200 bg-primary-50 p-2">
        <button
          onClick={toggleFilterPanel}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-100 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>展开筛选</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-info-500 text-white font-mono">
              {Object.keys(filterConditions).length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-primary-200 bg-primary-50">
      <div className="flex items-center justify-between p-3 border-b border-primary-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary-500" />
          <span className="font-mono font-medium text-primary-700 text-sm">筛选条件</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-info-500 text-white font-mono">
              {Object.keys(filterConditions).length} 个条件
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={resetFilter}
              className="flex items-center gap-1 px-2 py-1 text-xs text-primary-500 hover:text-primary-700 hover:bg-primary-100 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          )}
          <button
            onClick={toggleFilterPanel}
            className="p-1 hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">战报ID</label>
          <input
            type="text"
            value={filterConditions.battleId || ''}
            onChange={(e) => handleChange('battleId', e.target.value || undefined)}
            placeholder="输入战报ID"
            className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">玩家ID</label>
          <input
            type="text"
            value={filterConditions.playerId || ''}
            onChange={(e) => handleChange('playerId', e.target.value || undefined)}
            placeholder="输入玩家ID"
            className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">玩家名称</label>
          <input
            type="text"
            value={filterConditions.playerName || ''}
            onChange={(e) => handleChange('playerName', e.target.value || undefined)}
            placeholder="输入玩家名称"
            className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">数据状态</label>
          <div className="flex gap-3 flex-wrap">
            {(['normal', 'warning', 'anomaly'] as const).map(status => (
              <label key={status} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterConditions.status?.includes(status) || false}
                  onChange={(e) => handleStatusChange(status, e.target.checked)}
                  className="w-3.5 h-3.5 border-primary-300 text-info-600 focus:ring-info-500"
                />
                <span className={`font-mono ${
                  status === 'normal' ? 'text-success-600' :
                  status === 'warning' ? 'text-warning-600' : 'text-danger-600'
                }`}>
                  {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '异常'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">分数范围</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={filterConditions.scoreRange?.[0] ?? ''}
              onChange={(e) => handleChange('scoreRange', [
                e.target.value ? parseInt(e.target.value) : undefined,
                filterConditions.scoreRange?.[1]
              ])}
              placeholder="最小"
              className="w-full px-2 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
            />
            <span className="text-primary-400">-</span>
            <input
              type="number"
              value={filterConditions.scoreRange?.[1] ?? ''}
              onChange={(e) => handleChange('scoreRange', [
                filterConditions.scoreRange?.[0],
                e.target.value ? parseInt(e.target.value) : undefined
              ])}
              placeholder="最大"
              className="w-full px-2 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">结算范围</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={filterConditions.settlementRange?.[0] ?? ''}
              onChange={(e) => handleChange('settlementRange', [
                e.target.value ? parseInt(e.target.value) : undefined,
                filterConditions.settlementRange?.[1]
              ])}
              placeholder="最小"
              className="w-full px-2 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
            />
            <span className="text-primary-400">-</span>
            <input
              type="number"
              value={filterConditions.settlementRange?.[1] ?? ''}
              onChange={(e) => handleChange('settlementRange', [
                filterConditions.settlementRange?.[0],
                e.target.value ? parseInt(e.target.value) : undefined
              ])}
              placeholder="最大"
              className="w-full px-2 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">战斗时间 (开始)</label>
          <input
            type="datetime-local"
            value={filterConditions.battleTimeRange?.[0]?.replace('Z', '')?.slice(0, 16) || ''}
            onChange={(e) => handleChange('battleTimeRange', [
              e.target.value ? e.target.value + ':00.000Z' : undefined,
              filterConditions.battleTimeRange?.[1]
            ])}
            className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-primary-500 mb-1 font-mono">战斗时间 (结束)</label>
          <input
            type="datetime-local"
            value={filterConditions.battleTimeRange?.[1]?.replace('Z', '')?.slice(0, 16) || ''}
            onChange={(e) => handleChange('battleTimeRange', [
              filterConditions.battleTimeRange?.[0],
              e.target.value ? e.target.value + ':00.000Z' : undefined
            ])}
            className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 focus:ring-1 focus:ring-info-500 font-mono"
          />
        </div>
      </div>

      {filterFingerprint && (
        <div className="px-4 py-2 border-t border-primary-200 bg-primary-100/50 flex items-center gap-2">
          <Hash className="w-3 h-3 text-primary-400" />
          <span className="text-xs text-primary-500 font-mono">筛选指纹: {filterFingerprint}</span>
        </div>
      )}
    </div>
  );
};
