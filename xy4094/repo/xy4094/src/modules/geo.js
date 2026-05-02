export class GeoCalculator {
  constructor() {
    this.EARTH_RADIUS = 6371000;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  toDeg(radians) {
    return radians * (180 / Math.PI);
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return this.EARTH_RADIUS * c;
  }

  distanceBetween(point1, point2) {
    return this.haversineDistance(
      point1.latitude ?? point1.lat,
      point1.longitude ?? point1.lng ?? point1.lon,
      point2.latitude ?? point2.lat,
      point2.longitude ?? point2.lng ?? point2.lon
    );
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = this.toRad(lon2 - lon1);
    
    const y = Math.sin(dLon) * Math.cos(this.toRad(lat2));
    const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
              Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLon);
    
    let bearing = this.toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360;
    
    return bearing;
  }

  bearingBetween(point1, point2) {
    return this.calculateBearing(
      point1.latitude ?? point1.lat,
      point1.longitude ?? point1.lng ?? point1.lon,
      point2.latitude ?? point2.lat,
      point2.longitude ?? point2.lng ?? point2.lon
    );
  }

  calculateWindAngle(heading, windDirection) {
    let angle = Math.abs(heading - windDirection);
    if (angle > 180) {
      angle = 360 - angle;
    }
    return angle;
  }

  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point;
    const B = lineStart;
    const C = lineEnd;
    
    const AB = this.haversineDistance(
      B.latitude, B.longitude,
      A.latitude, A.longitude
    );
    const AC = this.haversineDistance(
      A.latitude, A.longitude,
      C.latitude, C.longitude
    );
    const BC = this.haversineDistance(
      B.latitude, B.longitude,
      C.latitude, C.longitude
    );
    
    if (BC === 0) return AB;
    
    const angleB = Math.acos(
      (AB * AB + BC * BC - AC * AC) / (2 * AB * BC)
    );
    
    const angleC = Math.acos(
      (AC * AC + BC * BC - AB * AB) / (2 * AC * BC)
    );
    
    if (angleB > Math.PI / 2) return AB;
    if (angleC > Math.PI / 2) return AC;
    
    return AB * Math.sin(angleB);
  }

  pointInPolygon(point, polygon) {
    const coordinates = polygon.coordinates[0];
    
    const x = point.longitude ?? point.lng ?? point.lon;
    const y = point.latitude ?? point.lat;
    
    let inside = false;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
      const xi = coordinates[i][0];
      const yi = coordinates[i][1];
      const xj = coordinates[j][0];
      const yj = coordinates[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }

  pointInMultiPolygon(point, multiPolygon) {
    for (const polygon of multiPolygon.coordinates) {
      if (this.pointInPolygon(point, { coordinates: polygon })) {
        return true;
      }
    }
    return false;
  }

  pointInCircle(point, center, radius) {
    const centerLat = center.latitude ?? center[1];
    const centerLng = center.longitude ?? center[0];
    const pointLat = point.latitude ?? point.lat;
    const pointLng = point.longitude ?? point.lng ?? point.lon;
    
    const distance = this.haversineDistance(pointLat, pointLng, centerLat, centerLng);
    
    return distance <= radius;
  }

  pointInGeometry(point, geometry) {
    switch (geometry.type) {
      case 'Point':
        const dist = this.haversineDistance(
          point.latitude ?? point.lat,
          point.longitude ?? point.lng ?? point.lon,
          geometry.coordinates[1],
          geometry.coordinates[0]
        );
        return dist <= 10;
      
      case 'Polygon':
        return this.pointInPolygon(point, geometry);
      
      case 'MultiPolygon':
        return this.pointInMultiPolygon(point, geometry);
      
      case 'Circle':
        return this.pointInCircle(point, geometry.coordinates, geometry.radius);
      
      default:
        return false;
    }
  }

  pointInFeature(point, feature) {
    if (!feature || !feature.geometry) return false;
    return this.pointInGeometry(point, feature.geometry);
  }

  checkCollisionWithZone(point, noFlyZone) {
    const isInside = this.pointInFeature(point, noFlyZone);
    
    if (isInside) {
      return {
        collision: true,
        distance: 0,
        zoneId: noFlyZone.id,
        zoneName: noFlyZone.properties?.name || '未命名禁飞区'
      };
    }
    
    const minDistance = this.calculateMinimumDistanceToZone(point, noFlyZone);
    
    return {
      collision: false,
      distance: minDistance,
      zoneId: noFlyZone.id,
      zoneName: noFlyZone.properties?.name || '未命名禁飞区'
    };
  }

  calculateMinimumDistanceToZone(point, feature) {
    if (!feature || !feature.geometry) return Infinity;
    
    const geometry = feature.geometry;
    const pointLat = point.latitude ?? point.lat;
    const pointLng = point.longitude ?? point.lng ?? point.lon;
    
    let minDistance = Infinity;
    
    switch (geometry.type) {
      case 'Polygon':
        for (const ring of geometry.coordinates) {
          for (let i = 0; i < ring.length - 1; i++) {
            const lineStart = { latitude: ring[i][1], longitude: ring[i][0] };
            const lineEnd = { latitude: ring[i + 1][1], longitude: ring[i + 1][0] };
            const dist = this.pointToLineDistance(point, lineStart, lineEnd);
            minDistance = Math.min(minDistance, dist);
          }
        }
        break;
      
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            for (let i = 0; i < ring.length - 1; i++) {
              const lineStart = { latitude: ring[i][1], longitude: ring[i][0] };
              const lineEnd = { latitude: ring[i + 1][1], longitude: ring[i + 1][0] };
              const dist = this.pointToLineDistance(point, lineStart, lineEnd);
              minDistance = Math.min(minDistance, dist);
            }
          }
        }
        break;
      
      case 'Circle':
        const centerDist = this.haversineDistance(
          pointLat, pointLng,
          geometry.coordinates[1], geometry.coordinates[0]
        );
        minDistance = Math.abs(centerDist - geometry.radius);
        break;
      
      case 'Point':
        minDistance = this.haversineDistance(
          pointLat, pointLng,
          geometry.coordinates[1], geometry.coordinates[0]
        );
        break;
    }
    
    return minDistance;
  }

  calculatePathToZoneDistance(trackPoints, noFlyZone) {
    let minDistance = Infinity;
    let closestPointIndex = -1;
    
    for (let i = 0; i < trackPoints.length; i++) {
      const distance = this.calculateMinimumDistanceToZone(trackPoints[i], noFlyZone);
      if (distance < minDistance) {
        minDistance = distance;
        closestPointIndex = i;
      }
    }
    
    return {
      minDistance,
      closestPointIndex,
      closestPoint: trackPoints[closestPointIndex]
    };
  }

  interpolatePoint(point1, point2, progress) {
    const t = Math.max(0, Math.min(1, progress));
    
    return {
      timestamp: this.lerp(point1.timestamp, point2.timestamp, t),
      latitude: this.lerp(point1.latitude, point2.latitude, t),
      longitude: this.lerp(point1.longitude, point2.longitude, t),
      altitude: this.lerp(point1.altitude, point2.altitude, t),
      speed: this.lerp(point1.speed, point2.speed, t),
      heading: this.lerpAngle(point1.heading, point2.heading, t),
      gimbalPitch: this.lerp(point1.gimbalPitch, point2.gimbalPitch, t),
      gimbalYaw: this.lerpAngle(point1.gimbalYaw, point2.gimbalYaw, t),
      roll: this.lerp(point1.roll, point2.roll, t),
      pitch: this.lerp(point1.pitch, point1.pitch, t)
    };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpAngle(a, b, t) {
    if (a === undefined || b === undefined) return undefined;
    
    const mod = (n, m) => ((n % m) + m) % m;
    
    let diff = b - a;
    diff = mod(diff + 180, 360) - 180;
    
    const result = a + diff * t;
    return mod(result, 360);
  }

  getBoundsFromPoints(points) {
    if (!points || points.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    let minAlt = Infinity, maxAlt = -Infinity;
    
    for (const point of points) {
      const lat = point.latitude ?? point.lat;
      const lng = point.longitude ?? point.lng ?? point.lon;
      const alt = point.altitude ?? 0;
      
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minAlt = Math.min(minAlt, alt);
      maxAlt = Math.max(maxAlt, alt);
    }
    
    return {
      southWest: { latitude: minLat, longitude: minLng },
      northEast: { latitude: maxLat, longitude: maxLng },
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2
      },
      altitudeRange: { min: minAlt, max: maxAlt }
    };
  }

  getBoundsFromFeatures(features) {
    if (!features || features.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    for (const feature of features) {
      const bounds = this.getFeatureBounds(feature);
      if (bounds) {
        minLat = Math.min(minLat, bounds.southWest.latitude);
        maxLat = Math.max(maxLat, bounds.northEast.latitude);
        minLng = Math.min(minLng, bounds.southWest.longitude);
        maxLng = Math.max(maxLng, bounds.northEast.longitude);
      }
    }
    
    if (minLat === Infinity) return null;
    
    return {
      southWest: { latitude: minLat, longitude: minLng },
      northEast: { latitude: maxLat, longitude: maxLng },
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2
      }
    };
  }

  getFeatureBounds(feature) {
    if (!feature || !feature.geometry) return null;
    
    const geometry = feature.geometry;
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    const processCoordinates = (coords, type) => {
      if (type === 'Point') {
        minLat = Math.min(minLat, coords[1]);
        maxLat = Math.max(maxLat, coords[1]);
        minLng = Math.min(minLng, coords[0]);
        maxLng = Math.max(maxLng, coords[0]);
      } else if (type === 'LineString' || type === 'Polygon') {
        for (const coord of coords) {
          minLat = Math.min(minLat, coord[1]);
          maxLat = Math.max(maxLat, coord[1]);
          minLng = Math.min(minLng, coord[0]);
          maxLng = Math.max(maxLng, coord[0]);
        }
      }
    };
    
    switch (geometry.type) {
      case 'Point':
        processCoordinates(geometry.coordinates, 'Point');
        break;
      case 'LineString':
        processCoordinates(geometry.coordinates, 'LineString');
        break;
      case 'Polygon':
        for (const ring of geometry.coordinates) {
          processCoordinates(ring, 'LineString');
        }
        break;
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            processCoordinates(ring, 'LineString');
          }
        }
        break;
      case 'Circle':
        const center = geometry.coordinates;
        const radius = geometry.radius || 100;
        const latOffset = radius / this.EARTH_RADIUS * (180 / Math.PI);
        const lngOffset = radius / (this.EARTH_RADIUS * Math.cos(this.toRad(center[1]))) * (180 / Math.PI);
        
        minLat = center[1] - latOffset;
        maxLat = center[1] + latOffset;
        minLng = center[0] - lngOffset;
        maxLng = center[0] + lngOffset;
        break;
    }
    
    if (minLat === Infinity) return null;
    
    return {
      southWest: { latitude: minLat, longitude: minLng },
      northEast: { latitude: maxLat, longitude: maxLng },
      center: {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2
      }
    };
  }

  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    });
  }

  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }
}

export default GeoCalculator;
