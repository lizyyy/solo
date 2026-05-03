export class DataParser {
  constructor() {
    this.parsedData = {
      shelves: null,
      forkliftTrajectory: null,
      nearMissEvents: null,
      cameraAnnotations: null
    };
  }

  parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`JSON 解析失败: ${e.message}`);
    }
  }

  parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV 文件格式错误: 至少需要表头和一行数据');
    }

    const headers = this.parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const values = this.parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, index) => {
        row[header.trim()] = this.convertValue(values[index]);
      });
      rows.push(row);
    }

    return rows;
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
    result.push(current.trim());
    return result;
  }

  convertValue(value) {
    if (value === null || value === undefined || value === '') return null;
    
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    
    return value;
  }

  parseShelves(jsonData) {
    const data = typeof jsonData === 'string' ? this.parseJSON(jsonData) : jsonData;
    
    if (!data.shelves || !Array.isArray(data.shelves)) {
      throw new Error('货架布局数据格式错误: 缺少 shelves 数组');
    }

    const shelves = data.shelves.map(shelf => ({
      id: shelf.id || `shelf_${Math.random().toString(36).substr(2, 9)}`,
      name: shelf.name || '未命名货架',
      position: {
        x: shelf.position?.x ?? 0,
        y: shelf.position?.y ?? 0,
        z: shelf.position?.z ?? 0
      },
      size: {
        width: shelf.size?.width ?? 2,
        depth: shelf.size?.depth ?? 1,
        height: shelf.size?.height ?? 5
      },
      isBlindSpot: shelf.isBlindSpot || false,
      blindSpotZone: shelf.blindSpotZone ? {
        radius: shelf.blindSpotZone.radius ?? 3,
        angle: shelf.blindSpotZone.angle ?? 120
      } : null
    }));

    this.parsedData.shelves = {
      version: data.version || '1.0',
      warehouseSize: data.warehouseSize || { width: 50, depth: 50, height: 10 },
      shelves: shelves,
      noEntryZones: data.noEntryZones || [],
      temporaryObstacles: data.temporaryObstacles || []
    };

    return this.parsedData.shelves;
  }

  parseForkliftTrajectory(csvData) {
    const rows = typeof csvData === 'string' ? this.parseCSV(csvData) : csvData;

    const trajectory = rows.map((row, index) => {
      const timestamp = row.timestamp || row.time || row.Timestamp || index;
      return {
        index: index,
        timestamp: this.parseTimestamp(timestamp),
        rawTimestamp: timestamp,
        forkliftId: row.forkliftId || row.forklift_id || row['Forklift ID'] || 'FL-001',
        position: {
          x: row.x ?? row.X ?? 0,
          y: row.y ?? row.Y ?? 0,
          z: row.z ?? row.Z ?? 0
        },
        speed: row.speed ?? row.Speed ?? 0,
        speedLimit: row.speedLimit ?? row['Speed Limit'] ?? 5,
        direction: row.direction ?? row.Direction ?? 0,
        isReversing: row.isReversing ?? row['Is Reversing'] ?? false,
        gear: row.gear ?? row.Gear ?? 'forward',
        steeringAngle: row.steeringAngle ?? row['Steering Angle'] ?? 0,
        loadWeight: row.loadWeight ?? row['Load Weight'] ?? 0
      };
    });

    trajectory.sort((a, b) => a.timestamp - b.timestamp);

    this.parsedData.forkliftTrajectory = {
      forkliftId: trajectory[0]?.forkliftId || 'FL-001',
      startTime: trajectory[0]?.timestamp || 0,
      endTime: trajectory[trajectory.length - 1]?.timestamp || 0,
      totalDistance: 0,
      points: trajectory
    };

    return this.parsedData.forkliftTrajectory;
  }

  parseNearMissEvents(jsonData) {
    const data = typeof jsonData === 'string' ? this.parseJSON(jsonData) : jsonData;
    
    const events = (data.events || data.nearMisses || []).map(event => ({
      id: event.id || `event_${Math.random().toString(36).substr(2, 9)}`,
      type: this.normalizeEventType(event.type || event.eventType || 'near-miss'),
      timestamp: this.parseTimestamp(event.timestamp || event.time || 0),
      rawTimestamp: event.timestamp || event.time,
      severity: event.severity || event.Severity || 'medium',
      description: event.description || event.Description || '',
      location: {
        x: event.location?.x ?? event.x ?? 0,
        y: event.location?.y ?? event.y ?? 0,
        z: event.location?.z ?? event.z ?? 0
      },
      involvedEntities: event.involvedEntities || event.entities || [],
      evidence: event.evidence || {
        cameraFeeds: [],
        sensorData: null
      },
      detectedBy: event.detectedBy || 'rule-engine',
      status: event.status || 'pending',
      reviewNotes: event.reviewNotes || '',
      reviewStatus: event.reviewStatus || 'unreviewed'
    }));

    events.sort((a, b) => a.timestamp - b.timestamp);

    this.parsedData.nearMissEvents = {
      version: data.version || '1.0',
      events: events,
      statistics: data.statistics || this.calculateEventStats(events)
    };

    return this.parsedData.nearMissEvents;
  }

  parseCameraAnnotations(jsonData) {
    const data = typeof jsonData === 'string' ? this.parseJSON(jsonData) : jsonData;
    
    const cameras = (data.cameras || data.annotations || []).map(camera => ({
      id: camera.id || `cam_${Math.random().toString(36).substr(2, 9)}`,
      name: camera.name || camera.cameraName || '未命名摄像头',
      position: {
        x: camera.position?.x ?? 0,
        y: camera.position?.y ?? 5,
        z: camera.position?.z ?? 0
      },
      rotation: {
        pan: camera.rotation?.pan ?? 0,
        tilt: camera.rotation?.tilt ?? -30,
        roll: camera.rotation?.roll ?? 0
      },
      fov: camera.fov ?? 90,
      coverageArea: camera.coverageArea ?? { radius: 15, angle: 120 },
      annotations: (camera.annotations || []).map(anno => ({
        timestamp: this.parseTimestamp(anno.timestamp || anno.time || 0),
        type: anno.type || 'object',
        label: anno.label || '',
        confidence: anno.confidence ?? 1,
        boundingBox: anno.boundingBox,
        position: anno.position
      }))
    }));

    this.parsedData.cameraAnnotations = {
      version: data.version || '1.0',
      cameras: cameras
    };

    return this.parsedData.cameraAnnotations;
  }

  parseTimestamp(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date.getTime();
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
    return 0;
  }

  normalizeEventType(type) {
    const typeMap = {
      'blind-spot': 'blind-spot',
      'blind_spot': 'blind-spot',
      'blindspot': 'blind-spot',
      '盲区交汇': 'blind-spot',
      'overspeed': 'overspeed',
      'over-speed': 'overspeed',
      'over_speed': 'overspeed',
      '超速': 'overspeed',
      'no-entry': 'no-entry',
      'no_entry': 'no-entry',
      'noentry': 'no-entry',
      '禁行区': 'no-entry',
      'near-miss': 'near-miss',
      'near_miss': 'near-miss',
      'nearmiss': 'near-miss',
      '近失': 'near-miss'
    };
    return typeMap[type.toLowerCase()] || type;
  }

  calculateEventStats(events) {
    const stats = {
      total: events.length,
      byType: {},
      bySeverity: {},
      byStatus: {}
    };

    events.forEach(event => {
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
      stats.byStatus[event.reviewStatus] = (stats.byStatus[event.reviewStatus] || 0) + 1;
    });

    return stats;
  }

  getAllData() {
    return { ...this.parsedData };
  }

  isComplete() {
    return !!(
      this.parsedData.shelves &&
      this.parsedData.forkliftTrajectory
    );
  }
}

export default DataParser;
