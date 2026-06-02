import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Search, Filter, Map, List, Eye, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import L from 'leaflet';
import { useAppStore } from '@/store';
import { PointStatus } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import SourceBadge from '@/components/SourceBadge';
import PointDetailPanel from '@/components/PointDetailPanel';
import { formatDateTime } from '@/utils/stringUtils';
import { cn } from '@/utils/cn';

const iconUrls: Record<PointStatus, string> = {
  [PointStatus.CONFIRMED]: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMyRTdEMzIiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
  [PointStatus.PENDING]: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNGNTdDMDAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
  [PointStatus.CONFLICT]: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNDNjI4MjgiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
  [PointStatus.MERGED]: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM3NTc1NzUiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==',
};

function createCustomIcon(status: PointStatus) {
  return L.icon({
    iconUrl: iconUrls[status],
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.5 });
  }, [center, zoom, map]);
  return null;
}

export default function PointsPage() {
  const { 
    points, 
    getFilteredPoints, 
    getStreets, 
    selectedPointId, 
    setSelectedPoint,
    filters,
    setFilters,
    loading,
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showDetail, setShowDetail] = useState(false);

  const filteredPoints = getFilteredPoints();
  const streets = getStreets();
  const selectedPoint = points.find(p => p.id === selectedPointId);

  const mapCenter: [number, number] = filteredPoints.length > 0
    ? [
        filteredPoints.reduce((sum, p) => sum + p.lat, 0) / filteredPoints.length,
        filteredPoints.reduce((sum, p) => sum + p.lng, 0) / filteredPoints.length,
      ]
    : [39.9968, 116.4725];

  const handleRowClick = (pointId: string) => {
    setSelectedPoint(pointId);
    setShowDetail(true);
  };

  const handleMarkerClick = (pointId: string) => {
    setSelectedPoint(pointId);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedPoint(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      <div className={cn('flex flex-col gap-4 transition-all duration-300', showDetail ? 'flex-1' : 'w-full')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="搜索点位名称、地址..."
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="input pl-9 w-80"
              />
            </div>
            <select
              value={filters.street || ''}
              onChange={(e) => setFilters({ street: e.target.value || null })}
              className="select w-40"
            >
              <option value="">全部街道</option>
              {streets.map(street => (
                <option key={street} value={street}>{street}</option>
              ))}
            </select>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ status: (e.target.value as PointStatus) || null })}
              className="select w-36"
            >
              <option value="">全部状态</option>
              <option value={PointStatus.CONFIRMED}>已确认</option>
              <option value={PointStatus.PENDING}>待处理</option>
              <option value={PointStatus.CONFLICT}>有冲突</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-sm p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sm transition-colors',
                viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              <List size={16} />
              列表
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-sm transition-colors',
                viewMode === 'map' ? 'bg-primary-500 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              <Map size={16} />
              地图
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-success-500 rounded-full" />
            已确认: {filteredPoints.filter(p => p.status === PointStatus.CONFIRMED).length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-warning-500 rounded-full" />
            待处理: {filteredPoints.filter(p => p.status === PointStatus.PENDING).length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-danger-500 rounded-full" />
            有冲突: {filteredPoints.filter(p => p.status === PointStatus.CONFLICT).length}
          </span>
          <span className="text-neutral-400 ml-auto">
            共 {filteredPoints.length} 个点位
          </span>
        </div>

        {viewMode === 'list' && (
          <div className="card overflow-hidden flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className="table-header w-16"></th>
                  <th className="table-header">标准名称</th>
                  <th className="table-header w-32">所属街道</th>
                  <th className="table-header w-28">状态</th>
                  <th className="table-header w-40">来源类型</th>
                  <th className="table-header w-40">更新时间</th>
                  <th className="table-header w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPoints.map((point, idx) => (
                  <tr
                    key={point.id}
                    className={cn(
                      'hover:bg-neutral-50 cursor-pointer transition-colors',
                      selectedPointId === point.id && 'bg-primary-50',
                      idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'
                    )}
                    onClick={() => handleRowClick(point.id)}
                  >
                    <td className="table-cell">
                      <div
                        className={cn(
                          'w-3 h-3 rounded-full',
                          point.status === PointStatus.CONFIRMED && 'bg-success-500',
                          point.status === PointStatus.PENDING && 'bg-warning-500 animate-pulse',
                          point.status === PointStatus.CONFLICT && 'bg-danger-500 animate-pulse',
                          point.status === PointStatus.MERGED && 'bg-neutral-400',
                        )}
                      />
                    </td>
                    <td className="table-cell">
                      <div className="font-medium text-neutral-800">{point.canonicalName}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{point.address}</div>
                    </td>
                    <td className="table-cell text-neutral-600">{point.street}</td>
                    <td className="table-cell">
                      <StatusBadge status={point.status} />
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {[...new Set(point.sources.map(s => s.sourceType))].map(type => (
                          <SourceBadge key={type} type={type} />
                        ))}
                      </div>
                    </td>
                    <td className="table-cell text-neutral-500 text-xs">
                      {formatDateTime(point.updatedAt)}
                    </td>
                    <td className="table-cell">
                      <button
                        className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(point.id);
                        }}
                      >
                        <Eye size={14} />
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPoints.length === 0 && (
              <div className="text-center py-16 text-neutral-500">
                <Filter size={40} className="mx-auto mb-3 text-neutral-300" />
                <p>暂无符合筛选条件的点位</p>
              </div>
            )}
          </div>
        )}

        {viewMode === 'map' && (
          <div className="card flex-1 overflow-hidden">
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} zoom={13} />
              {filteredPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={[point.lat, point.lng]}
                  icon={createCustomIcon(point.status)}
                  eventHandlers={{
                    click: () => handleMarkerClick(point.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div className="font-medium text-neutral-800 mb-1">{point.canonicalName}</div>
                      <div className="text-xs text-neutral-500 mb-2">{point.address}</div>
                      <StatusBadge status={point.status} />
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
      </div>

      {showDetail && selectedPoint && (
        <PointDetailPanel point={selectedPoint} onClose={closeDetail} />
      )}
    </div>
  );
}
