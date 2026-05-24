import { useGameStore } from '../../store/useGameStore';
import { isUserNode } from '../../game/engine';
import { NODE_STATUS_CONFIG, PRIORITY_CONFIG } from '../../game/config';
import { Zap, Clock, Users, AlertTriangle } from 'lucide-react';

export function NodeTooltip() {
  const { nodes, selectedNode } = useGameStore();

  if (!selectedNode) return null;

  const node = nodes.find(n => n.id === selectedNode);
  if (!node) return null;

  const statusConfig = NODE_STATUS_CONFIG[node.status];

  return (
    <div className="absolute left-1/2 top-20 transform -translate-x-1/2 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-slate-600 p-4 min-w-64 z-20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold">{node.name}</h3>
        <span
          className="text-xs px-2 py-1 rounded"
          style={{ backgroundColor: statusConfig.color + '30', color: statusConfig.color }}
        >
          {statusConfig.name}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            类型
          </span>
          <span className="text-white">
            {node.type === 'substation' ? '变电站' : node.type === 'powerline' ? '电线' : '用户节点'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">健康度</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(node.health / node.maxHealth) * 100}%`,
                  backgroundColor: node.health > 50 ? '#4ade80' : node.health > 25 ? '#fbbf24' : '#ef4444'
                }}
              />
            </div>
            <span className="text-white font-mono w-12 text-right">
              {Math.round(node.health)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">供电状态</span>
          <span className={node.powered ? 'text-green-400' : 'text-red-400'}>
            {node.powered ? '● 已供电' : '○ 未供电'}
          </span>
        </div>

        {node.type !== 'user' && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              修复时间
            </span>
            <span className="text-white">{node.repairTime} 回合</span>
          </div>
        )}

        {node.status === 'repairing' && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">修复进度</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${node.repairProgress * 100}%` }}
                />
              </div>
              <span className="text-orange-400 font-mono w-12 text-right">
                {Math.round(node.repairProgress * 100)}%
              </span>
            </div>
          </div>
        )}

        {isUserNode(node) && (
          <>
            <div className="border-t border-slate-700 my-2 pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">优先级</span>
                <span style={{ color: PRIORITY_CONFIG[node.priority].color }}>
                  {PRIORITY_CONFIG[node.priority].name}
                </span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  覆盖人口
                </span>
                <span className="text-white">{node.population.toLocaleString()}</span>
              </div>

              {!node.powered && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    停电时间
                  </span>
                  <span className={node.outageTime >= node.maxOutageTime * 0.8 ? 'text-red-400 animate-pulse' : 'text-yellow-400'}>
                    {node.outageTime} / {node.maxOutageTime} 回合
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {node.type !== 'user' && node.status === 'damaged' && (
        <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded text-xs text-yellow-400">
          💡 选择待命的抢修队伍，然后点击此处或地图上的节点进行派遣
        </div>
      )}
    </div>
  );
}
