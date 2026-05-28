import React from 'react';
import { X, Trash2, Play, MapPin } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { calculateMoveTime } from '../../game/engine';
import { DataSource } from '../../game/types';

export const RoutePlanner: React.FC = () => {
  const { state, removeFromRoute, clearRoute, startMove } = useGameStore();
  const { markDataSourceViewed } = useGameStore();
  const { togglePanel, expandedPanels } = useUIStore();

  const totalTime = state.plannedRoute.reduce((sum, node, index) => {
    const from = index === 0 ? state.currentPosition : state.plannedRoute[index - 1].position;
    return sum + calculateMoveTime(from, node.position);
  }, 0);

  const handleStartRoute = () => {
    if (state.plannedRoute.length === 0 || state.isMoving) return;
    
    const firstNode = state.plannedRoute[0];
    startMove(firstNode.position);
    markDataSourceViewed(DataSource.ROUTE);
  };

  const getNodeName = (node: typeof state.plannedRoute[0]) => {
    switch (node.type) {
      case 'hall':
        return state.halls.find(h => h.id === node.targetId)?.name || '展厅';
      case 'corner':
        return state.corners.find(c => c.id === node.targetId)?.name || '角落';
      case 'door':
        return state.doors.find(d => d.id === node.targetId)?.name || '门禁';
      case 'artwork':
        return state.artworks.find(a => a.id === node.targetId)?.name || '作品';
      default:
        return '未知';
    }
  };

  const isExpanded = expandedPanels[DataSource.ROUTE];

  return (
    <div className="panel border-source-route">
      <div 
        className="panel-header cursor-pointer"
        onClick={() => togglePanel(DataSource.ROUTE)}
      >
        <div className="flex items-center gap-2">
          <span className="source-badge border-source-route text-source-route">[路线]</span>
          <span className="panel-title">巡逻路线</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-mono">
            {state.plannedRoute.length}个点 · {totalTime}秒
          </span>
          <span className="text-gray-500 text-sm">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          {state.plannedRoute.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              <MapPin size={24} className="mx-auto mb-2 opacity-50" />
              <p>按住Shift点击地图</p>
              <p>添加巡逻点</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {state.plannedRoute.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between bg-night-700 p-2 border border-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-source-route/20 text-source-route text-xs font-mono rounded-full">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-300">{getNodeName(node)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">
                        {node.estimatedTime}s
                      </span>
                      <button
                        onClick={() => removeFromRoute(node.id)}
                        className="p-1 text-gray-500 hover:text-alert-red transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={clearRoute}
                  className="flex-1 glow-btn px-3 py-2 text-xs flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} />
                  清空
                </button>
                <button
                  onClick={handleStartRoute}
                  className="flex-1 glow-btn-primary px-3 py-2 text-xs flex items-center justify-center gap-1"
                  disabled={state.isMoving}
                >
                  <Play size={14} />
                  开始巡逻
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
