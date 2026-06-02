import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { locationsApi, feedbacksApi } from '../api';
import type { Location, ResidentFeedback } from '../api';
import LocationDetail from '../components/LocationDetail';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [feedbacks, setFeedbacks] = useState<ResidentFeedback[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>([31.23, 121.47]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [locationsRes, feedbacksRes] = await Promise.all([
        locationsApi.getAll(),
        feedbacksApi.getAll()
      ]);
      setLocations(locationsRes.data);
      setFeedbacks(feedbacksRes.data);
      
      if (locationsRes.data.length > 0) {
        const lats = locationsRes.data.map(l => l.lat);
        const lngs = locationsRes.data.map(l => l.lng);
        setMapCenter([
          (Math.min(...lats) + Math.max(...lats)) / 2,
          (Math.min(...lngs) + Math.max(...lngs)) / 2
        ]);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  const getLocationFeedbacks = (locationId: number) => {
    return feedbacks.filter(f => f.locationId === locationId);
  };

  const filteredLocations = searchQuery 
    ? locations.filter(l => 
        l.name.includes(searchQuery) || 
        l.aliases?.some(a => a.includes(searchQuery))
      )
    : locations;

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>GIS点位地图</h2>
        <p>查看所有树木修剪点位分布及关联信息</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>点位分布</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="搜索点位..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '14px' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              🔄 刷新
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="map-container">
            <MapContainer
              center={mapCenter}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <MapController center={mapCenter} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredLocations.map(location => {
                const locFeedbacks = getLocationFeedbacks(location.id);
                const hasUrgent = locFeedbacks.some(f => f.priority === 'urgent');
                const hasHigh = locFeedbacks.some(f => f.priority === 'high');
                
                return (
                  <Marker
                    key={location.id}
                    position={[location.lat, location.lng]}
                    eventHandlers={{
                      click: () => setSelectedLocation(location.id)
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: '200px' }}>
                        <h4>{location.name}</h4>
                        <p>反馈数: {locFeedbacks.length}条</p>
                        <p>
                          {hasUrgent && <span className="badge badge-urgent">紧急</span>}
                          {!hasUrgent && hasHigh && <span className="badge badge-high">高优</span>}
                          {!hasUrgent && !hasHigh && locFeedbacks.length > 0 && <span className="badge badge-medium">普通</span>}
                        </p>
                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ marginTop: '8px', width: '100%' }}
                          onClick={() => setSelectedLocation(location.id)}
                        >
                          查看详情
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>点位列表 ({filteredLocations.length}个)</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>点位名称</th>
                <th>所属街道</th>
                <th>反馈数</th>
                <th>最高优先级</th>
                <th>别名</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map(location => {
                const locFeedbacks = getLocationFeedbacks(location.id);
                const priorities = locFeedbacks.map(f => f.priority);
                const maxPriority = priorities.includes('urgent') ? 'urgent' :
                                   priorities.includes('high') ? 'high' :
                                   priorities.includes('medium') ? 'medium' : 'low';
                
                return (
                  <tr key={location.id}>
                    <td style={{ fontWeight: '500' }}>{location.name}</td>
                    <td>{location.street || '-'}</td>
                    <td>{locFeedbacks.length}条</td>
                    <td>
                      <span className={`badge badge-${maxPriority}`}>
                        {maxPriority === 'urgent' ? '紧急' : 
                         maxPriority === 'high' ? '高' : 
                         maxPriority === 'medium' ? '中' : '低'}
                      </span>
                    </td>
                    <td>
                      <div className="aliases-list">
                        {location.aliases?.slice(0, 3).map((alias, i) => (
                          <span key={i} className="alias-tag">{alias}</span>
                        ))}
                        {location.aliases && location.aliases.length > 3 && (
                          <span className="alias-tag">+{location.aliases.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setMapCenter([location.lat, location.lng]);
                          setSelectedLocation(location.id);
                        }}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div 
        className={`detail-panel-overlay ${selectedLocation ? 'active' : ''}`}
        onClick={() => setSelectedLocation(null)}
      />
      
      <div className={`detail-panel ${selectedLocation ? 'open' : ''}`}>
        {selectedLocation && (
          <LocationDetail 
            locationId={selectedLocation} 
            onClose={() => setSelectedLocation(null)} 
          />
        )}
      </div>
    </div>
  );
}
