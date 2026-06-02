import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { ShelterPoint, ShelterStatus } from '@/types';
import { useUIStore } from '@/store/uiStore';
import { formatDistance, calculateDistance } from '@/utils/geo';
import 'leaflet/dist/leaflet.css';

const customIcon = (status: ShelterStatus, isOverCapacity: boolean) => {
  const color = isOverCapacity ? '#DC2626' :
    status === ShelterStatus.PROCESSED ? '#16A34A' :
    status === ShelterStatus.PENDING_VERIFY ? '#F97316' : '#DC2626';

  const Icon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
             style="background-color: ${color}; ${isOverCapacity ? 'animation: pulse 2s infinite;' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            ${isOverCapacity
              ? '<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
              : status === ShelterStatus.PROCESSED
              ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>'
              : '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>'
            }
          </svg>
        </div>
        ${isOverCapacity ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  return Icon;
};

const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

interface Map2DProps {
  shelters: ShelterPoint[];
  selectedShelter: ShelterPoint | null;
  onSelectShelter: (shelterId: string) => void;
}

export const Map2D: React.FC<Map2DProps> = ({ shelters, selectedShelter, onSelectShelter }) => {
  const mapRef = useRef<any>(null);
  const { openDetailPanel } = useUIStore();

  const center: [number, number] = selectedShelter
    ? [selectedShelter.latitude, selectedShelter.longitude]
    : [39.915527, 116.396128];
  const zoom = selectedShelter ? 16 : 14;

  const handleMarkerClick = (shelter: ShelterPoint) => {
    onSelectShelter(shelter.id);
    openDetailPanel(shelter.id);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', background: '#0F172A' }}
        zoomControl={false}
      >
        <MapController center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {shelters.map((shelter) => {
          const isOverCapacity = shelter.reportedCount > shelter.designCapacity;
          const radius = Math.min(50 + (shelter.reportedCount / shelter.designCapacity) * 30, 100);

          return (
            <React.Fragment key={shelter.id}>
              <Circle
                center={[shelter.latitude, shelter.longitude]}
                radius={radius}
                pathOptions={{
                  color: isOverCapacity ? '#DC2626' : '#3B82F6',
                  fillColor: isOverCapacity ? '#DC2626' : '#3B82F6',
                  fillOpacity: 0.15,
                  weight: 1,
                  opacity: 0.5
                }}
              />

              {shelter.reportedLatitude && shelter.reportedLongitude &&
               (shelter.latitude !== shelter.reportedLatitude ||
                shelter.longitude !== shelter.reportedLongitude) && (
                <>
                  <Circle
                    center={[shelter.reportedLatitude, shelter.reportedLongitude]}
                    radius={20}
                    pathOptions={{
                      color: '#F59E0B',
                      fillColor: '#F59E0B',
                      fillOpacity: 0.3,
                      weight: 2,
                      dashArray: '5, 5'
                    }}
                  />
                  <Polyline
                    positions={[
                      [shelter.latitude, shelter.longitude],
                      [shelter.reportedLatitude, shelter.reportedLongitude]
                    ]}
                    pathOptions={{
                      color: '#F59E0B',
                      weight: 2,
                      dashArray: '5, 5',
                      opacity: 0.7
                    }}
                  />
                </>
              )}

              <Marker
                position={[shelter.latitude, shelter.longitude]}
                icon={customIcon(shelter.status, isOverCapacity)}
                eventHandlers={{ click: () => handleMarkerClick(shelter) }}
              >
                <Popup className="custom-popup">
                  <div className="min-w-[200px]">
                    <h3 className="font-bold text-gray-900">{shelter.standardName}</h3>
                    <p className="text-xs text-gray-500">
                      {shelter.aliases.slice(0, 2).join(' / ')}
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p><span className="text-gray-500">设计容量：</span>{shelter.designCapacity}人</p>
                      <p><span className="text-gray-500">反馈人数：</span>
                        <span className={isOverCapacity ? 'text-red-600 font-bold' : 'text-gray-900'}>
                          {shelter.reportedCount}人
                        </span>
                      </p>
                      <p className="text-xs">
                        {isOverCapacity && (
                          <span className="text-red-600">⚠️ 超限{Math.round((shelter.reportedCount / shelter.designCapacity - 1) * 100)}%</span>
                        )}
                      </p>
                      {shelter.reportedLatitude && shelter.reportedLongitude && (
                        <p className="text-xs text-yellow-600">
                          📍 坐标偏移{formatDistance(calculateDistance(
                            shelter.latitude, shelter.longitude,
                            shelter.reportedLatitude, shelter.reportedLongitude
                          ))}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleMarkerClick(shelter)}
                      className="mt-3 w-full rounded-md bg-blue-500 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                    >
                      查看详情
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-4 left-4 rounded-lg border border-gray-600 bg-gray-800/90 p-3 backdrop-blur-md">
        <p className="mb-2 text-xs font-medium text-gray-300">图例</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-400">已处理</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-400">待核实</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-400">需现场复看 / 超限</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full border-2 border-dashed border-yellow-500"></div>
            <span className="text-xs text-gray-400">居民反馈坐标</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        .leaflet-popup-content-wrapper {
          background: #1F2937;
          color: #F3F4F6;
          border-radius: 8px;
        }
        .leaflet-popup-tip {
          background: #1F2937;
        }
        .leaflet-container {
          background: #0F172A;
        }
      `}</style>
    </div>
  );
};
