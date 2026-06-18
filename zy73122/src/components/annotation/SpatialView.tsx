import { useMemo } from 'react';
import { AlertTriangle, GitBranch, CloudRain } from 'lucide-react';
import type { BuoyRecord } from '../../types';

interface Props {
  records: BuoyRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function seaStateColor(level: number): string {
  if (level <= 2) return '#22c55e';
  if (level <= 4) return '#eab308';
  if (level <= 6) return '#f97316';
  return '#ef4444';
}

export default function SpatialView({ records, selectedId, onSelect }: Props) {
  const bounds = useMemo(() => {
    if (records.length === 0) return { minLat: 29, maxLat: 33, minLon: 121, maxLon: 125 };
    const lats = records.map(r => r.latitude);
    const lons = records.map(r => r.longitude);
    const pad = 0.5;
    return {
      minLat: Math.min(...lats) - pad,
      maxLat: Math.max(...lats) + pad,
      minLon: Math.min(...lons) - pad,
      maxLon: Math.max(...lons) + pad,
    };
  }, [records]);

  const latToY = (lat: number) => {
    const range = bounds.maxLat - bounds.minLat;
    return 100 - ((lat - bounds.minLat) / range) * 100;
  };

  const lonToX = (lon: number) => {
    const range = bounds.maxLon - bounds.minLon;
    return ((lon - bounds.minLon) / range) * 100;
  };

  const selectedRecord = records.find(r => r.id === selectedId);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">空间视图</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            低海况
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            中
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            高
          </span>
        </div>
      </div>

      <div className="flex-1 relative bg-gradient-to-br from-cyan-50 to-blue-50 m-3 rounded-xl border border-slate-200 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {[...Array(10)].map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full border-t border-slate-300/50"
              style={{ top: `${i * 10}%` }}
            />
          ))}
          {[...Array(10)].map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full border-l border-slate-300/50"
              style={{ left: `${i * 10}%` }}
            />
          ))}
        </div>

        {records.map(record => {
          const x = lonToX(record.longitude);
          const y = latToY(record.latitude);
          const isSelected = record.id === selectedId;
          const size = 8 + record.seaState * 1.5;

          return (
            <button
              key={record.id}
              onClick={() => onSelect(record.id)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div
                className={`rounded-full shadow-md transition-all duration-200 ${
                  record.isAnomaly ? 'animate-pulse-soft' : ''
                } ${isSelected ? 'ring-4 ring-ocean-400/40' : ''}`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: record.isAnomaly ? '#f97316' : seaStateColor(record.seaState),
                }}
              />
              {record.isAnomaly && (
                <AlertTriangle
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 text-alert-500"
                />
              )}
              {record.isBoundary && (
                <GitBranch
                  className="absolute -bottom-1 -left-1 w-3 h-3 text-purple-600 bg-white rounded-sm"
                />
              )}
            </button>
          );
        })}

        <div className="absolute bottom-2 left-2 text-xs text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded">
          纬度范围: {bounds.minLat.toFixed(1)}° - {bounds.maxLat.toFixed(1)}°
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-slate-500 bg-white/80 backdrop-blur px-2 py-1 rounded">
          经度范围: {bounds.minLon.toFixed(1)}° - {bounds.maxLon.toFixed(1)}°
        </div>
      </div>

      {selectedRecord && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-slate-800">{selectedRecord.buoyId}</span>
            <span className="text-xs text-slate-500">
              {new Date(selectedRecord.recordTime).toLocaleString('zh-CN')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg py-2 px-1 border border-slate-200">
              <p className="text-xs text-slate-500">海况等级</p>
              <p className="text-base font-semibold text-slate-800">{selectedRecord.seaState}</p>
            </div>
            <div className="bg-white rounded-lg py-2 px-1 border border-slate-200">
              <p className="text-xs text-slate-500">波高</p>
              <p className="text-base font-semibold text-slate-800">{selectedRecord.waveHeight}m</p>
            </div>
            <div className="bg-white rounded-lg py-2 px-1 border border-slate-200">
              <p className="text-xs text-slate-500">风速</p>
              <p className="text-base font-semibold text-slate-800">{selectedRecord.windSpeed}m/s</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <CloudRain className="w-3.5 h-3.5" />
            <span>
              {selectedRecord.latitude.toFixed(4)}°N, {selectedRecord.longitude.toFixed(4)}°E
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
