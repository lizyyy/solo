import React, { useState } from 'react';
import { SignalPoint, PointStatus } from '../types';
import { getHumanReadableStatus, getSourceTypeLabel } from '../utils/conflictCheck';

interface PointListProps {
  points: SignalPoint[];
  selectedPointId?: string;
  onPointSelect: (point: SignalPoint) => void;
}

const statusFilters: { label: string; value: PointStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '通过', value: 'approved' },
  { label: '待确认', value: 'pending' },
  { label: '冲突', value: 'conflict' },
  { label: '历史', value: 'legacy' },
];

export default function PointList({ points, selectedPointId, onPointSelect }: PointListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PointStatus | 'all'>('all');
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);

  const filteredPoints = points.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.street.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesConflict = !showConflictsOnly || p.hasConflict;
    return matchesSearch && matchesStatus && matchesConflict;
  });

  const getStatusBadgeClass = (point: SignalPoint) => {
    if (point.hasConflict) return 'bg-red-100 text-red-700 border-red-200';
    switch (point.status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'legacy': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-800 mb-3">点位列表</h3>
        
        <input
          type="text"
          placeholder="搜索点位名称或街道..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex flex-wrap gap-2 mb-3">
          {statusFilters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-2 py-1 text-xs rounded border transition-colors ${
                statusFilter === filter.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showConflictsOnly}
            onChange={(e) => setShowConflictsOnly(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          只显示有冲突的点位
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredPoints.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            没有找到匹配的点位
          </div>
        ) : (
          filteredPoints.map(point => (
            <div
              key={point.id}
              onClick={() => onPointSelect(point)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                selectedPointId === point.id
                  ? 'bg-blue-50 border-l-4 border-l-blue-500'
                  : 'hover:bg-slate-50 border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-slate-800 text-sm truncate">
                    {point.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">{point.location}</p>
                  <p className="text-xs text-slate-400 mt-1">{point.street}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className={`px-2 py-0.5 text-xs rounded border ${getStatusBadgeClass(point)}`}>
                    {getHumanReadableStatus(point)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {getSourceTypeLabel(point.sourceType)}
                  </span>
                </div>
              </div>
              
              {point.hasConflict && point.conflictNote && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700 border border-red-100">
                  ⚠️ {point.conflictNote}
                </div>
              )}
              
              {point.manualNote && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-100">
                  📝 {point.manualNote}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        共 {filteredPoints.length} 个点位 / {points.length} 总数
      </div>
    </div>
  );
}
