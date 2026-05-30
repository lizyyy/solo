import { useState } from 'react';
import { Search, Calendar, Filter, Save, Trash2, RotateCcw } from 'lucide-react';
import type { FilterCriteria, FilterSnapshot } from '@/types';
import { RequirementStatus } from '@/types';
import { getStatusLabel } from '@/utils/helpers';

interface FilterPanelProps {
  currentFilters: FilterCriteria;
  filterSnapshots: FilterSnapshot[];
  onFilterChange: (filters: Partial<FilterCriteria>) => void;
  onResetFilters: () => void;
  onSaveSnapshot: (name: string) => void;
  onDeleteSnapshot: (id: string) => void;
  onApplySnapshot: (id: string) => void;
}

export function FilterPanel({
  currentFilters,
  filterSnapshots,
  onFilterChange,
  onResetFilters,
  onSaveSnapshot,
  onDeleteSnapshot,
  onApplySnapshot
}: FilterPanelProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSave = () => {
    if (snapshotName.trim()) {
      onSaveSnapshot(snapshotName.trim());
      setSnapshotName('');
      setShowSaveDialog(false);
    }
  };

  const hasActiveFilters = Object.values(currentFilters).some(
    (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : v !== false)
  );

  return (
    <div className="panel">
      <div 
        className="panel-header flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neon-purple" />
          筛选条件
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-[10px] bg-neon-purple text-black font-bold">
              已启用
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-base-500">
          {isExpanded ? '收起' : '展开'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono text-base-500 mb-1">
                <Search className="w-3 h-3 inline mr-1" />
                乐队名称
              </label>
              <input
                type="text"
                value={currentFilters.bandName || ''}
                onChange={(e) => onFilterChange({ bandName: e.target.value || undefined })}
                placeholder="搜索乐队..."
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-base-500 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                日期从
              </label>
              <input
                type="date"
                value={currentFilters.dateFrom || ''}
                onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-base-500 mb-1">
                <Calendar className="w-3 h-3 inline mr-1" />
                日期至
              </label>
              <input
                type="date"
                value={currentFilters.dateTo || ''}
                onChange={(e) => onFilterChange({ dateTo: e.target.value || undefined })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-base-500 mb-1">状态</label>
              <div className="flex flex-wrap gap-2">
                {[RequirementStatus.NORMAL, RequirementStatus.PENDING, RequirementStatus.CONFLICT].map((status) => {
                  const isSelected = currentFilters.status?.includes(status);
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        const current = currentFilters.status || [];
                        const next = isSelected
                          ? current.filter((s) => s !== status)
                          : [...current, status];
                        onFilterChange({ status: next.length > 0 ? next : undefined });
                      }}
                      className={`px-2 py-1 text-xs font-mono border transition-colors
                        ${isSelected 
                          ? 'bg-neon-purple border-neon-purple text-black' 
                          : 'border-base-600 text-base-500 hover:border-base-500'
                        }`}
                    >
                      {getStatusLabel(status)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentFilters.hasConflict === true}
                onChange={(e) => {
                  if (e.target.checked) {
                    onFilterChange({ hasConflict: true });
                  } else if (currentFilters.hasConflict !== undefined) {
                    onFilterChange({ hasConflict: undefined });
                  }
                }}
                className="w-4 h-4 bg-base-900 border-2 border-base-600"
              />
              <span className="text-sm font-mono">仅显示有冲突</span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-base-700">
            <div className="flex items-center gap-2">
              <button
                onClick={onResetFilters}
                className="btn btn-ghost flex items-center gap-1 text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                重置
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="btn btn-primary flex items-center gap-1 text-xs"
              >
                <Save className="w-3 h-3" />
                保存快照
              </button>
            </div>

            {filterSnapshots.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-base-500">已保存快照:</span>
                {filterSnapshots.map((snapshot) => (
                  <div key={snapshot.id} className="flex items-center gap-1">
                    <button
                      onClick={() => onApplySnapshot(snapshot.id)}
                      className="px-2 py-1 text-xs font-mono border border-base-600 hover:border-neon-purple hover:text-neon-purple transition-colors"
                    >
                      {snapshot.name}
                    </button>
                    <button
                      onClick={() => onDeleteSnapshot(snapshot.id)}
                      className="p-1 text-base-500 hover:text-neon-red transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showSaveDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
              <div className="panel p-6 w-96">
                <h3 className="font-display font-bold text-lg mb-4">保存筛选快照</h3>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="输入快照名称..."
                  className="input-field mb-4"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSnapshotName('');
                    }}
                    className="btn btn-ghost"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={!snapshotName.trim()}
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
