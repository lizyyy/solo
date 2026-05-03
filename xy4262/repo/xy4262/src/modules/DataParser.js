export class DataParser {
  parseDronesJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.normalizeDronesData(data);
    } catch (error) {
      throw new Error('无人机数据解析失败: ' + error.message);
    }
  }

  normalizeDronesData(data) {
    if (data.drones && Array.isArray(data.drones)) {
      return data.drones.map((drone, index) => ({
        id: drone.id || `drone_${index}`,
        name: drone.name || `无人机 ${index + 1}`,
        batteryId: drone.batteryId || drone.battery_id || null,
        waypoints: this.normalizeWaypoints(drone.waypoints || drone.path || []),
        color: drone.color || this.getDefaultColor(index),
        startTime: drone.startTime || drone.start_time || 0,
        endTime: drone.endTime || drone.end_time || null
      });
    }
    
    if (Array.isArray(data)) {
      return data.map((drone, index) => ({
        id: drone.id || `drone_${index}`,
        name: drone.name || `无人机 ${index + 1}`,
        batteryId: drone.batteryId || drone.battery_id || null,
        waypoints: this.normalizeWaypoints(drone.waypoints || drone.path || []),
        color: drone.color || this.getDefaultColor(index),
        startTime: drone.startTime || drone.start_time || 0,
        endTime: drone.endTime || drone.end_time || null
      }));
    }

    throw new Error('无法识别的无人机数据格式');
  }

  normalizeWaypoints(waypoints) {
    return waypoints.map((wp, index) => ({
      time: wp.time !== undefined ? wp.time : wp.t !== undefined ? wp.t : index * 5,
      x: wp.x !== undefined ? wp.x : 0,
      y: wp.y !== undefined ? wp.y : 0,
      z: wp.z !== undefined ? wp.z : wp.altitude !== undefined ? wp.altitude : 10,
      speed: wp.speed !== undefined ? wp.speed : 2,
      color: wp.color || null
    }));
  }

  getDefaultColor(index) {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
      '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'
    ];
    return colors[index % colors.length];
  }

  parseNoFlyGeoJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      return this.normalizeNoFlyZones(data);
    } catch (error) {
      throw new Error('禁飞区数据解析失败: ' + error.message);
    }
  }

  normalizeNoFlyZones(data) {
    const zones = [];
    
    if (data.features && Array.isArray(data.features)) {
      data.features.forEach((feature, index) => {
        const zone = this.parseGeoJSONFeature(feature, index);
        if (zone) zones.push(zone);
      });
    } else if (data.type === 'Feature') {
      const zone = this.parseGeoJSONFeature(data, 0);
      if (zone) zones.push(zone);
    } else if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (item.type === 'Feature') {
          const zone = this.parseGeoJSONFeature(item, index);
          if (zone) zones.push(zone);
        } else {
          zones.push(this.parseSimpleZone(item, index));
        }
      });
    }

    return zones;
  }

  parseGeoJSONFeature(feature, index) {
    try {
      const geometry = feature.geometry;
      const properties = feature.properties || {};
      
      if (!geometry) return null;

      let zone = {
        id: properties.id || `nofly_${index}`,
        name: properties.name || `禁飞区 ${index + 1}`,
        type: properties.type || 'restricted',
        minAltitude: properties.minAltitude || properties.min_altitude || 0,
        maxAltitude: properties.maxAltitude || properties.max_altitude || 1000,
        startTime: properties.startTime || properties.start_time || 0,
        endTime: properties.endTime || properties.end_time || null
      };

      if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates.length > 0) {
        zone.shape = 'polygon';
        zone.coordinates = geometry.coordinates[0].map(coord => ({
          x: coord[0],
          y: coord[1]
        }));
        return zone;
      }

      if (geometry.type === 'Circle' || (geometry.type === 'Point' && properties.radius)) {
        zone.shape = 'circle';
        zone.center = {
          x: geometry.coordinates[0],
          y: geometry.coordinates[1]
        };
        zone.radius = properties.radius || 100;
        return zone;
      }

      if (geometry.type === 'Point') {
        zone.shape = 'circle';
        zone.center = {
          x: geometry.coordinates[0],
          y: geometry.coordinates[1]
        };
        zone.radius = 50;
        return zone;
      }

      return null;
    } catch (e) {
      console.warn('解析GeoJSON Feature失败:', e);
      return null;
    }
  }

  parseSimpleZone(item, index) {
    return {
      id: item.id || `nofly_${index}`,
      name: item.name || `禁飞区 ${index + 1}`,
      type: item.type || 'restricted',
      shape: item.shape || 'circle',
      center: item.center || { x: 0, y: 0 },
      radius: item.radius || 100,
      coordinates: item.coordinates || [],
      minAltitude: item.minAltitude || 0,
      maxAltitude: item.maxAltitude || 1000,
      startTime: item.startTime || 0,
      endTime: item.endTime || null
    };
  }

  parseBeatsCSV(csvString) {
    try {
      const lines = csvString.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = this.parseCSVLine(lines[0]);
      const beats = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const beat = {};
        headers.forEach((header, index) => {
          const value = values[index];
          header = header.toLowerCase().trim();

          if (header === 'time' || header === 't' || header === 'timestamp') {
            beat.time = parseFloat(value) || 0;
          } else if (header === 'type' || header === 'beat_type') {
            beat.type = value;
          } else if (header === 'intensity' || header === 'strength') {
            beat.intensity = parseFloat(value) || 1;
          } else {
            beat[header] = value;
          }
        });

        if (beat.time !== undefined) {
          beats.push(beat);
        }
      }

      return beats.sort((a, b) => a.time - b.time);
    } catch (error) {
      throw new Error('节拍表解析失败: ' + error.message);
    }
  }

  parseBatteriesCSV(csvString) {
    try {
      const lines = csvString.trim().split('\n');
      if (lines.length < 2) return [];

      const headers = this.parseCSVLine(lines[0]);
      const batteries = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const battery = {};
        headers.forEach((header, index) => {
          const value = values[index];
          header = header.toLowerCase().trim();

          if (header === 'id' || header === 'battery_id' || header === 'batteryid') {
            battery.id = value;
          } else if (header === 'capacity' || header === 'initial_capacity' || header === 'max_capacity') {
            battery.capacity = parseFloat(value) || 100;
          } else if (header === 'drain_rate' || header === 'drainrate' || header === 'consumption') {
            battery.drainRate = parseFloat(value) || 0.5;
          } else if (header === 'voltage') {
            battery.voltage = parseFloat(value) || 3.7;
          } else if (header === 'cycle_count' || header === 'cycles') {
            battery.cycleCount = parseInt(value) || 0;
          } else {
            battery[header] = value;
          }
        });

        if (battery.id) {
          batteries.push(battery);
        }
      }

      return batteries;
    } catch (error) {
      throw new Error('电池表解析失败: ' + error.message);
    }
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      result.push(current.trim());
    }

    return result;
  }
}
