import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  X,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  Merge,
  Clock,
  User,
} from 'lucide-react';
import { useAppStore } from '../store';
import type { Conflict } from '../types';
import { cn } from '../lib/utils';

export const ConflictsPage: React.FC = () => {
  const { conflicts, obstacles, resolveConflict, currentUser } = useAppStore();
  const [filterType, setFilterType] = useState<'all' | Conflict['type']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | Conflict['status'] | 'review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mergedName, setMergedName] = useState('');

  const filteredConflicts = conflicts.filter((c) => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterStatus === 'review') {
      if (!c.requiresReview) return false;
    } else if (filterStatus !== 'all' && c.status !== filterStatus) {
      return false;
    }
    if (searchQuery) {
      const names = c.obstacleIds.map(
        (id) => obstacles.find((o) => o.id === id)?.currentName || ''
      );
      return names.some((n) => n.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  const getConflictTypeName = (type: Conflict['type']) => {
    const types = {
      'duplicate-name': '多名称冲突',
      'position-overlap': '位置重叠',
      'data-inconsistency': '数据不一致',
    };
    return types[type] || type;
  };

  const getStatusBadge = (conflict: Conflict) => {
    if (conflict.requiresReview && conflict.status !== 'pending') {
      return (
        <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded flex items-center gap-1">
          <Eye size={10} />
          待复核
        </span>
      );
    }
    switch (conflict.status) {
      case 'pending':
        return (
          <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle size={10} />
            待处理
          </span>
        );
      case 'confirmed':
        return (
          <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1">
            <Check size={10} />
            已确认
          </span>
        );
      case 'rejected':
        return (
          <span className="text-xs text-zinc-400 bg-zinc-500/10 px-2 py-0.5 rounded flex items-center gap-1">
            <X size={10} />
            已驳回
          </span>
        );
    }
  };

  const handleResolve = async (
    conflictId: string,
    resolution: 'confirmed' | 'rejected'
  ) => {
    await resolveConflict(
      conflictId,
      resolution,
      resolution === 'confirmed' ? mergedName : undefined
    );
    setExpandedId(null);
    setMergedName('');
  };

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">冲突处理</h1>
          <p className="text-zinc-500">
            管理和解决障碍物标注冲突，支持批量操作和复核流程
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索障碍物名称..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部类型</option>
              <option value="duplicate-name">多名称冲突</option>
              <option value="position-overlap">位置重叠</option>
              <option value="data-inconsistency">数据不一致</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="confirmed">已确认</option>
              <option value="rejected">已驳回</option>
              <option value="review">待复核</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">总冲突数</p>
            <p className="text-2xl font-bold text-zinc-200">{conflicts.length}</p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">待处理</p>
            <p className="text-2xl font-bold text-red-400">
              {conflicts.filter((c) => c.status === 'pending').length}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">待复核</p>
            <p className="text-2xl font-bold text-orange-400">
              {conflicts.filter((c) => c.requiresReview && c.status !== 'pending').length}
            </p>
          </div>
          <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">已解决</p>
            <p className="text-2xl font-bold text-green-400">
              {conflicts.filter((c) => c.status !== 'pending' && !c.requiresReview).length}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {filteredConflicts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800">
              <AlertTriangle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg">没有找到符合条件的冲突</p>
            </div>
          ) : (
            filteredConflicts.map((conflict) => {
              const obs1 = obstacles.find((o) => o.id === conflict.obstacleIds[0]);
              const obs2 = obstacles.find((o) => o.id === conflict.obstacleIds[1]);
              const isExpanded = expandedId === conflict.id;

              return (
                <div
                  key={conflict.id}
                  className={cn(
                    'bg-zinc-900 rounded-xl border transition-all',
                    isExpanded ? 'border-blue-500/50' : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          conflict.type === 'duplicate-name'
                            ? 'bg-purple-500/20 text-purple-400'
                            : conflict.type === 'position-overlap'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-red-500/20 text-red-400'
                        )}
                      >
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-zinc-200">
                            {getConflictTypeName(conflict.type)}
                          </span>
                          {getStatusBadge(conflict)}
                        </div>
                        <div className="text-sm text-zinc-500 flex items-center gap-2">
                          <span className="text-blue-400">{obs1?.currentName || '未知'}</span>
                          <span>⟷</span>
                          <span className="text-orange-400">{obs2?.currentName || '未知'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="text-zinc-400">
                          重叠率: {(conflict.evidence.overlapPercentage * 100).toFixed(1)}%
                        </div>
                        <div className="text-zinc-600 flex items-center gap-1 justify-end">
                          <Clock size={12} />
                          {new Date(conflict.createdAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={20} className="text-zinc-500" />
                      ) : (
                        <ChevronDown size={20} className="text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-zinc-800 pt-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                          <div className="text-xs text-blue-400 mb-2 flex items-center gap-1">
                            <Merge size={12} />
                            草图来源
                          </div>
                          <div className="font-medium text-zinc-200 mb-2">
                            {obs1?.currentName}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            位置: ({obs1?.position.x.toFixed(2)}, {obs1?.position.y.toFixed(2)}, {obs1?.position.z.toFixed(2)})
                          </div>
                          {obs1?.nameHistory && obs1.nameHistory.length > 1 && (
                            <div className="mt-2 text-xs text-zinc-600">
                              历史名称: {obs1.nameHistory.map(h => h.name).join(' → ')}
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                          <div className="text-xs text-orange-400 mb-2 flex items-center gap-1">
                            <Merge size={12} />
                            点云来源
                          </div>
                          <div className="font-medium text-zinc-200 mb-2">
                            {obs2?.currentName}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            位置: ({obs2?.position.x.toFixed(2)}, {obs2?.position.y.toFixed(2)}, {obs2?.position.z.toFixed(2)})
                          </div>
                          {obs2?.nameHistory && obs2.nameHistory.length > 1 && (
                            <div className="mt-2 text-xs text-zinc-600">
                              历史名称: {obs2.nameHistory.map(h => h.name).join(' → ')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-zinc-800/30 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">位置重叠率</div>
                          <div className="text-lg font-bold text-orange-400">
                            {(conflict.evidence.overlapPercentage * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="p-3 bg-zinc-800/30 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">名称相似度</div>
                          <div className="text-lg font-bold text-blue-400">
                            {(conflict.evidence.nameSimilarity * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="p-3 bg-zinc-800/30 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">坐标差异</div>
                          <div className="text-sm font-mono text-zinc-300">
                            ΔX: {conflict.evidence.coordinateDiff.x.toFixed(2)}
                            <br />
                            ΔY: {conflict.evidence.coordinateDiff.y.toFixed(2)}
                            <br />
                            ΔZ: {conflict.evidence.coordinateDiff.z.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {conflict.status === 'pending' && (
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-xs text-zinc-500 block mb-2">合并后名称</label>
                            <input
                              type="text"
                              value={mergedName || obs1?.currentName || ''}
                              onChange={(e) => setMergedName(e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <button
                            onClick={() => handleResolve(conflict.id, 'confirmed')}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                          >
                            <Check size={16} />
                            确认合并
                          </button>
                          <button
                            onClick={() => handleResolve(conflict.id, 'rejected')}
                            className="flex items-center gap-2 px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors"
                          >
                            <X size={16} />
                            驳回
                          </button>
                        </div>
                      )}

                      {conflict.resolvedBy && (
                        <div className="text-sm text-zinc-500 flex items-center gap-2">
                          <User size={14} />
                          <span>
                            由 {conflict.resolvedBy} 于{' '}
                            {conflict.resolvedAt
                              ? new Date(conflict.resolvedAt).toLocaleString('zh-CN')
                              : ''}{' '}
                            {conflict.resolution === 'confirmed' ? '确认合并' : '驳回'}
                          </span>
                        </div>
                      )}

                      {conflict.reviewedBy && (
                        <div className="text-sm text-zinc-500 flex items-center gap-2 mt-2">
                          <Eye size={14} />
                          <span>
                            复核人: {conflict.reviewedBy} - {conflict.reviewComment}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
