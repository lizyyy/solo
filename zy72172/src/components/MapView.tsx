import React from 'react';
import { SignalPoint } from '../types';
import { getHumanReadableStatus } from '../utils/conflictCheck';

interface MapViewProps {
  points: SignalPoint[];
  selectedPointId?: string;
  onPointClick: (point: SignalPoint) => void;
}

export default function MapView({ points, selectedPointId, onPointClick }: MapViewProps) {
  const getStatusColor = (point: SignalPoint) => {
    if (point.hasConflict) return '#ef4444';
    switch (point.status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'legacy': return '#6b7280';
      default: return '#3b82f6';
    }
  };

  const mapPoints = points.map(p => {
    const baseLat = 31.22;
    const baseLng = 121.45;
    const x = ((p.lng - baseLng) * 8000) + 50;
    const y = ((baseLat - p.lat) * 8000) + 50;
    return { ...p, x: Math.max(10, Math.min(90, x)), y: Math.max(10, Math.min(90, y)) };
  });

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden border border-slate-300">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="10" y1="30" x2="90" y2="30" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="10" y1="50" x2="90" y2="50" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="10" y1="70" x2="90" y2="70" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="30" y1="10" x2="30" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="50" y1="10" x2="50" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
        <line x1="70" y1="10" x2="70" y2="90" stroke="#94a3b8" strokeWidth="0.8" />
      </svg>

      {mapPoints.map(point => (
        <div
          key={point.id}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 z-10 ${
            selectedPointId === point.id ? 'z-20 scale-125' : 'hover:scale-110'
          }`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onClick={() => onPointClick(points.find(p => p.id === point.id)!)}
        >
          <div
            className={`w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ${
              selectedPointId === point.id ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
            }`}
            style={{ backgroundColor: getStatusColor(point) }}
          >
            {point.hasConflict ? '!' : '●'}
          </div>
          
          {selectedPointId === point.id && (
            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-white px-3 py-2 rounded-lg shadow-xl border border-slate-200 whitespace-nowrap z-30">
              <div className="text-sm font-semibold text-slate-800">{point.name}</div>
              <div className="text-xs" style={{ color: getStatusColor(point) }}>
                {getHumanReadableStatus(point)}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="absolute bottom-3 left-3 bg-white px-3 py-2 rounded-lg shadow-md border border-slate-200">
        <div className="text-xs font-semibold text-slate-600 mb-1">图例</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-xs text-slate-600">通过</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-xs text-slate-600">待确认</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="text-xs text-slate-600">冲突</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-500"></span>
            <span className="text-xs text-slate-600">历史</span>
          </div>
        </div>
      </div>

      <div className="absolute top-3 left-3 text-sm font-semibold text-slate-700 bg-white px-3 py-1 rounded shadow">
        GIS 点位分布图
      </div>
    </div>
  );
}
