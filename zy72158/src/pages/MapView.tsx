import { useState } from 'react';
import { MapPin, Info, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { OutdoorStall } from '@/types';
import StatusBadge from '@/components/StatusBadge';

const statusColors: Record<string, string> = {
  pending: '#f57c00',
  approved: '#388e3c',
  rejected: '#d32f2f',
  need_confirm: '#fbc02d',
  legacy: '#546e7a',
};

export default function MapView() {
  const stalls = useStore(state => state.stalls);
  const [selectedStall, setSelectedStall] = useState<OutdoorStall | null>(null);
  const [zoom, setZoom] = useState(1);

  const getMapPosition = (lat: number, lng: number) => {
    const baseLat = 31.23;
    const baseLng = 121.47;
    const x = ((lng - baseLng) * 10000 + 50) * zoom;
    const y = ((baseLat - lat) * 10000 + 50) * zoom;
    return { x: Math.max(10, Math.min(90, x)), y: Math.max(10, Math.min(90, y)) };
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">GIS点位地图</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.6))}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 mt-4">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-600">
                {status === 'pending' ? '待审批' :
                 status === 'approved' ? '审批通过' :
                 status === 'rejected' ? '审批驳回' :
                 status === 'need_confirm' ? '需人工确认' : '历史遗留'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
            
            <line x1="10" y1="30" x2="90" y2="30" stroke="#ccc" strokeWidth="1.5" />
            <line x1="10" y1="60" x2="90" y2="60" stroke="#ccc" strokeWidth="1.5" />
            <line x1="30" y1="10" x2="30" y2="90" stroke="#ccc" strokeWidth="1.5" />
            <line x1="70" y1="10" x2="70" y2="90" stroke="#ccc" strokeWidth="1.5" />
            
            <text x="50" y="8" textAnchor="middle" fontSize="3" fill="#999">人民路</text>
            <text x="50" y="38" textAnchor="middle" fontSize="3" fill="#999">步行街</text>
            <text x="50" y="68" textAnchor="middle" fontSize="3" fill="#999">广场路</text>
            <text x="8" y="50" textAnchor="middle" fontSize="3" fill="#999" transform="rotate(-90 8 50)">中山路</text>
            <text x="92" y="50" textAnchor="middle" fontSize="3" fill="#999" transform="rotate(90 92 50)">解放路</text>
          </svg>
        </div>

        {stalls.map((stall) => {
          const pos = getMapPosition(stall.lat, stall.lng);
          return (
            <button
              key={stall.id}
              onClick={() => setSelectedStall(stall)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-110 z-10"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="relative">
                <MapPin 
                  className="w-8 h-8 drop-shadow-lg" 
                  style={{ color: statusColors[stall.status] }}
                  fill={statusColors[stall.status]}
                />
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <span className="text-xs bg-white px-1.5 py-0.5 rounded shadow text-gray-700 font-medium">
                    {stall.name.length > 6 ? stall.name.slice(0, 6) + '...' : stall.name}
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {selectedStall && (
          <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedStall.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedStall.location}</p>
                </div>
                <button
                  onClick={() => setSelectedStall(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Info className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">审批状态</span>
                <StatusBadge status={selectedStall.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">外摆面积</span>
                <span className="font-medium">{selectedStall.area}㎡</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">经营时间</span>
                <span className="font-medium">{selectedStall.timePeriod}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">GIS坐标</span>
                <span className="text-xs font-mono">
                  {selectedStall.lat.toFixed(4)}, {selectedStall.lng.toFixed(4)}
                </span>
              </div>
              {selectedStall.humanRemark && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-gray-500 text-sm">人工备注</span>
                  <p className="text-sm text-gray-700 mt-1">{selectedStall.humanRemark}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg px-3 py-2 text-xs text-gray-500">
          提示: 点击点位查看详情
        </div>
      </div>
    </div>
  );
}
