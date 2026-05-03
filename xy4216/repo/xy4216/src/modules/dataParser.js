import Papa from 'papaparse';

export class DataParser {
  constructor() {
    this.forkliftData = null;
    this.pedestrianData = null;
    this.warehouseData = null;
  }

  parseForkliftCSV(csvText) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedData = this._transformForkliftData(results.data);
          this.forkliftData = parsedData;
          resolve(parsedData);
        },
        error: (error) => {
          reject(new Error(`CSV解析错误: ${error.message}`));
        }
      });
    });
  }

  _transformForkliftData(rawData) {
    return rawData.map((row, index) => ({
      id: row.id || index,
      deviceId: row.device_id || row.deviceId || 'forklift_1',
      timestamp: this._parseTimestamp(row.timestamp || row.time),
      x: parseFloat(row.x) || 0,
      y: parseFloat(row.y) || 0,
      z: parseFloat(row.z) || 0,
      heading: parseFloat(row.heading) || 0,
      speed: parseFloat(row.speed) || 0
    })).filter(item => item.timestamp !== null);
  }

  parsePedestrianJSON(jsonText) {
    return new Promise((resolve, reject) => {
      try {
        const rawData = JSON.parse(jsonText);
        const parsedData = this._transformPedestrianData(rawData);
        this.pedestrianData = parsedData;
        resolve(parsedData);
      } catch (error) {
        reject(new Error(`JSON解析错误: ${error.message}`));
      }
    });
  }

  _transformPedestrianData(rawData) {
    let dataArray = [];
    
    if (Array.isArray(rawData)) {
      dataArray = rawData;
    } else if (rawData.data && Array.isArray(rawData.data)) {
      dataArray = rawData.data;
    } else if (rawData.trajectory && Array.isArray(rawData.trajectory)) {
      dataArray = rawData.trajectory;
    }

    return dataArray.map((row, index) => ({
      id: row.id || index,
      deviceId: row.device_id || row.deviceId || 'pedestrian_1',
      timestamp: this._parseTimestamp(row.timestamp || row.time),
      x: parseFloat(row.x) || 0,
      y: parseFloat(row.y) || 0,
      z: parseFloat(row.z) || 0
    })).filter(item => item.timestamp !== null);
  }

  parseWarehouseJSON(jsonText) {
    return new Promise((resolve, reject) => {
      try {
        const rawData = JSON.parse(jsonText);
        const parsedData = this._transformWarehouseData(rawData);
        this.warehouseData = parsedData;
        resolve(parsedData);
      } catch (error) {
        reject(new Error(`仓库平面图JSON解析错误: ${error.message}`));
      }
    });
  }

  _transformWarehouseData(rawData) {
    return {
      name: rawData.name || '仓库区域',
      dimensions: {
        width: rawData.dimensions?.width || rawData.width || 50,
        depth: rawData.dimensions?.depth || rawData.depth || 30,
        height: rawData.dimensions?.height || rawData.height || 6
      },
      racks: this._parseRacks(rawData.racks || rawData.shelves || []),
      obstacles: this._parseObstacles(rawData.obstacles || []),
      safeZones: this._parseSafeZones(rawData.safeZones || rawData.safe_zones || [])
    };
  }

  _parseRacks(racksData) {
    if (!racksData || !Array.isArray(racksData)) return [];

    return racksData.map((rack, index) => ({
      id: rack.id || `rack_${index}`,
      name: rack.name || `货架 ${index + 1}`,
      position: {
        x: rack.position?.x || rack.x || 0,
        y: rack.position?.y || rack.y || 0,
        z: rack.position?.z || rack.z || 0
      },
      dimensions: {
        width: rack.dimensions?.width || rack.width || 2,
        depth: rack.dimensions?.depth || rack.depth || 0.8,
        height: rack.dimensions?.height || rack.height || 3
      },
      levels: rack.levels || 5,
      color: rack.color || '#4a6fa5'
    }));
  }

  _parseObstacles(obstaclesData) {
    if (!obstaclesData || !Array.isArray(obstaclesData)) return [];

    return obstaclesData.map((obstacle, index) => ({
      id: obstacle.id || `obstacle_${index}`,
      type: obstacle.type || 'pillar',
      position: {
        x: obstacle.position?.x || obstacle.x || 0,
        y: obstacle.position?.y || obstacle.y || 0,
        z: obstacle.position?.z || obstacle.z || 0
      },
      dimensions: {
        width: obstacle.dimensions?.width || obstacle.width || 0.5,
        depth: obstacle.dimensions?.depth || obstacle.depth || 0.5,
        height: obstacle.dimensions?.height || obstacle.height || 4
      }
    }));
  }

  _parseSafeZones(safeZonesData) {
    if (!safeZonesData || !Array.isArray(safeZonesData)) return [];

    return safeZonesData.map((zone, index) => ({
      id: zone.id || `zone_${index}`,
      name: zone.name || `安全区域 ${index + 1}`,
      type: zone.type || 'walkway',
      polygon: zone.polygon || zone.boundary || []
    }));
  }

  _parseTimestamp(timestamp) {
    if (timestamp === null || timestamp === undefined) return null;
    
    if (typeof timestamp === 'number') {
      return timestamp;
    }
    
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) {
      return parsed / 1000;
    }
    
    if (!isNaN(parseFloat(timestamp))) {
      return parseFloat(timestamp);
    }
    
    return null;
  }

  getAllData() {
    return {
      forklift: this.forkliftData,
      pedestrian: this.pedestrianData,
      warehouse: this.warehouseData
    };
  }

  hasAllData() {
    return this.forkliftData !== null && 
           this.pedestrianData !== null && 
           this.warehouseData !== null;
  }

  clearData() {
    this.forkliftData = null;
    this.pedestrianData = null;
    this.warehouseData = null;
  }
}

export default DataParser;
