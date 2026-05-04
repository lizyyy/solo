export const GeoUtils = {
  EARTH_RADIUS: 6371000,

  haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS * c;
  },

  latLonToXY(lat, lon, centerLat, centerLon, scale = 1) {
    const toRad = Math.PI / 180;
    const latRad = lat * toRad;
    const lonRad = lon * toRad;
    const centerLatRad = centerLat * toRad;
    const centerLonRad = centerLon * toRad;
    
    const x = (lonRad - centerLonRad) * Math.cos(centerLatRad) * this.EARTH_RADIUS;
    const y = (latRad - centerLatRad) * this.EARTH_RADIUS;
    
    return {
      x: x * scale,
      y: y * scale
    };
  },

  xyToLatLon(x, y, centerLat, centerLon, scale = 1) {
    const toDeg = 180 / Math.PI;
    const centerLatRad = centerLat * (Math.PI / 180);
    
    const lonRad = centerLon * (Math.PI / 180) + (x / scale) / (this.EARTH_RADIUS * Math.cos(centerLatRad));
    const latRad = centerLatRad + (y / scale) / this.EARTH_RADIUS;
    
    return {
      lat: latRad * toDeg,
      lon: lonRad * toDeg
    };
  },

  calculateSpeed(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const distance = this.haversineDistance(
      point1.latitude || point1.lat,
      point1.longitude || point1.lon,
      point2.latitude || point2.lat,
      point2.longitude || point2.lon
    );
    
    const time1 = point1.timestamp || point1.time;
    const time2 = point2.timestamp || point2.time;
    
    const timeDiff = Math.abs(time2 - time1) / 1000;
    
    if (timeDiff === 0) return 0;
    
    const speedMs = distance / timeDiff;
    const speedKmh = speedMs * 3.6;
    
    return speedKmh;
  },

  interpolatePoint(point1, point2, factor) {
    if (!point1 || !point2) return null;
    
    const t = Math.max(0, Math.min(1, factor));
    
    return {
      latitude: point1.latitude + (point2.latitude - point1.latitude) * t,
      longitude: point1.longitude + (point2.longitude - point1.longitude) * t,
      timestamp: point1.timestamp + (point2.timestamp - point1.timestamp) * t
    };
  },

  isPointInPolygon(point, polygon) {
    if (!point || !polygon || polygon.length < 3) return false;
    
    const lat = point.latitude || point.lat;
    const lon = point.longitude || point.lon;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude || polygon[i].lat;
      const yi = polygon[i].longitude || polygon[i].lon;
      const xj = polygon[j].latitude || polygon[j].lat;
      const yj = polygon[j].longitude || polygon[j].lon;
      
      const intersect = ((yi > lon) !== (yj > lon)) &&
        (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  },

  calculateBearing(point1, point2) {
    const toRad = Math.PI / 180;
    const lat1 = point1.latitude * toRad;
    const lat2 = point2.latitude * toRad;
    const dLon = (point2.longitude - point1.longitude) * toRad;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  },

  findBoundingBox(points) {
    if (!points || points.length === 0) {
      return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
    }
    
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    
    points.forEach(point => {
      const lat = point.latitude || point.lat;
      const lon = point.longitude || point.lon;
      
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    });
    
    return { minLat, maxLat, minLon, maxLon };
  }
};

export default GeoUtils;
