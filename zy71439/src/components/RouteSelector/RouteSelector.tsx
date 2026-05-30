import React, { useState } from 'react';
import { Navigation, Clock, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';
import { RouteOption, SelectedRoute } from '../../types';
import { formatDistance, getRiskLabel, getRiskColor } from '../../utils/formatters';

interface RouteSelectorProps {
  routes: RouteOption[];
  selectedRouteId: string | null;
  onSelect: (routeId: string, reason: string) => void;
  disabled?: boolean;
}

export const RouteSelector: React.FC<RouteSelectorProps> = ({
  routes,
  selectedRouteId,
  onSelect,
  disabled = false
}) => {
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const handleSelect = (routeId: string) => {
    if (disabled) return;
    onSelect(routeId, decisionReason);
  };

  const getTimeString = (minutes: number): string => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Navigation size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">救援路线选择</h3>
            <p className="text-xs text-slate-400">请权衡距离、时间和风险，选择最合适的救援路线</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {routes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            请先标注遇险船位置，系统将自动生成救援路线选项
          </div>
        ) : (
          routes.map((route, index) => {
            const isSelected = selectedRouteId === route.id;
            const isExpanded = expandedRouteId === route.id;

            return (
              <div
                key={route.id}
                className={`rounded-lg border-2 transition-all overflow-hidden ${
                  isSelected
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                onClick={() => !disabled && setExpandedRouteId(isExpanded ? null : route.id)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isSelected ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSelected ? <CheckCircle size={16} /> : index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {route.name}
                          {isSelected && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                              已选择
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400">
                          {route.waypoints.length > 0
                            ? `经 ${route.waypoints.length} 个航点`
                            : '直达航线'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-mono text-white">
                          {formatDistance(route.distance)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {getTimeString(route.estimatedTime)}
                        </div>
                      </div>
                      <div
                        className={`text-xs font-semibold ${getRiskColor(route.riskLevel)}`}
                      >
                        <div className="flex items-center gap-1">
                          <AlertTriangle size={10} />
                          {getRiskLabel(route.riskLevel)}
                        </div>
                      </div>
                      <ChevronRight
                        size={20}
                        className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400 mb-1">风险说明</div>
                        <div className="text-sm text-slate-200">{route.riskDescription}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-slate-900/50 rounded-lg p-2">
                          <div className="text-lg font-mono font-bold text-blue-400">
                            {(route.distance / 1852).toFixed(1)}
                          </div>
                          <div className="text-xs text-slate-400">海里</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2">
                          <div className="text-lg font-mono font-bold text-green-400">
                            {route.estimatedTime}
                          </div>
                          <div className="text-xs text-slate-400">分钟</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-2">
                          <div className={`text-lg font-bold ${getRiskColor(route.riskLevel)}`}>
                            {route.riskLevel === 'low' ? '★★★' : route.riskLevel === 'medium' ? '★★☆' : '★☆☆'}
                          </div>
                          <div className="text-xs text-slate-400">安全等级</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 block">
                          请说明选择此路线的理由
                        </label>
                        <textarea
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          placeholder="例如：虽然直达路线距离最短，但考虑到渔船密集区的航行风险，我选择安全航线..."
                          disabled={disabled}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors resize-none h-20"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSelect(route.id); }}
                        disabled={disabled || !decisionReason.trim()}
                        className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                          isSelected
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-500'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSelected ? '✓ 已选择此路线' : '确认选择此路线'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedRouteId && (
        <div className="p-4 border-t border-slate-700 bg-green-500/10">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle size={16} />
            <span>路线已选择，请确认所有信息无误后提交训练记录</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteSelector;
