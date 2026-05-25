import React, { useState } from 'react';
import { AlertTriangle, Wind, Cloud, ChevronDown, ChevronUp, X, CheckCircle } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

export const StatusPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { fans, escapeRoutes, smokeCoverage, errors, selectedScene } = useSimulationStore();

  const activeFans = fans.filter(f => f.isOn).length;
  const blockedRoutes = escapeRoutes.filter(r => r.isBlocked).length;
  const criticalErrors = errors.filter(e => e.severity === 'critical').length;
  const recentErrors = errors.slice(-5).reverse();

  return (
    <div className="absolute top-4 right-4 w-72 bg-gray-800/95 backdrop-blur-sm rounded-xl border border-gray-700 shadow-xl overflow-hidden z-10">
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
          <AlertTriangle size={16} className={cn(
            criticalErrors > 0 ? "text-red-400 animate-pulse" : "text-green-400"
          )} />
          状态监控
        </h3>
        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {selectedScene && (
            <div className="p-2 bg-gray-700/50 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">当前场景</p>
              <p className="text-white text-sm font-medium">{selectedScene.name}</p>
              <p className="text-gray-500 text-xs mt-1 line-clamp-2">{selectedScene.description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <StatusCard
              icon={<Wind size={14} />}
              label="风机运行"
              value={`${activeFans}/${fans.length}`}
              color={activeFans > 0 ? "text-orange-400" : "text-gray-400"}
            />
            <StatusCard
              icon={<Cloud size={14} />}
              label="烟气浓度"
              value={`${Math.round(smokeCoverage)}%`}
              color={smokeCoverage > 50 ? "text-red-400" : smokeCoverage > 20 ? "text-amber-400" : "text-green-400"}
            />
            <StatusCard
              icon={blockedRoutes > 0 ? <X size={14} /> : <CheckCircle size={14} />}
              label="逃生通道"
              value={`${escapeRoutes.length - blockedRoutes}/${escapeRoutes.length}`}
              color={blockedRoutes > 0 ? "text-red-400" : "text-green-400"}
            />
          </div>

          {recentErrors.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-400 text-xs">最近警报</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {recentErrors.map((error) => (
                  <div 
                    key={error.id}
                    className={cn(
                      "p-2 rounded-lg text-xs",
                      error.severity === 'critical' 
                        ? "bg-red-500/20 border border-red-500/30" 
                        : "bg-amber-500/20 border border-amber-500/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={12} className={cn(
                        error.severity === 'critical' ? "text-red-400" : "text-amber-400"
                      )} />
                      <span className={cn(
                        "font-medium",
                        error.severity === 'critical' ? "text-red-400" : "text-amber-400"
                      )}>
                        {error.severity === 'critical' ? '严重' : '警告'}
                      </span>
                      <span className="text-gray-500 ml-auto">步骤 {error.step}</span>
                    </div>
                    <p className="text-gray-300">{error.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-700">
            <p className="text-gray-400 text-xs mb-2">风机状态</p>
            <div className="space-y-1">
              {fans.map((fan) => (
                <div key={fan.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate flex-1">{fan.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-xs",
                      fan.direction === 'forward' 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-purple-500/20 text-purple-400"
                    )}>
                      {fan.direction === 'forward' ? '→' : '←'}
                    </span>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      fan.isOn ? "bg-green-400" : "bg-gray-500"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, label, value, color }) => (
  <div className="p-2 bg-gray-700/50 rounded-lg text-center">
    <div className={cn("flex justify-center mb-1", color)}>{icon}</div>
    <p className={cn("font-bold text-lg", color)}>{value}</p>
    <p className="text-gray-500 text-xs">{label}</p>
  </div>
);
