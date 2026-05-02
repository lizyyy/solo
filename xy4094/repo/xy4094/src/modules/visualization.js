import L from 'leaflet';
import { GeoCalculator } from './geo.js';
import { RiskLevel, RiskTypeNames } from './riskEngine.js';

export class Visualization {
  constructor() {
    this.geoCalculator = new GeoCalculator();
    this.map = null;
    this.mapContainerId = 'map';
    
    this.layers = {
      track: null,
      aircraft: null,
      noFlyZones: [],
      alertPoints: [],
      riskEvents: [],
      trackBackground: null
    };
    
    this.markers = {
      aircraft: null,
      start: null,
      end: null
    };
    
    this.colors = {
      track: '#2563eb',
      trackBackground: '#dbeafe',
      start: '#22c55e',
      end: '#ef4444',
      aircraft: '#3b82f6',
      noFlyZone: {
        fill: '#fee2e2',
        stroke: '#ef4444'
      },
      alertPoint: {
        critical: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
      },
      riskEvent: {
        critical: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        manual: '#a855f7'
      }
    };
    
    this.timelineCanvas = null;
    this.timelineCtx = null;
  }

  initializeMap(containerId, options = {}) {
    this.mapContainerId = containerId || this.mapContainerId;
    
    const mapOptions = {
      center: options.center || [30, 120],
      zoom: options.zoom || 12,
      zoomControl: true,
      attributionControl: true
    };
    
    this.map = L.map(this.mapContainerId, mapOptions);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);
    
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    });
    
    this.createCustomIcons();
    
    return this.map;
  }

  createCustomIcons() {
    this.icons = {
      aircraft: L.divIcon({
        className: 'aircraft-icon',
        html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="${this.colors.aircraft}">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }),
      
      start: L.divIcon({
        className: 'start-marker',
        html: `<div style="width: 16px; height: 16px; background: ${this.colors.start}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      }),
      
      end: L.divIcon({
        className: 'end-marker',
        html: `<div style="width: 16px; height: 16px; background: ${this.colors.end}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    };
  }

  renderTrack(trackData) {
    if (!this.map) return;
    if (!trackData || !trackData.points || trackData.points.length < 2) return;
    
    this.clearTrackLayers();
    
    const latLngs = trackData.points.map(p => [p.latitude, p.longitude]);
    
    this.layers.trackBackground = L.polyline(latLngs, {
      color: this.colors.trackBackground,
      weight: 8,
      opacity: 0.6
    }).addTo(this.map);
    
    this.layers.track = L.polyline(latLngs, {
      color: this.colors.track,
      weight: 3,
      opacity: 1
    }).addTo(this.map);
    
    const startPoint = trackData.points[0];
    const endPoint = trackData.points[trackData.points.length - 1];
    
    this.markers.start = L.marker(
      [startPoint.latitude, startPoint.longitude],
      { icon: this.icons.start }
    ).addTo(this.map)
     .bindPopup(this.createStartPopup(startPoint));
    
    this.markers.end = L.marker(
      [endPoint.latitude, endPoint.longitude],
      { icon: this.icons.end }
    ).addTo(this.map)
     .bindPopup(this.createEndPopup(endPoint));
    
    this.markers.aircraft = L.marker(
      [startPoint.latitude, startPoint.longitude],
      { icon: this.icons.aircraft, zIndexOffset: 1000 }
    ).addTo(this.map)
     .bindPopup('');
    
    const bounds = this.layers.track.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  createStartPopup(point) {
    const content = `
      <div class="popup-content">
        <h4>🛫 起飞点</h4>
        <p><strong>时间:</strong> ${this.geoCalculator.formatDateTime(point.timestamp)}</p>
        <p><strong>位置:</strong> ${point.latitude.toFixed(6)}°N, ${point.longitude.toFixed(6)}°E</p>
        <p><strong>高度:</strong> ${point.altitude.toFixed(1)} m</p>
      </div>
    `;
    return content;
  }

  createEndPopup(point) {
    const content = `
      <div class="popup-content">
        <h4>🛬 降落点</h4>
        <p><strong>时间:</strong> ${this.geoCalculator.formatDateTime(point.timestamp)}</p>
        <p><strong>位置:</strong> ${point.latitude.toFixed(6)}°N, ${point.longitude.toFixed(6)}°E</p>
        <p><strong>高度:</strong> ${point.altitude.toFixed(1)} m</p>
      </div>
    `;
    return content;
  }

  updateAircraftPosition(point) {
    if (!this.markers.aircraft || !point) return;
    
    const latLng = [point.latitude, point.longitude];
    this.markers.aircraft.setLatLng(latLng);
    
    const popupContent = `
      <div class="popup-content">
        <h4>🛩️ 当前位置</h4>
        <p><strong>时间:</strong> ${this.geoCalculator.formatDateTime(point.timestamp)}</p>
        <p><strong>位置:</strong> ${point.latitude.toFixed(6)}°N, ${point.longitude.toFixed(6)}°E</p>
        <p><strong>高度:</strong> ${point.altitude.toFixed(1)} m</p>
        <p><strong>速度:</strong> ${point.speed.toFixed(2)} m/s</p>
        <p><strong>航向:</strong> ${point.heading.toFixed(1)}°</p>
        <p><strong>云台俯仰:</strong> ${point.gimbalPitch?.toFixed(1) || 0}°</p>
      </div>
    `;
    
    this.markers.aircraft.setPopupContent(popupContent);
  }

  renderNoFlyZones(noFlyZones) {
    if (!this.map) return;
    
    this.clearNoFlyZoneLayers();
    
    if (!noFlyZones || !noFlyZones.features || noFlyZones.features.length === 0) return;
    
    for (const feature of noFlyZones.features) {
      this.renderNoFlyZone(feature);
    }
  }

  renderNoFlyZone(feature) {
    if (!feature.geometry) return;
    
    const geometry = feature.geometry;
    const name = feature.properties?.name || '未命名禁飞区';
    const description = feature.properties?.description || '';
    
    let layer = null;
    const style = {
      color: this.colors.noFlyZone.stroke,
      fillColor: this.colors.noFlyZone.fill,
      fillOpacity: 0.4,
      weight: 2,
      opacity: 0.8
    };
    
    switch (geometry.type) {
      case 'Polygon':
      case 'MultiPolygon':
        layer = L.geoJSON(feature, { style }).addTo(this.map);
        break;
      
      case 'Circle':
        layer = L.circle(
          [geometry.coordinates[1], geometry.coordinates[0]],
          {
            radius: geometry.radius || 100,
            ...style
          }
        ).addTo(this.map);
        break;
      
      default:
        return;
    }
    
    if (layer) {
      const popupContent = `
        <div class="popup-content">
          <h4>🚫 ${name}</h4>
          ${description ? `<p><strong>描述:</strong> ${description}</p>` : ''}
          <p><strong>类型:</strong> ${geometry.type}</p>
        </div>
      `;
      layer.bindPopup(popupContent);
      this.layers.noFlyZones.push(layer);
    }
  }

  renderAlertPoints(alertPoints) {
    if (!this.map) return;
    
    this.clearAlertPointLayers();
    
    if (!alertPoints || !alertPoints.features || alertPoints.features.length === 0) return;
    
    for (const feature of alertPoints.features) {
      this.renderAlertPoint(feature);
    }
  }

  renderAlertPoint(feature) {
    if (!feature.geometry || feature.geometry.type !== 'Point') return;
    
    const coords = feature.geometry.coordinates;
    const latLng = [coords[1], coords[0]];
    const name = feature.properties?.name || '未命名告警点';
    const level = feature.properties?.level || 'warning';
    const description = feature.properties?.description || '';
    
    const color = this.colors.alertPoint[level] || this.colors.alertPoint.warning;
    
    const icon = L.divIcon({
      className: 'alert-point-icon',
      html: `<div style="width: 20px; height: 20px; background: ${color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    
    const marker = L.marker(latLng, { icon }).addTo(this.map);
    
    const popupContent = `
      <div class="popup-content">
        <h4>⚠️ ${name}</h4>
        <p><strong>级别:</strong> ${level === 'critical' ? '严重' : level === 'warning' ? '警告' : '信息'}</p>
        ${description ? `<p><strong>描述:</strong> ${description}</p>` : ''}
        <p><strong>位置:</strong> ${coords[1].toFixed(6)}°N, ${coords[0].toFixed(6)}°E</p>
      </div>
    `;
    marker.bindPopup(popupContent);
    
    this.layers.alertPoints.push(marker);
  }

  renderRiskEvents(events) {
    if (!this.map) return;
    
    this.clearRiskEventLayers();
    
    if (!events || events.length === 0) return;
    
    for (const event of events) {
      this.renderRiskEvent(event);
    }
  }

  renderRiskEvent(event) {
    if (!event.position) return;
    
    const latLng = [event.position.latitude, event.position.longitude];
    const color = this.colors.riskEvent[event.level] || this.colors.riskEvent.info;
    const eventTypeName = RiskTypeNames[event.type] || '未知事件';
    
    const size = event.level === 'critical' ? 14 : event.level === 'warning' ? 12 : 10;
    
    const icon = L.divIcon({
      className: 'risk-event-icon',
      html: `<div style="width: ${size}px; height: ${size}px; background: ${color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
    
    const marker = L.marker(latLng, { icon, zIndexOffset: 500 }).addTo(this.map);
    
    const popupContent = `
      <div class="popup-content">
        <h4>${event.isManual ? '✏️' : '⚠️'} ${eventTypeName}</h4>
        <p><strong>时间:</strong> ${this.geoCalculator.formatDateTime(event.timestamp)}</p>
        <p><strong>级别:</strong> ${this.getLevelName(event.level)}</p>
        <p><strong>描述:</strong> ${event.description}</p>
        ${event.details && event.details.speed ? `<p><strong>速度:</strong> ${event.details.speed.toFixed(2)} m/s</p>` : ''}
        ${event.details && event.details.windAngle ? `<p><strong>风航夹角:</strong> ${event.details.windAngle.toFixed(1)}°</p>` : ''}
        ${event.details && event.details.zoneName ? `<p><strong>禁飞区:</strong> ${event.details.zoneName}</p>` : ''}
      </div>
    `;
    marker.bindPopup(popupContent);
    marker.eventId = event.id;
    
    this.layers.riskEvents.push(marker);
  }

  getLevelName(level) {
    switch (level) {
      case RiskLevel.CRITICAL: return '严重';
      case RiskLevel.WARNING: return '警告';
      case RiskLevel.INFO: return '信息';
      default: return level;
    }
  }

  highlightRiskEvent(eventId) {
    for (const marker of this.layers.riskEvents) {
      if (marker.eventId === eventId) {
        const latLng = marker.getLatLng();
        this.map.setView(latLng, Math.max(this.map.getZoom(), 15), { animate: true });
        marker.openPopup();
        break;
      }
    }
  }

  clearTrackLayers() {
    if (this.layers.track) {
      this.map.removeLayer(this.layers.track);
      this.layers.track = null;
    }
    if (this.layers.trackBackground) {
      this.map.removeLayer(this.layers.trackBackground);
      this.layers.trackBackground = null;
    }
    if (this.markers.start) {
      this.map.removeLayer(this.markers.start);
      this.markers.start = null;
    }
    if (this.markers.end) {
      this.map.removeLayer(this.markers.end);
      this.markers.end = null;
    }
    if (this.markers.aircraft) {
      this.map.removeLayer(this.markers.aircraft);
      this.markers.aircraft = null;
    }
  }

  clearNoFlyZoneLayers() {
    for (const layer of this.layers.noFlyZones) {
      this.map.removeLayer(layer);
    }
    this.layers.noFlyZones = [];
  }

  clearAlertPointLayers() {
    for (const marker of this.layers.alertPoints) {
      this.map.removeLayer(marker);
    }
    this.layers.alertPoints = [];
  }

  clearRiskEventLayers() {
    for (const marker of this.layers.riskEvents) {
      this.map.removeLayer(marker);
    }
    this.layers.riskEvents = [];
  }

  clearAll() {
    this.clearTrackLayers();
    this.clearNoFlyZoneLayers();
    this.clearAlertPointLayers();
    this.clearRiskEventLayers();
  }

  initializeTimeline(canvasId) {
    this.timelineCanvas = document.getElementById(canvasId);
    if (!this.timelineCanvas) return;
    
    this.timelineCtx = this.timelineCanvas.getContext('2d');
    this.resizeTimelineCanvas();
    
    window.addEventListener('resize', () => this.resizeTimelineCanvas());
  }

  resizeTimelineCanvas() {
    if (!this.timelineCanvas) return;
    
    const rect = this.timelineCanvas.getBoundingClientRect();
    this.timelineCanvas.width = rect.width * window.devicePixelRatio;
    this.timelineCanvas.height = rect.height * window.devicePixelRatio;
    this.timelineCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  renderTimeline(trackData, riskEvents, currentProgress = 0) {
    if (!this.timelineCtx || !this.timelineCanvas) return;
    
    const ctx = this.timelineCtx;
    const width = this.timelineCanvas.offsetWidth;
    const height = this.timelineCanvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);
    
    if (trackData && trackData.points) {
      const points = trackData.points;
      const centerY = height / 2;
      
      let minAlt = Infinity, maxAlt = -Infinity;
      let minSpeed = Infinity, maxSpeed = -Infinity;
      
      for (const point of points) {
        minAlt = Math.min(minAlt, point.altitude);
        maxAlt = Math.max(maxAlt, point.altitude);
        minSpeed = Math.min(minSpeed, point.speed || 0);
        maxSpeed = Math.max(maxSpeed, point.speed || 0);
      }
      
      const altRange = maxAlt - minAlt || 1;
      const speedRange = maxSpeed - minSpeed || 1;
      
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        const y = centerY - ((points[i].altitude - minAlt) / altRange) * (height * 0.3);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = (i / (points.length - 1)) * width;
        const y = centerY + ((points[i].speed || 0 - minSpeed) / speedRange) * (height * 0.3);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    if (riskEvents && riskEvents.length > 0) {
      for (const event of riskEvents) {
        const x = event.progress * width;
        
        let color;
        let heightMarker;
        switch (event.level) {
          case 'critical':
            color = '#ef4444';
            heightMarker = 8;
            break;
          case 'warning':
            color = '#f59e0b';
            heightMarker = 6;
            break;
          default:
            color = '#3b82f6';
            heightMarker = 4;
        }
        
        if (event.isManual) {
          color = '#a855f7';
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(x - 2, height / 2 - heightMarker, 4, heightMarker * 2);
      }
    }
    
    if (currentProgress > 0 || currentProgress === 0) {
      const x = currentProgress * width;
      
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 6, 10);
      ctx.lineTo(x + 6, 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  flyToBounds(bounds) {
    if (!this.map || !bounds) return;
    
    if (bounds.southWest && bounds.northEast) {
      const leafletBounds = [
        [bounds.southWest.latitude, bounds.southWest.longitude],
        [bounds.northEast.latitude, bounds.northEast.longitude]
      ];
      this.map.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }

  getMap() {
    return this.map;
  }

  destroy() {
    this.clearAll();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}

export default Visualization;
