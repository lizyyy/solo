import Papa from 'papaparse';

export class DataParser {
  constructor() {
    this.elevationData = null;
    this.facilities = {
      cableCars: [],
      guardrails: []
    };
    this.photos = [];
    this.hazards = [];
  }

  async parseElevationCSV(csvContent) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          try {
            this.elevationData = this._processElevationData(results.data);
            resolve(this.elevationData);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  _processElevationData(rawData) {
    const gridData = {
      points: [],
      gridSize: { rows: 0, cols: 0 },
      bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
    };

    for (const row of rawData) {
      if (row.x !== null && row.y !== null && row.elevation !== null) {
        const point = {
          x: parseFloat(row.x),
          y: parseFloat(row.y),
          z: parseFloat(row.elevation),
          slope: parseFloat(row.slope) || 0,
          aspect: parseFloat(row.aspect) || 0,
          flowAccumulation: parseFloat(row.flowAccumulation) || 0
        };
        gridData.points.push(point);

        gridData.bounds.minX = Math.min(gridData.bounds.minX, point.x);
        gridData.bounds.maxX = Math.max(gridData.bounds.maxX, point.x);
        gridData.bounds.minY = Math.min(gridData.bounds.minY, point.y);
        gridData.bounds.maxY = Math.max(gridData.bounds.maxY, point.y);
        gridData.bounds.minZ = Math.min(gridData.bounds.minZ, point.z);
        gridData.bounds.maxZ = Math.max(gridData.bounds.maxZ, point.z);
      }
    }

    const uniqueX = [...new Set(gridData.points.map(p => p.x))].sort((a, b) => a - b);
    const uniqueY = [...new Set(gridData.points.map(p => p.y))].sort((a, b) => a - b);
    gridData.gridSize = {
      cols: uniqueX.length,
      rows: uniqueY.length,
      cellSize: uniqueX.length > 1 ? uniqueX[1] - uniqueX[0] : 1
    };

    return gridData;
  }

  parseFacilitiesGeoJSON(geoJSONStr) {
    try {
      const geoJSON = typeof geoJSONStr === 'string' ? JSON.parse(geoJSONStr) : geoJSONStr;
      this.facilities = {
        cableCars: [],
        guardrails: []
      };

      for (const feature of geoJSON.features || []) {
        const type = feature.properties?.type || feature.geometry?.type;
        
        if (feature.properties?.type === 'cableCar' || type === 'LineString') {
          this.facilities.cableCars.push(this._parseCableCar(feature));
        } else if (feature.properties?.type === 'guardrail') {
          this.facilities.guardrails.push(this._parseGuardrail(feature));
        }
      }

      return this.facilities;
    } catch (error) {
      throw new Error('GeoJSON解析失败: ' + error.message);
    }
  }

  _parseCableCar(feature) {
    const coords = feature.geometry?.coordinates || [];
    return {
      id: feature.properties?.id || `cable_${Date.now()}`,
      name: feature.properties?.name || '缆车线路',
      type: 'cableCar',
      coordinates: coords.map(c => ({ x: c[0], y: c[1], z: c[2] || 0 })),
      properties: feature.properties || {}
    };
  }

  _parseGuardrail(feature) {
    const coords = feature.geometry?.coordinates || [];
    return {
      id: feature.properties?.id || `guardrail_${Date.now()}`,
      name: feature.properties?.name || '护栏',
      type: 'guardrail',
      coordinates: coords.map(c => ({ x: c[0], y: c[1], z: c[2] || 0 })),
      properties: feature.properties || {}
    };
  }

  parsePhotosList(photosJSON) {
    try {
      const data = typeof photosJSON === 'string' ? JSON.parse(photosJSON) : photosJSON;
      this.photos = data.map((photo, index) => ({
        id: photo.id || `photo_${index}`,
        filename: photo.filename || `photo_${index}.jpg`,
        path: photo.path || '',
        location: photo.location || { x: 0, y: 0, z: 0 },
        timestamp: photo.timestamp || new Date().toISOString(),
        description: photo.description || '',
        tags: photo.tags || []
      }));
      return this.photos;
    } catch (error) {
      throw new Error('照片清单解析失败: ' + error.message);
    }
  }

  parseHazardsRecord(hazardsJSON) {
    try {
      const data = typeof hazardsJSON === 'string' ? JSON.parse(hazardsJSON) : hazardsJSON;
      this.hazards = data.map((hazard, index) => ({
        id: hazard.id || `hazard_${index}`,
        type: hazard.type || 'unknown',
        location: hazard.location || { x: 0, y: 0, z: 0 },
        severity: hazard.severity || 'medium',
        description: hazard.description || '',
        radius: hazard.radius || 5,
        photos: hazard.photos || [],
        timestamp: hazard.timestamp || new Date().toISOString()
      }));
      return this.hazards;
    } catch (error) {
      throw new Error('隐患记录解析失败: ' + error.message);
    }
  }

  getAllData() {
    return {
      elevation: this.elevationData,
      facilities: this.facilities,
      photos: this.photos,
      hazards: this.hazards
    };
  }

  validateData() {
    const errors = [];
    
    if (!this.elevationData || this.elevationData.points.length === 0) {
      errors.push('缺少高程数据');
    }
    
    if (this.elevationData?.gridSize.cols === 0 || this.elevationData?.gridSize.rows === 0) {
      errors.push('高程网格数据格式不正确');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
