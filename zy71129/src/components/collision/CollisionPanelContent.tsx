
import { useState } from 'react';
import { AlertTriangle, CheckCircle, Circle, X, Crosshair } from 'lucide-react';
import { useCollisionStore } from '../../store/useCollisionStore';
import { useModelStore } from '../../store/useModelStore';
import { CollisionPoint } from '../../types/model';

interface CollisionPanelContentProps {
  onClose?: () => void;
}

export function CollisionPanelContent({ onClose }: CollisionPanelContentProps) {
  const [filterType, setFilterType] = useState<'all' | 'hard' | 'soft'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  const { collisions, selectedCollisionId, setSelectedCollision, resolveCollision } = useCollisionStore();
  const { getFilteredElements } = useModelStore();

  const elements = getFilteredElements();

  const filteredCollisions = collisions.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
    return true;
  });

  const getElementName = (id: string) => {
    const el = elements.find(e => e.id === id);
    return el?.name || id;
  };

  const handleFocus = (collision: CollisionPoint) => {
    setSelectedCollision(collision.id);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'major': return 'text-orange-400 bg-orange-500/20';
      case 'minor': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '严重';
      case 'major': return '主要';
      case 'minor': return '次要';
      default: return severity;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            碰撞列表
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {filteredCollisions.length} 项
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部类型</option>
            <option value="hard">硬碰撞</option>
            <option value="soft">软碰撞</option>
          </select>
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value as any)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">全部严重级</option>
            <option value="critical">严重</option>
            <option value="major">主要</option>
            <option value="minor">次要</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredCollisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <CheckCircle className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-xs">暂无碰撞</p>
          </div>
        ) : (
          filteredCollisions.map((collision, index) => (
            <div
              key={collision.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedCollisionId === collision.id
                  ? 'bg-blue-500/10 border-blue-500'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              } ${collision.resolved ? 'opacity-60' : ''}`}
              onClick={() => handleFocus(collision)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    collision.type === 'hard' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {collision.type === 'hard' ? '硬' : '软'}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${getSeverityColor(collision.severity)}`}>
                    {getSeverityLabel(collision.severity)}
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    resolveCollision(collision.id, !collision.resolved);
                  }}
                  className="text-slate-500 hover:text-green-400 transition-colors"
                >
                  {collision.resolved ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: elements.find(e => e.id === collision.elementA)?.color || '#888' }}
                  />
                  <span className="text-slate-300 truncate">
                    {getElementName(collision.elementA)}
                  </span>
                </div>
                <div className="text-slate-600 text-center">
                  <X className="w-3 h-3 mx-auto" />
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: elements.find(e => e.id === collision.elementB)?.color || '#888' }}
                  />
                  <span className="text-slate-300 truncate">
                    {getElementName(collision.elementB)}
                  </span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">
                  ({collision.position.x.toFixed(1)}, {collision.position.y.toFixed(1)}, {collision.position.z.toFixed(1)})
                </span>
                <button
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    handleFocus(collision);
                  }}
                >
                  <Crosshair className="w-3 h-3" />
                  定位
                </button>
              </div>

              {collision.resolved && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  已解决
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
