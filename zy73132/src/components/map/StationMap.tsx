import React, { useState } from 'react';
import { MapPin, Activity, Wrench } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import type { Station } from '../../types';

const StationMap: React.FC = () => {
  const { stations, selectedStationId, setSelectedStation, records } = useAppStore();
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  const mapToSvg = (station: Station) => {
    const minLng = 119.5;
    const maxLng = 123.0;
    const minLat = 29.5;
    const maxLat = 31.5;
    const x = ((station.lng - minLng) / (maxLng - minLng)) * 100;
    const y = 100 - ((station.lat - minLat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const getStationAnomalyCount = (stationId: string) => {
    return records.filter(r => r.stationId === stationId && r.isAnomaly).length;
  };

  const selectedStation = stations.find(s => s.id === selectedStationId);

  return (
    <div className="h-full glass-panel rounded-xl overflow-hidden relative flex flex-col">
      <div className="px-4 py-3 border-b border-ocean-400/15 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ocean-300 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          站点分布
        </h3>
        <span className="text-xs text-slate-400">{stations.length} 个站点</span>
      </div>

      <div className="flex-1 relative grid-bg overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="coastGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#00B4D8" stopOpacity="0.05" />
            </linearGradient>
            <radialGradient id="stationGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="anomalyGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path
            d="M 0,70 Q 15,55 25,60 T 45,50 Q 55,45 65,52 T 85,40 Q 92,38 100,42 L 100,100 L 0,100 Z"
            fill="url(#coastGrad)"
            stroke="#00D4FF"
            strokeWidth="0.3"
            strokeOpacity="0.4"
          />
          <path
            d="M 0,75 Q 18,62 28,65 T 48,55 Q 58,50 68,57 T 88,45 Q 95,43 100,47"
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.2"
            strokeOpacity="0.25"
            strokeDasharray="1,1"
          />

          {stations.map(station => {
            const { x, y } = mapToSvg(station);
            const isSelected = station.id === selectedStationId;
            const isHovered = station.id === hoveredStation;
            const anomalyCount = getStationAnomalyCount(station.id);
            const hasAnomaly = anomalyCount > 0;

            return (
              <g
                key={station.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedStation(station.id)}
                onMouseEnter={() => setHoveredStation(station.id)}
                onMouseLeave={() => setHoveredStation(null)}
              >
                {(isSelected || hasAnomaly) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 8 : 6}
                    fill={hasAnomaly ? 'url(#anomalyGlow)' : 'url(#stationGlow)'}
                    className={hasAnomaly ? 'animate-pulse-slow' : ''}
                  />
                )}

                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 3 : 2.2}
                  fill={station.status === 'maintenance' ? '#94a3b8' : hasAnomaly ? '#FF6B6B' : '#00D4FF'}
                  stroke={isSelected ? '#ffffff' : hasAnomaly ? '#ffa8a8' : '#48cae4'}
                  strokeWidth={isSelected ? 0.8 : 0.4}
                />

                {(isSelected || isHovered) && (
                  <>
                    <rect
                      x={x + 5}
                      y={y - 8}
                      width={station.name.length * 2.8 + 4}
                      height={6}
                      rx={0.8}
                      fill="#0A2540"
                      stroke="#00D4FF"
                      strokeWidth="0.2"
                      strokeOpacity="0.5"
                    />
                    <text
                      x={x + 7}
                      y={y - 3.8}
                      fill="#e2e8f0"
                      fontSize="2.8"
                      fontFamily="Inter, sans-serif"
                    >
                      {station.name}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {selectedStation && (
          <div className="absolute bottom-3 left-3 right-3 glass-panel rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              {selectedStation.status === 'maintenance' ? (
                <Wrench className="w-4 h-4 text-slate-400" />
              ) : (
                <Activity className={`w-4 h-4 ${selectedStation.hasAnomaly ? 'text-anomaly-400' : 'text-ocean-400'}`} />
              )}
              <span className="font-medium text-sm text-slate-200">{selectedStation.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${selectedStation.status === 'maintenance' ? 'bg-slate-500/30 text-slate-400' : 'bg-ocean-400/20 text-ocean-400'}`}>
                {selectedStation.status === 'maintenance' ? '维护中' : '运行中'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-slate-400">
                坐标: <span className="text-slate-200 font-mono">{selectedStation.lat.toFixed(2)}, {selectedStation.lng.toFixed(2)}</span>
              </div>
              <div className="text-slate-400">
                异常: <span className={getStationAnomalyCount(selectedStation.id) > 0 ? 'text-anomaly-400' : 'text-slate-200'}>
                  {getStationAnomalyCount(selectedStation.id)} 条
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-ocean-400/15 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ocean-400" />
          <span className="text-slate-400">正常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-anomaly-500 animate-pulse" />
          <span className="text-slate-400">异常</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-slate-400">维护</span>
        </div>
      </div>
    </div>
  );
};

export default StationMap;
