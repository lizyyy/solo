export class DataParser {
  constructor() {
    this.parsedData = {
      track: null,
      weather: null,
      alerts: null,
      noFlyZones: null
    };
  }

  parseTrackData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      const points = [];
      let startTime = null;
      let endTime = null;
      
      if (data.points && Array.isArray(data.points)) {
        for (const point of data.points) {
          const parsedPoint = this.parseTrackPoint(point);
          if (parsedPoint) {
            points.push(parsedPoint);
            
            if (!startTime || parsedPoint.timestamp < startTime) {
              startTime = parsedPoint.timestamp;
            }
            if (!endTime || parsedPoint.timestamp > endTime) {
              endTime = parsedPoint.timestamp;
            }
          }
        }
      } else if (Array.isArray(data)) {
        for (const point of data) {
          const parsedPoint = this.parseTrackPoint(point);
          if (parsedPoint) {
            points.push(parsedPoint);
            
            if (!startTime || parsedPoint.timestamp < startTime) {
              startTime = parsedPoint.timestamp;
            }
            if (!endTime || parsedPoint.timestamp > endTime) {
              endTime = parsedPoint.timestamp;
            }
          }
        }
      }
      
      points.sort((a, b) => a.timestamp - b.timestamp);
      
      this.calculateDerivedValues(points);
      
      this.parsedData.track = {
        points,
        startTime,
        endTime,
        duration: endTime && startTime ? endTime - startTime : 0,
        pointCount: points.length
      };
      
      return this.parsedData.track;
    } catch (error) {
      console.error('Error parsing track data:', error);
      throw new Error(`轨迹数据解析失败: ${error.message}`);
    }
  }

  parseTrackPoint(point) {
    try {
      const lng = point.longitude ?? point.lng ?? point.lon;
      const lat = point.latitude ?? point.lat;
      
      if (lng === undefined || lat === undefined) {
        return null;
      }
      
      let timestamp = point.timestamp ?? point.time ?? point.t;
      if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp).getTime();
      }
      
      return {
        timestamp,
        longitude: parseFloat(lng),
        latitude: parseFloat(lat),
        altitude: point.altitude ?? point.alt ?? 0,
        speed: point.speed ?? point.velocity ?? 0,
        heading: point.heading ?? point.yaw ?? point.azimuth ?? 0,
        gimbalPitch: point.gimbalPitch ?? point.gimbal_pitch ?? point.cameraAngle ?? 0,
        gimbalYaw: point.gimbalYaw ?? point.gimbal_yaw ?? 0,
        roll: point.roll ?? 0,
        pitch: point.pitch ?? 0,
        vx: point.vx ?? 0,
        vy: point.vy ?? 0,
        vz: point.vz ?? 0,
        satellites: point.satellites ?? point.sat ?? null,
        battery: point.battery ?? point.batteryLevel ?? null,
        mode: point.mode ?? point.flightMode ?? null
      };
    } catch (error) {
      console.warn('Failed to parse track point:', point, error);
      return null;
    }
  }

  calculateDerivedValues(points) {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      if (i > 0) {
        const prevPoint = points[i - 1];
        const timeDiff = point.timestamp - prevPoint.timestamp;
        
        if (timeDiff > 0 && (point.speed === undefined || point.speed === 0)) {
          const distance = this.haversineDistance(
            prevPoint.latitude, prevPoint.longitude,
            point.latitude, point.longitude
          );
          point.speed = distance / (timeDiff / 1000);
        }
        
        if (point.heading === undefined || point.heading === 0) {
          point.heading = this.calculateBearing(
            prevPoint.latitude, prevPoint.longitude,
            point.latitude, point.longitude
          );
        }
      }
    }
  }

  parseWeatherData(csvData) {
    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV文件格式错误：至少需要标题行和一行数据');
      }
      
      const headers = this.parseCsvLine(lines[0]);
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCsvLine(lines[i]);
        if (values.length !== headers.length) continue;
        
        const record = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j].toLowerCase().trim();
          const value = values[j].trim();
          
          if (header.includes('time') || header.includes('timestamp') || header === 't') {
            let timestamp = value;
            if (typeof timestamp === 'string') {
              const parsed = Date.parse(timestamp);
              if (!isNaN(parsed)) {
                timestamp = parsed;
              } else if (!isNaN(parseFloat(timestamp))) {
                timestamp = parseFloat(timestamp);
              }
            }
            record.timestamp = timestamp;
          } else if (header.includes('wind') && header.includes('speed')) {
            record.windSpeed = parseFloat(value) || 0;
          } else if (header.includes('wind') && (header.includes('dir') || header.includes('direction'))) {
            record.windDirection = parseFloat(value) || 0;
          } else if (header.includes('wind') && header.includes('angle')) {
            record.windAngle = parseFloat(value) || 0;
          } else if (header.includes('temp') || header.includes('temperature')) {
            record.temperature = parseFloat(value) || null;
          } else if (header.includes('humidity')) {
            record.humidity = parseFloat(value) || null;
          } else if (header.includes('pressure')) {
            record.pressure = parseFloat(value) || null;
          } else {
            record[header] = isNaN(parseFloat(value)) ? value : parseFloat(value);
          }
        }
        
        if (record.timestamp !== undefined) {
          records.push(record);
        }
      }
      
      records.sort((a, b) => a.timestamp - b.timestamp);
      
      let startTime = null;
      let endTime = null;
      
      if (records.length > 0) {
        startTime = records[0].timestamp;
        endTime = records[records.length - 1].timestamp;
      }
      
      this.parsedData.weather = {
        records,
        startTime,
        endTime,
        recordCount: records.length
      };
      
      return this.parsedData.weather;
    } catch (error) {
      console.error('Error parsing weather data:', error);
      throw new Error(`气象数据解析失败: ${error.message}`);
    }
  }

  parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  parseGeoJSON(geoJsonData) {
    try {
      const data = typeof geoJsonData === 'string' ? JSON.parse(geoJsonData) : geoJsonData;
      
      const features = [];
      
      if (data.type === 'FeatureCollection' && data.features) {
        for (const feature of data.features) {
          const parsed = this.parseGeoJSONFeature(feature);
          if (parsed) {
            features.push(parsed);
          }
        }
      } else if (data.type === 'Feature') {
        const parsed = this.parseGeoJSONFeature(data);
        if (parsed) {
          features.push(parsed);
        }
      } else if (data.type) {
        const parsed = this.parseGeoJSONFeature({ type: 'Feature', geometry: data, properties: {} });
        if (parsed) {
          features.push(parsed);
        }
      }
      
      return {
        type: 'FeatureCollection',
        features,
        featureCount: features.length
      };
    } catch (error) {
      console.error('Error parsing GeoJSON:', error);
      throw new Error(`GeoJSON解析失败: ${error.message}`);
    }
  }

  parseGeoJSONFeature(feature) {
    if (!feature.geometry) return null;
    
    const geometry = feature.geometry;
    const properties = feature.properties || {};
    
    let parsedGeometry = null;
    
    switch (geometry.type) {
      case 'Point':
        parsedGeometry = {
          type: 'Point',
          coordinates: geometry.coordinates
        };
        break;
      
      case 'Polygon':
        parsedGeometry = {
          type: 'Polygon',
          coordinates: geometry.coordinates
        };
        break;
      
      case 'MultiPolygon':
        parsedGeometry = {
          type: 'MultiPolygon',
          coordinates: geometry.coordinates
        };
        break;
      
      case 'Circle':
        parsedGeometry = {
          type: 'Circle',
          coordinates: geometry.coordinates,
          radius: geometry.radius || properties.radius || 100
        };
        break;
      
      case 'LineString':
        parsedGeometry = {
          type: 'LineString',
          coordinates: geometry.coordinates
        };
        break;
      
      default:
        console.warn('Unsupported geometry type:', geometry.type);
        return null;
    }
    
    return {
      id: feature.id ?? properties.id ?? this.generateId(),
      geometry: parsedGeometry,
      properties: {
        name: properties.name ?? properties.NAME ?? null,
        description: properties.description ?? properties.DESCRIPTION ?? null,
        level: properties.level ?? properties.LEVEL ?? 'warning',
        priority: properties.priority ?? properties.PRIORITY ?? 1,
        ...properties
      }
    };
  }

  parseAlertData(geoJsonData) {
    const result = this.parseGeoJSON(geoJsonData);
    this.parsedData.alerts = result;
    return result;
  }

  parseNoFlyZoneData(geoJsonData) {
    const result = this.parseGeoJSON(geoJsonData);
    this.parsedData.noFlyZones = result;
    return result;
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  toDeg(rad) {
    return rad * (180 / Math.PI);
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

  interpolateWeatherAtTime(weatherData, targetTimestamp) {
    if (!weatherData || !weatherData.records || weatherData.records.length === 0) {
      return null;
    }
    
    const records = weatherData.records;
    
    if (targetTimestamp <= records[0].timestamp) {
      return { ...records[0] };
    }
    
    if (targetTimestamp >= records[records.length - 1].timestamp) {
      return { ...records[records.length - 1] };
    }
    
    for (let i = 1; i < records.length; i++) {
      if (targetTimestamp <= records[i].timestamp) {
        const prev = records[i - 1];
        const curr = records[i];
        
        const timeDiff = curr.timestamp - prev.timestamp;
        const progress = (targetTimestamp - prev.timestamp) / timeDiff;
        
        return {
          timestamp: targetTimestamp,
          windSpeed: this.lerp(prev.windSpeed, curr.windSpeed, progress),
          windDirection: this.lerpAngle(prev.windDirection, curr.windDirection, progress),
          temperature: prev.temperature !== null && curr.temperature !== null 
            ? this.lerp(prev.temperature, curr.temperature, progress) 
            : null,
          humidity: prev.humidity !== null && curr.humidity !== null 
            ? this.lerp(prev.humidity, curr.humidity, progress) 
            : null,
          pressure: prev.pressure !== null && curr.pressure !== null 
            ? this.lerp(prev.pressure, curr.pressure, progress) 
            : null
        };
      }
    }
    
    return { ...records[records.length - 1] };
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  lerpAngle(a, b, t) {
    const diff = ((b - a + 180) % 360) - 180;
    return (a + diff * t + 360) % 360;
  }

  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getParsedData() {
    return { ...this.parsedData };
  }

  clear() {
    this.parsedData = {
      track: null,
      weather: null,
      alerts: null,
      noFlyZones: null
    };
  }
}

export default DataParser;
