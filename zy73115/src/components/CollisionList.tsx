import React from 'react';
import { AlertTriangle, AlertCircle, XCircle, Filter, Copy, CheckCircle, Clock, X } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';
import { CollisionPoint } from '../types';

const severityConfig = {
  warning: {
    label: '警告',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30',
    icon: AlertTriangle,
  },
  error: {
    label: '错误',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    icon: AlertCircle,
  },
  critical: {
    label: '严重',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    icon: XCircle,
  },
};

const statusConfig = {
  pending: { label: '待处理', icon: Clock, color: 'text-slate-400' },
  resolved: { label: '已解决', icon: CheckCircle, color: 'text-green-400' },
  ignored: { label: '已忽略', icon: X, color: 'text-slate-500' },
};

export const CollisionList: React.FC = () => {
  const {
    session,
    selectedCollisionId,
    selectCollision,
    filterSeverity,
    setFilterSeverity,
    showBoundary,
    setShowBoundary,
    showDuplicates,
    setShowDuplicates,
    getFilteredCollisions,
  } = useReviewStore();

  if (!session) return null;

  const collisions = getFilteredCollisions();

  const toggleSeverity = (s: 'warning' | 'error' | 'critical') => {
    if (filterSeverity.includes(s)) {
      setFilterSeverity(filterSeverity.filter(x => x !== s));
    } else {
      setFilterSeverity([...filterSeverity, s]);
    }
  };

  const formatPosition = (pos: CollisionPoint['position']) => {
    return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
  };

  return (
    <div className="h-full flex flex-col bg-slate-850 text-slate-100">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 text-lg font-semibold mb-3">
          <AlertCircle size={20} className="text-red-400" />
          <span>碰撞点列表</span>
          <span className="ml-auto text-sm text-slate-400">
            显示 {collisions.length} / {session.collisions.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            <span className="text-xs text-slate-400">严重程度：</span>
          </div>
          {(['critical', 'error', 'warning'] as const).map((s) => {
            const config = severityConfig[s];
            const Icon = config.icon;
            const active = filterSeverity.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSeverity(s)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                  active
                    ? `${config.bgColor} ${config.color} ${config.borderColor} border`
                    : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
                }`}
              >
                <Icon size={12} />
                {config.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showBoundary}
              onChange={(e) => setShowBoundary(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
            />
            显示边界样本
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showDuplicates}
              onChange={(e) => setShowDuplicates(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            显示重复碰撞
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {collisions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            暂无符合筛选条件的碰撞点
          </div>
        ) : (
          collisions.map((collision) => {
            const sevConfig = severityConfig[collision.severity];
            const SevIcon = sevConfig.icon;
            const statConfig = statusConfig[collision.status];
            const StatIcon = statConfig.icon;
            const isSelected = selectedCollisionId === collision.id;

            return (
              <div
                key={collision.id}
                onClick={() => selectCollision(collision.id)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-900/30 border-blue-500/50 ring-1 ring-blue-500/30'
                    : `${sevConfig.bgColor} ${sevConfig.borderColor} border hover:border-slate-500`
                } ${
                  collision.isBoundary
                    ? 'border-dashed !border-amber-400/50'
                    : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <SevIcon size={16} className={`${sevConfig.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${sevConfig.color}`}>
                        {sevConfig.label}
                      </span>
                      {collision.isBoundary && (
                        <span className="px-1.5 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] rounded border border-amber-400/30">
                          边界样本
                        </span>
                      )}
                      {collision.duplicateOf && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-400/20 text-blue-300 text-[10px] rounded border border-blue-400/30">
                          <Copy size={10} />
                          重复
                        </span>
                      )}
                      <span className={`flex items-center gap-1 ml-auto text-[10px] ${statConfig.color}`}>
                        <StatIcon size={10} />
                        {statConfig.label}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-mono text-slate-300">
                      {formatPosition(collision.position)}
                    </div>

                    <div className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {collision.originalCADDescription}
                    </div>

                    {collision.boundaryReason && (
                      <div className="mt-1.5 text-[10px] text-amber-400/80 bg-amber-400/10 px-2 py-1 rounded">
                        {collision.boundaryReason}
                      </div>
                    )}

                    {collision.manualNote && (
                      <div className="mt-1.5 text-[10px] text-blue-300/80 bg-blue-400/10 px-2 py-1 rounded">
                        <span className="font-medium">已备注</span> · {collision.manualNote.slice(0, 30)}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-700 bg-slate-900/50">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-red-400 font-semibold">
              {session.collisions.filter(c => c.severity === 'critical').length}
            </div>
            <div className="text-slate-500">严重</div>
          </div>
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-orange-400 font-semibold">
              {session.collisions.filter(c => c.severity === 'error').length}
            </div>
            <div className="text-slate-500">错误</div>
          </div>
          <div className="p-2 bg-slate-800 rounded">
            <div className="text-amber-400 font-semibold">
              {session.collisions.filter(c => c.severity === 'warning').length}
            </div>
            <div className="text-slate-500">警告</div>
          </div>
        </div>
      </div>
    </div>
  );
};
