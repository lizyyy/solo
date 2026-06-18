import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { Station } from '@/types';
import { Anchor } from 'lucide-react';

export function StationMap() {
  const { stations, selectedStationId, setSelectedStation, anomalies } = useAppStore(useShallow((s) => ({
    stations: s.stations,
    selectedStationId: s.selectedStationId,
    setSelectedStation: s.setSelectedStation,
    anomalies: s.anomalies,
  })));

  const stationAnomalyMap = useMemo(() => {
    const map: Record<string, number> = {};
    anomalies.forEach((a) => { map[a.stationId] = (map[a.stationId] || 0) + 1; });
    return map;
  }, [anomalies]);

  const minLat = Math.min(...stations.map((s) => s.lat));
  const maxLat = Math.max(...stations.map((s) => s.lat));
  const minLon = Math.min(...stations.map((s) => s.lon));
  const maxLon = Math.max(...stations.map((s) => s.lon));

  const pad = 0.2;
  const latRange = maxLat - minLat + pad * 2;
  const lonRange = maxLon - minLon + pad * 2;

  const mapW = 420;
  const mapH = 280;

  const project = (st: Station) => {
    const x = ((st.lon - (minLon - pad)) / lonRange) * mapW;
    const y = ((maxLat + pad - st.lat) / latRange) * mapH;
    return { x, y };
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <Anchor size={14} />
          采样站位空间分布
        </span>
        <span className="text-[11px] text-deepsea-300">
          {minLat.toFixed(2)}°N ~ {maxLat.toFixed(2)}°N · {minLon.toFixed(2)}°E ~ {maxLon.toFixed(2)}°E
        </span>
      </div>
      <div className="relative grid-bg" style={{ width: mapW, height: mapH }}>
        <svg width={mapW} height={mapH} className="absolute inset-0">
          <defs>
            <pattern id="bath-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(95,135,184,0.08)" strokeWidth="1" />
            </pattern>
            <radialGradient id="station-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(42,157,143,0.5)" />
              <stop offset="100%" stopColor="rgba(42,157,143,0)" />
            </radialGradient>
          </defs>
          <rect width={mapW} height={mapH} fill="url(#bath-grid)" />

          {[...Array(4)].map((_, i) => (
            <path
              key={i}
              d={`M 0 ${60 + i * 55} Q ${mapW / 2} ${40 + i * 55}, ${mapW} ${70 + i * 55}`}
              stroke="rgba(48,86,138,0.35)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="3 6"
            />
          ))}

          {stations.map((st) => {
            const { x, y } = project(st);
            const anomalyCount = stationAnomalyMap[st.id] || 0;
            const stationAnomalies = anomalies.filter((a) => a.stationId === st.id);
            const hasBlocked = stationAnomalies.some((a) => a.evidenceStatus === 'none');
            const isSelected = st.id === selectedStationId;
            return (
              <g
                key={st.id}
                onClick={() => setSelectedStation(st.id)}
                className="cursor-pointer"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {isSelected && (
                  <circle r={28} fill="url(#station-glow)" className="animate-pulseSlow" />
                )}
                {hasBlocked && (
                  <circle r={22} fill="none" stroke="rgba(230,57,70,0.45)" strokeWidth="1.5" className="animate-pulseSlow" />
                )}
                <circle
                  r={isSelected ? 11 : 8}
                  fill={isSelected ? '#2A9D8F' : hasBlocked ? '#E63946' : '#30568A'}
                  stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.4)'}
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="-16"
                  textAnchor="middle"
                  fill="#E8F0F8"
                  fontSize="11"
                  fontFamily="JetBrains Mono"
                  fontWeight="500"
                >
                  {st.name}
                </text>
                <text x="0" y="22" textAnchor="middle" fill="#98B8DA" fontSize="10" fontFamily="JetBrains Mono">
                  {st.depth}m · {anomalyCount}异常
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
