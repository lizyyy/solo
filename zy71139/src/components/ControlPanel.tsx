import React, { useState } from 'react';
import { Power, Wind, ChevronDown, ChevronUp, Settings, Filter } from 'lucide-react';
import { Fan } from '../types';
import { useSimulationStore } from '../store/useSimulationStore';
import { cn } from '../utils/cn';

interface ControlPanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isCollapsed, onToggleCollapse }) => {
  const { fans, toggleFan, setFanDirection, setFanPower } = useSimulationStore();
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [expandedFans, setExpandedFans] = useState<Set<string>>(new Set());

  const zones = [
    { id: 'all', name: '全部' },
    { id: 'inlet', name: '入口区' },
    { id: 'middle', name: '中段区' },
    { id: 'outlet', name: '出口区' }
  ];

  const filteredFans = selectedZone === 'all' 
    ? fans 
    : fans.filter(f => f.zone === selectedZone);

  const toggleFanExpanded = (fanId: string) => {
    setExpandedFans(prev => {
      const next = new Set(prev);
      if (next.has(fanId)) {
        next.delete(fanId);
      } else {
        next.add(fanId);
      }
      return next;
    });
  };

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'inlet': return 'bg-blue-500';
      case 'middle': return 'bg-amber-500';
      case 'outlet': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={cn(
      "h-full bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300",
      isCollapsed ? "w-12" : "w-72"
    )}>
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Settings size={16} className="text-orange-400" />
            风机控制
          </h2>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
        >
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="p-3 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={14} className="text-gray-400" />
              <span className="text-gray-400 text-xs">区域筛选</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    selectedZone === zone.id
                      ? "bg-orange-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  )}
                >
                  {zone.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredFans.map((fan) => (
              <FanControlCard
                key={fan.id}
                fan={fan}
                isExpanded={expandedFans.has(fan.id)}
                onToggleExpand={() => toggleFanExpanded(fan.id)}
                onToggle={() => toggleFan(fan.id)}
                onDirectionChange={(dir) => setFanDirection(fan.id, dir)}
                onPowerChange={(power) => setFanPower(fan.id, power)}
                zoneColor={getZoneColor(fan.zone)}
              />
            ))}
          </div>
        </>
      )}

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-2 gap-2">
          {fans.slice(0, 6).map((fan) => (
            <button
              key={fan.id}
              onClick={() => toggleFan(fan.id)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                fan.isOn 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/50" 
                  : "bg-gray-700 text-gray-400 hover:bg-gray-600"
              )}
              title={fan.name}
            >
              <Wind size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface FanControlCardProps {
  fan: Fan;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onDirectionChange: (dir: 'forward' | 'backward') => void;
  onPowerChange: (power: number) => void;
  zoneColor: string;
}

const FanControlCard: React.FC<FanControlCardProps> = ({
  fan,
  isExpanded,
  onToggleExpand,
  onToggle,
  onDirectionChange,
  onPowerChange,
  zoneColor
}) => {
  return (
    <div className={cn(
      "rounded-lg border transition-all overflow-hidden",
      fan.isOn 
        ? "border-orange-500/50 bg-gray-750" 
        : "border-gray-600 bg-gray-700/50"
    )}>
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-8 rounded-full",
            zoneColor
          )} />
          <div>
            <p className="text-white text-sm font-medium">{fan.name}</p>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                fan.isOn ? "bg-green-400 animate-pulse" : "bg-gray-500"
              )} />
              <span className="text-gray-400 text-xs">
                {fan.isOn ? '运行中' : '已关闭'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "p-2 rounded-lg transition-all",
              fan.isOn
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                : "bg-gray-600 text-gray-400 hover:bg-gray-500"
            )}
          >
            <Power size={14} />
          </button>
          <ChevronDown 
            size={16} 
            className={cn(
              "text-gray-400 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-600/50 pt-3">
          <div>
            <label className="text-gray-400 text-xs mb-2 block">风向控制</label>
            <div className="flex gap-2">
              <button
                onClick={() => onDirectionChange('forward')}
                className={cn(
                  "flex-1 py-2 px-3 rounded text-xs font-medium transition-colors",
                  fan.direction === 'forward'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                )}
              >
                → 正向
              </button>
              <button
                onClick={() => onDirectionChange('backward')}
                className={cn(
                  "flex-1 py-2 px-3 rounded text-xs font-medium transition-colors",
                  fan.direction === 'backward'
                    ? "bg-blue-500 text-white"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500"
                )}
              >
                ← 反向
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400 text-xs">功率</label>
              <span className="text-orange-400 text-xs font-mono">{fan.power}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fan.power}
              onChange={(e) => onPowerChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      )}
    </div>
  );
};
