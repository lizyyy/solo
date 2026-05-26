import React from 'react';
import { GameState, Level } from '../../game/types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { TrendingUp, DollarSign, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface CostPanelProps {
  state: GameState;
  level: Level;
}

export const CostPanel: React.FC<CostPanelProps> = ({ state, level }) => {
  const { costs } = state;
  const progress = Math.min((costs.total / level.targetCost) * 100, 150);
  const isOverBudget = costs.total > level.targetCost;

  const formatCost = (value: number) => {
    return `¥${Math.floor(value).toLocaleString()}`;
  };

  return (
    <Card title="成本监控" subtitle={`目标: ${formatCost(level.targetCost)}`}>
      <div className="space-y-4">
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">总成本</span>
            <span className={`text-2xl font-bold font-mono ${
              isOverBudget ? 'text-red-400' : 'text-green-400'
            }`}>
              {formatCost(costs.total)}
            </span>
          </div>
          
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isOverBudget ? 'bg-red-500' : progress > 80 ? 'bg-amber-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between mt-1 text-xs">
            <span className="text-gray-500">0%</span>
            <span className={isOverBudget ? 'text-red-400' : 'text-gray-500'}>
              {Math.floor(progress)}%
            </span>
            <span className="text-gray-500">150%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span>换模成本</span>
            </div>
            <span className="text-lg font-bold text-amber-400 font-mono">
              {formatCost(costs.changeover)}
            </span>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span>清洗成本</span>
            </div>
            <span className="text-lg font-bold text-blue-400 font-mono">
              {formatCost(costs.cleaning)}
            </span>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>延迟成本</span>
            </div>
            <span className="text-lg font-bold text-red-400 font-mono">
              {formatCost(costs.delay)}
            </span>
          </div>

          <div className="bg-gray-900 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <DollarSign className="w-3 h-3 text-gray-400" />
              <span>闲置成本</span>
            </div>
            <span className="text-lg font-bold text-gray-400 font-mono">
              {formatCost(costs.idle)}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">完成进度</span>
            <span className="text-white">
              {state.completedOrders.length} / {level.orders.length}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-400">当前时间</span>
            <span className="text-white font-mono">
              {Math.floor(state.currentTime)} 分钟
            </span>
          </div>
        </div>

        {state.status === 'completed' && (
          <div className="flex items-center justify-center gap-2 bg-green-900/30 rounded-lg p-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">生产完成!</span>
          </div>
        )}

        {state.status === 'failed' && state.failReason && (
          <div className="bg-red-900/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">生产失败</span>
            </div>
            <p className="text-red-300 text-sm">{state.failReason}</p>
          </div>
        )}
      </div>
    </Card>
  );
};
