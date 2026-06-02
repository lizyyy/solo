import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/store/useStore';
import { statusColors, statusLabels } from '@/types';
import { AlertCircle, GitMerge } from 'lucide-react';

function createCustomIcon(status: string, needsReview: boolean, isBoundary: boolean) {
  const color = statusColors[status as keyof typeof statusColors] || '#6b7280';
  const size = isBoundary ? 36 : 30;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        ${needsReview ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            background: #f59e0b;
            border-radius: 50%;
            border: 2px solid white;
          "></div>
        ` : ''}
        ${isBoundary ? `
          <div style="
            position: absolute;
            inset: -2px;
            border: 2px dashed #ef4444;
            border-radius: 50%;
            opacity: 0.8;
          "></div>
        ` : ''}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapController({ selectedBusStopId, busStops }: {
  selectedBusStopId: string | null;
  busStops: any[];
}) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (selectedBusStopId) {
      const stop = busStops.find((s) => s.id === selectedBusStopId);
      if (stop) {
        map.setView([stop.lat, stop.lng], 15, { animate: true });
      }
    }
  }, [selectedBusStopId, busStops, map]);

  useEffect(() => {
    if (!hasCentered.current && busStops.length > 0) {
      const lats = busStops.map((s) => s.lat);
      const lngs = busStops.map((s) => s.lng);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
      map.setView([centerLat, centerLng], 13);
      hasCentered.current = true;
    }
  }, [busStops, map]);

  return null;
}

export default function MapView() {
  const { busStops, selectedBusStopId, setSelectedBusStop } = useStore();

  const visibleStops = busStops.filter((s) => s.status !== 'merged');

  return (
    <div className="flex-1 relative">
      <MapContainer
        center={[31.2304, 121.4737]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController selectedBusStopId={selectedBusStopId} busStops={busStops} />

        {visibleStops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={createCustomIcon(stop.status, stop.needsReview, stop.isBoundary)}
            eventHandlers={{
              click: () => setSelectedBusStop(stop.id),
            }}
          >
            <Popup>
              <div className="min-w-48">
                <div className="font-semibold text-slate-800 mb-1">
                  {stop.name || '未命名站点'}
                </div>
                <div className="text-sm text-slate-600 mb-2">
                  {stop.address || '暂无地址信息'}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${statusColors[stop.status]}15`,
                      color: statusColors[stop.status],
                    }}
                  >
                    {statusLabels[stop.status]}
                  </span>
                  {stop.needsReview && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="w-3 h-3" /> 待审核
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 z-[1000]">
        <div className="text-xs font-semibold text-slate-700 mb-2">图例</div>
        <div className="space-y-1.5">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: statusColors[status as keyof typeof statusColors] }}
              />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-600">待人工确认</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded-full border-2 border-dashed border-red-500" />
              <span className="text-xs text-slate-600">边界记录</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
