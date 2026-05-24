import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { CrackStatus, STATUS_COLORS, STATUS_LABELS } from '../../types';
import { useInspectionStore } from '../../store/inspectionStore';

const allStatuses: CrackStatus[] = ['new', 'developing', 'stable', 'repaired', 'pending_review'];

export const FilterPanel: React.FC = () => {
  const {
    filters,
    setStatusFilter,
    setSearchQuery,
    getFilteredCracks,
    selectedCrackId,
    setSelectedCrackId,
  } = useInspectionStore();

  const [expanded, setExpanded] = useState(true);
  const filteredCracks = getFilteredCracks();

  const handleStatusToggle = (status: CrackStatus) => {
    const currentStatuses = filters.status;
    if (currentStatuses.includes(status)) {
      setStatusFilter(currentStatuses.filter((s) => s !== status));
    } else {
      setStatusFilter([...currentStatuses, status]);
    }
  };

  const handleSelectAll = () => {
    setStatusFilter([...allStatuses]);
  };

  const handleClearAll = () => {
    setStatusFilter([]);
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div
        className="p-4 border-b border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">筛选与列表</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索裂缝..."
                value={filters.searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">状态筛选</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    全选
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-gray-400 hover:text-gray-300"
                  >
                    清空
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {allStatuses.map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                    />
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    <span className="text-sm text-gray-300">{STATUS_LABELS[status]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">
                  裂缝列表 ({filteredCracks.length})
                </span>
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {filteredCracks.map((crack) => (
                  <div
                    key={crack.id}
                    onClick={() => setSelectedCrackId(crack.id)}
                    className={`p-2 rounded cursor-pointer transition-all ${
                      selectedCrackId === crack.id
                        ? 'bg-blue-600 bg-opacity-20 border border-blue-500'
                        : 'hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[crack.status] }}
                      />
                      <span className="text-sm font-medium text-white truncate">
                        {crack.id}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-400 truncate pl-4">
                      {crack.description}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 pl-4">
                      {crack.length.toFixed(2)}m · {crack.width.toFixed(1)}mm
                    </div>
                  </div>
                ))}
                {filteredCracks.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    无匹配的裂缝
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
