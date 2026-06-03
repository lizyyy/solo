import React, { useState, useEffect } from 'react';
import {
  Box,
  AlertTriangle,
  Check,
  X,
  Eye,
  History,
  ChevronRight,
  User,
  Clock,
  Tag,
  Info,
} from 'lucide-react';
import { Scene3D } from '../components/Scene3D';
import { useAppStore } from '../store';
import type { Obstacle, Conflict } from '../types';
import { cn } from '../lib/utils';

export const WorkbenchPage: React.FC = () => {
  const { obstacles, conflicts, resolveConflict, reviewConflict, currentUser } = useAppStore();
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const [mergedName, setMergedName] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);

  const selectedObstacle = obstacles.find(o => o.id === selectedObstacleId);
  const selectedConflict = conflicts.find(c => c.id === selectedConflictId);

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const reviewConflicts = conflicts.filter(c => c.requiresReview && c.status !== 'pending');

  useEffect(() => {
    if (selectedConflict) {
      const obs1 = obstacles.find(o => o.id === selectedConflict.obstacleIds[0]);
      if (obs1) {
        setMergedName(obs1.currentName);
      }
    }
  }, [selectedConflict, obstacles]);

  const handleResolveConflict = async (resolution: 'confirmed' | 'rejected') => {
    if (!selectedConflictId) return;
    await resolveConflict(
      selectedConflictId,
      resolution,
      resolution === 'confirmed' ? mergedName : undefined
    );
    setSelectedConflictId(null);
  };

  const handleReview = async () => {
    if (!selectedConflictId || !reviewComment) return;
    await reviewConflict(selectedConflictId, reviewComment);
    setSelectedConflictId(null);
    setReviewComment('');
  };

  const getConflictTypeName = (type: Conflict['type']) => {
    const types = {
      'duplicate-name': '多名称冲突',
      'position-overlap': '位置重叠',
      'data-inconsistency': '数据不一致',
    };
    return types[type] || type;
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Box className="text-blue-400" size={20} />
          <h1 className="text-lg font-semibold">标注工作台</h1>
          <span className="text-sm text-zinc-500">
            {obstacles.filter(o => o.status !== 'merged').length} 个障碍物
          </span>
        </div>
        <div className="flex items-center gap-4">
          {pendingConflicts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-sm">
              <AlertTriangle size={14} />
              <span>{pendingConflicts.length} 个待处理</span>
            </div>
          )}
          {reviewConflicts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 text-sm">
              <Eye size={14} />
              <span>{reviewConflicts.length} 个待复核</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <Scene3D
            obstacles={obstacles}
            selectedObstacleId={selectedObstacleId}
            onSelectObstacle={setSelectedObstacleId}
          />

          <div className="absolute bottom-4 left-4 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-lg p-3 text-xs text-zinc-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                <span>草图来源</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                <span>点云来源</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-sm animate-pulse" />
                <span>存在冲突</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-96 border-l border-zinc-800 bg-zinc-950 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-200">冲突列表</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {pendingConflicts.length === 0 && reviewConflicts.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
                <p>暂无冲突</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {pendingConflicts.map((conflict) => (
                  <button
                    key={conflict.id}
                    onClick={() => {
                      setSelectedConflictId(conflict.id);
                      setShowEvidence(true);
                    }}
                    className={cn(
                      'w-full p-4 text-left hover:bg-zinc-900 transition-colors',
                      selectedConflictId === conflict.id && 'bg-zinc-900'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-zinc-200">
                          {getConflictTypeName(conflict.type)}
                        </span>
                      </div>
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        待处理
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {conflict.obstacleIds.map((id, i) => {
                        const obs = obstacles.find(o => o.id === id);
                        return (
                          <span key={id} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight size={10} />}
                            <Tag size={10} />
                            {obs?.currentName || '未知'}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">
                      重叠率: {(conflict.evidence.overlapPercentage * 100).toFixed(1)}%
                    </div>
                  </button>
                ))}

                {reviewConflicts.map((conflict) => (
                  <button
                    key={conflict.id}
                    onClick={() => {
                      setSelectedConflictId(conflict.id);
                      setShowEvidence(true);
                    }}
                    className={cn(
                      'w-full p-4 text-left hover:bg-zinc-900 transition-colors',
                      selectedConflictId === conflict.id && 'bg-zinc-900'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className="text-orange-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-zinc-200">
                          待学员复核
                        </span>
                      </div>
                      <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                        待复核
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {getConflictTypeName(conflict.type)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedConflict && showEvidence && (
            <div className="border-t border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-200">冲突证据</h3>
                <button
                  onClick={() => setShowEvidence(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">位置重叠率</span>
                    <span className="text-sm font-mono text-orange-400">
                      {(selectedConflict.evidence.overlapPercentage * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${selectedConflict.evidence.overlapPercentage * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-zinc-900 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">名称相似度</span>
                    <span className="text-sm font-mono text-blue-400">
                      {(selectedConflict.evidence.nameSimilarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${selectedConflict.evidence.nameSimilarity * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-zinc-900 rounded-lg">
                  <span className="text-xs text-zinc-500 block mb-2">坐标差异</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-zinc-600">X</div>
                      <div className="text-sm font-mono">
                        {selectedConflict.evidence.coordinateDiff.x.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-600">Y</div>
                      <div className="text-sm font-mono">
                        {selectedConflict.evidence.coordinateDiff.y.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-600">Z</div>
                      <div className="text-sm font-mono">
                        {selectedConflict.evidence.coordinateDiff.z.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedConflict.status === 'pending' && (
                  <>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-2">合并后名称</label>
                      <input
                        type="text"
                        value={mergedName}
                        onChange={(e) => setMergedName(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveConflict('confirmed')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                      >
                        <Check size={16} />
                        确认合并
                      </button>
                      <button
                        onClick={() => handleResolveConflict('rejected')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors"
                      >
                        <X size={16} />
                        驳回
                      </button>
                    </div>
                  </>
                )}

                {selectedConflict.requiresReview && selectedConflict.status !== 'pending' && (
                  <>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-2">复核意见</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="请输入复核意见..."
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500 resize-none h-20"
                      />
                    </div>
                    <button
                      onClick={handleReview}
                      disabled={!reviewComment}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
                    >
                      <Check size={16} />
                      完成复核
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {selectedObstacle && !showEvidence && (
            <div className="border-t border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-200">障碍物详情</h3>
                <button
                  onClick={() => setSelectedObstacleId(null)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-200">
                    {selectedObstacle.currentName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-zinc-900 rounded">
                    <div className="text-xs text-zinc-500">来源</div>
                    <div className="text-sm">
                      {selectedObstacle.source === 'sketch' ? '草图' : '点云'}
                    </div>
                  </div>
                  <div className="p-2 bg-zinc-900 rounded">
                    <div className="text-xs text-zinc-500">状态</div>
                    <div className="text-sm">
                      {selectedObstacle.status === 'confirmed' ? '已确认' :
                       selectedObstacle.status === 'pending' ? '待处理' :
                       selectedObstacle.status === 'merged' ? '已合并' : '已驳回'}
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-zinc-900 rounded">
                  <div className="text-xs text-zinc-500 mb-1">位置</div>
                  <div className="text-sm font-mono">
                    ({selectedObstacle.position.x.toFixed(2)}, {selectedObstacle.position.y.toFixed(2)}, {selectedObstacle.position.z.toFixed(2)})
                  </div>
                </div>

                {selectedObstacle.nameHistory.length > 1 && (
                  <div className="p-2 bg-zinc-900 rounded">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                      <History size={12} />
                      <span>命名历史</span>
                    </div>
                    <div className="space-y-1">
                      {selectedObstacle.nameHistory.map((h) => (
                        <div key={h.id} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{h.name}</span>
                          <span className="text-zinc-500 flex items-center gap-1">
                            <User size={10} />
                            {h.changedBy}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

function CheckCircle2(props: { size: number; className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
