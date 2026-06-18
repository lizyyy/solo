import { useAppStore } from '@/store/useAppStore';
import { SeverityBadge } from '@/components/common/Badges';
import { AlertTriangle, MapPin } from 'lucide-react';

export default function OceanMap() {
  const { stations, selectedStationId, selectStation, getStationAnomalies, anomalies } = useAppStore();

  const getStationSeverity = (stationId: string) => {
    const stationAnomalies = getStationAnomalies(stationId);
    if (stationAnomalies.length === 0) return 'normal';
    if (stationAnomalies.some(a => a.severity === 'high')) return 'high';
    if (stationAnomalies.some(a => a.severity === 'medium')) return 'medium';
    return 'low';
  };

  const getMarkerColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#FF7A45';
      case 'medium': return '#F1C40F';
      case 'low': return '#3498DB';
      default: return '#2ECC71';
    }
  };

  const highCount = anomalies.filter(a => a.severity === 'high').length;
  const totalAnomalies = anomalies.length;

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-ocean-100 via-ocean-50 to-ocean-100 rounded-lg overflow-hidden border border-ocean-200">
      <svg
        className="w-full h-full"
        viewBox="0 0 480 400"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="oceanGradient" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#DCEBF2" />
            <stop offset="100%" stopColor="#B7D7E5" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="wavePattern" patternUnits="userSpaceOnUse" width="60" height="20">
            <path
              d="M0 10 Q15 0 30 10 T60 10"
              fill="none"
              stroke="rgba(26, 122, 154, 0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="480" height="400" fill="url(#oceanGradient)" />
        <rect width="480" height="400" fill="url(#wavePattern)" />

        <path
          d="M20 200 Q60 150 100 180 Q140 210 180 160 Q220 120 260 150 Q300 180 340 130 Q380 90 420 120 Q440 140 460 130 L460 20 L20 20 Z"
          fill="rgba(11, 61, 92, 0.08)"
          stroke="rgba(11, 61, 92, 0.15)"
          strokeWidth="1"
        />

        <path
          d="M40 280 Q80 250 120 270 Q160 290 200 260 Q240 230 280 250 Q320 270 360 240 Q400 210 440 230 L440 380 L40 380 Z"
          fill="rgba(11, 61, 92, 0.06)"
          stroke="rgba(11, 61, 92, 0.12)"
          strokeWidth="1"
        />

        {[
          { x: 80, y: 100, label: '北部海域' },
          { x: 400, y: 90, label: '东部海域' },
          { x: 240, y: 360, label: '南部海域' },
          { x: 60, y: 340, label: '西部海域' },
        ].map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={label.y}
            fill="rgba(11, 61, 92, 0.3)"
            fontSize="11"
            fontWeight="500"
          >
            {label.label}
          </text>
        ))}

        {stations.map((station) => {
          const severity = getStationSeverity(station.id);
          const isSelected = selectedStationId === station.id;
          const stationAnomalies = getStationAnomalies(station.id);
          const color = getMarkerColor(severity);
          const hasAnomaly = stationAnomalies.length > 0;

          return (
            <g
              key={station.id}
              className="cursor-pointer"
              onClick={() => selectStation(isSelected ? null : station.id)}
            >
              {hasAnomaly && (
                <>
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r="12"
                    fill={color}
                    opacity="0.3"
                    className="animate-pulse-slow"
                  />
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r="18"
                    fill={color}
                    opacity="0.15"
                    className="animate-pulse-slow"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}

              {isSelected && (
                <circle
                  cx={station.x}
                  cy={station.y}
                  r="20"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  className="animate-spin"
                  style={{ animationDuration: '8s' }}
                />
              )}

              <circle
                cx={station.x}
                cy={station.y}
                r={isSelected ? 10 : 8}
                fill={color}
                stroke="white"
                strokeWidth="2"
                filter={hasAnomaly ? 'url(#glow)' : undefined}
                className="transition-all duration-200"
              />

              {isSelected && (
                <>
                  <rect
                    x={station.x - 60}
                    y={station.y - 42}
                    width="120"
                    height="28"
                    rx="4"
                    fill="white"
                    stroke={color}
                    strokeWidth="1.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                  <text
                    x={station.x}
                    y={station.y - 24}
                    textAnchor="middle"
                    fill="#072840"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {station.name}
                  </text>
                </>
              )}

              {!isSelected && stationAnomalies.length > 0 && (
                <>
                  <circle
                    cx={station.x + 8}
                    cy={station.y - 8}
                    r="9"
                    fill="#FF7A45"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <text
                    x={station.x + 8}
                    y={station.y - 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {stationAnomalies.length > 9 ? '9+' : stationAnomalies.length}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-card p-3 border border-ocean-100">
        <div className="text-xs font-semibold text-ocean-700 mb-2">异常等级</div>
        <div className="space-y-1.5">
          {[
            { color: '#FF7A45', label: '高风险', count: highCount },
            { color: '#F1C40F', label: '中风险', count: anomalies.filter(a => a.severity === 'medium').length },
            { color: '#3498DB', label: '低风险', count: anomalies.filter(a => a.severity === 'low').length },
            { color: '#2ECC71', label: '正常', count: stations.length - new Set(anomalies.map(a => a.stationId)).size },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-ocean-600">{item.label}</span>
              <span className="text-xs font-medium text-ocean-800 ml-auto">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-card p-3 border border-ocean-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-alert-orange" />
          <span className="text-xs text-ocean-600">异常总数</span>
          <span className="text-lg font-bold text-ocean-800">{totalAnomalies}</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-ocean-500">
        <MapPin className="w-3.5 h-3.5" />
        <span>共 {stations.length} 个监测点位</span>
      </div>
    </div>
  );
}
