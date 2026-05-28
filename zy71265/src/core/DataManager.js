import { generateId, generateHash, groupBy, uniqBy, mean, median, distance2D, readFileAsJSON, formatDateTime } from '../utils/helpers.js';
import { CONFLICT_ACTIONS, STORAGE_KEYS, DEFAULT_SETTINGS, GALLERY_DIMENSIONS } from '../utils/constants.js';

export class DataManager {
  constructor() {
    this.records = [];
    this.currentRecordId = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.importedFiles = new Map();
    
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const recordsStr = localStorage.getItem(STORAGE_KEYS.RECORDS);
      if (recordsStr) {
        this.records = JSON.parse(recordsStr);
      }
      
      const currentIdStr = localStorage.getItem(STORAGE_KEYS.CURRENT_RECORD);
      if (currentIdStr) {
        this.currentRecordId = currentIdStr;
      }
      
      const settingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsStr) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) };
      }
    } catch (e) {
      console.error('加载存储数据失败:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(this.records));
      localStorage.setItem(STORAGE_KEYS.CURRENT_RECORD, this.currentRecordId || '');
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error('保存存储数据失败:', e);
    }
  }

  async importFiles(files, onConflict) {
    const results = {
      success: [],
      skipped: [],
      errors: [],
      conflicts: []
    };

    for (const file of files) {
      try {
        const fileHash = await this.generateFileHash(file);
        const existingImport = this.importedFiles.get(fileHash);
        
        if (existingImport) {
          results.conflicts.push({
            file: file.name,
            hash: fileHash,
            existingRecordId: existingImport.recordId,
            existingRecordName: existingImport.recordName,
            importedAt: existingImport.importedAt,
            reason: '该文件已导入过',
            action: CONFLICT_ACTIONS.SKIP
          });
          continue;
        }

        let data;
        try {
          data = await readFileAsJSON(file);
        } catch (e) {
          results.errors.push({
            file: file.name,
            error: '文件格式错误，不是有效的JSON'
          });
          continue;
        }

        const validation = this.validateData(data);
        if (!validation.valid) {
          results.errors.push({
            file: file.name,
            error: validation.error
          });
          continue;
        }

        results.success.push({
          file: file.name,
          hash: fileHash,
          data: data
        });

      } catch (e) {
        results.errors.push({
          file: file.name,
          error: e.message
        });
      }
    }

    if (results.conflicts.length > 0 && onConflict) {
      const resolvedConflicts = await onConflict(results.conflicts);
      
      for (const conflict of resolvedConflicts) {
        if (conflict.action === CONFLICT_ACTIONS.SKIP) {
          results.skipped.push({
            file: conflict.file,
            reason: '用户选择跳过'
          });
        } else if (conflict.action === CONFLICT_ACTIONS.OVERWRITE) {
          const successItem = results.success.find(s => s.file === conflict.file);
          if (successItem) {
            this.deleteRecord(conflict.existingRecordId);
          }
        }
      }
    }

    for (const item of results.success) {
      const record = this.createRecord(item.data, item.file);
      this.importedFiles.set(item.hash, {
        recordId: record.id,
        recordName: record.name,
        importedAt: Date.now(),
        fileName: item.file
      });
    }

    this.saveToStorage();
    return results;
  }

  async generateFileHash(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const hash = generateHash(content + file.name + file.size + file.lastModified);
        resolve(hash);
      };
      reader.readAsText(file.slice(0, 100000));
    });
  }

  validateData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '数据格式无效' };
    }

    if (!data.artworks || !Array.isArray(data.artworks)) {
      return { valid: false, error: '缺少artworks数组' };
    }

    if (!data.visitors || !Array.isArray(data.visitors)) {
      return { valid: false, error: '缺少visitors数组' };
    }

    if (data.artworks.length === 0) {
      return { valid: false, error: 'artworks数组为空' };
    }

    if (data.visitors.length === 0) {
      return { valid: false, error: 'visitors数组为空' };
    }

    for (let i = 0; i < data.artworks.length; i++) {
      const artwork = data.artworks[i];
      if (!artwork.id) {
        return { valid: false, error: `artworks[${i}]缺少id` };
      }
      if (artwork.x === undefined || artwork.z === undefined) {
        return { valid: false, error: `artworks[${i}]缺少位置坐标` };
      }
    }

    for (let i = 0; i < data.visitors.length; i++) {
      const visitor = data.visitors[i];
      if (!visitor.id) {
        return { valid: false, error: `visitors[${i}]缺少id` };
      }
      if (!visitor.path || !Array.isArray(visitor.path)) {
        return { valid: false, error: `visitors[${i}]缺少path数组` };
      }
      if (visitor.path.length < 2) {
        return { valid: false, error: `visitors[${i}]的path点数不足` };
      }
    }

    return { valid: true };
  }

  createRecord(data, fileName) {
    const processedData = this.processRawData(data);
    
    const record = {
      id: generateId(),
      name: data.name || fileName || `记录 ${this.records.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileName: fileName,
      artworks: processedData.artworks,
      visitors: processedData.visitors,
      batches: processedData.batches,
      congestionPoints: processedData.congestionPoints,
      heatmapData: processedData.heatmapData,
      statistics: processedData.statistics,
      issues: processedData.issues,
      filters: {
        selectedBatches: [],
        selectedArtworks: [],
        selectedFloors: [1, 2],
        timeRange: null
      }
    };

    this.records.push(record);
    this.currentRecordId = record.id;

    return record;
  }

  processRawData(data) {
    const { width, depth, height } = GALLERY_DIMENSIONS;

    const processedVisitors = [];
    const duplicateRecords = [];
    const occlusionRecords = [];
    const biasRecords = [];

    const visitorGroups = groupBy(data.visitors, v => v.deviceId || v.macAddress || v.id);

    for (const [deviceId, visitors] of Object.entries(visitorGroups)) {
      if (visitors.length > 1) {
        for (let i = 1; i < visitors.length; i++) {
          const timeDiff = visitors[i].path[0].timestamp - visitors[i-1].path[visitors[i-1].path.length-1].timestamp;
          if (timeDiff < 3600000) {
            duplicateRecords.push({
              visitorId: visitors[i].id,
              deviceId: deviceId,
              reason: `与前一次记录间隔仅 ${Math.round(timeDiff/60000)} 分钟，判定为同一访客重复进入`,
              originalVisitor: visitors[i-1].id,
              timeDiff: timeDiff
            });
          }
        }
      }

      for (const visitor of visitors) {
        const processedPath = this.processVisitorPath(visitor, data.artworks, occlusionRecords, biasRecords);
        processedVisitors.push({
          ...visitor,
          deviceId: deviceId,
          path: processedPath.points,
          artworkVisits: processedPath.artworkVisits,
          totalDuration: processedPath.totalDuration,
          totalDistance: processedPath.totalDistance,
          batch: visitor.batch || 'default',
          entranceTime: visitor.path[0]?.timestamp,
          exitTime: visitor.path[visitor.path.length-1]?.timestamp,
          isDuplicate: duplicateRecords.some(d => d.visitorId === visitor.id),
          issues: [
            ...duplicateRecords.filter(d => d.visitorId === visitor.id).map(d => ({ type: 'duplicate', ...d })),
            ...occlusionRecords.filter(o => o.visitorId === visitor.id),
            ...biasRecords.filter(b => b.visitorId === visitor.id)
          ]
        });
      }
    }

    const batches = this.groupVisitorsByBatch(processedVisitors);

    const heatmapData = this.generateHeatmapData(processedVisitors);

    const congestionPoints = this.detectCongestionPoints(processedVisitors);

    const statistics = this.calculateStatistics(processedVisitors, data.artworks, {
      duplicates: duplicateRecords.length,
      occlusions: occlusionRecords.length,
      biases: biasRecords.length
    });

    const issues = {
      duplicates: duplicateRecords,
      occlusions: occlusionRecords,
      biases: biasRecords
    };

    return {
      artworks: data.artworks.map(a => ({
        ...a,
        totalVisitors: 0,
        avgStayDuration: 0,
        heatValue: 0
      })),
      visitors: processedVisitors,
      batches: batches,
      heatmapData: heatmapData,
      congestionPoints: congestionPoints,
      statistics: statistics,
      issues: issues
    };
  }

  processVisitorPath(visitor, artworks, occlusionRecords, biasRecords) {
    const points = [];
    const artworkVisits = [];
    let totalDuration = 0;
    let totalDistance = 0;

    const { height } = GALLERY_DIMENSIONS;

    for (let i = 0; i < visitor.path.length; i++) {
      const p = visitor.path[i];
      const floor = p.floor || 1;
      const floorY = (floor - 1) * height;
      
      const point = {
        x: p.x,
        y: floorY + 1.5,
        z: p.z,
        timestamp: p.timestamp,
        floor: floor
      };
      points.push(point);

      if (i > 0) {
        const prevPoint = points[i - 1];
        totalDistance += distance2D(prevPoint, point);
        
        const timeDiff = (p.timestamp - visitor.path[i - 1].timestamp) / 1000;
        totalDuration += timeDiff;

        if (prevPoint.floor !== floor) {
          occlusionRecords.push({
            visitorId: visitor.id,
            reason: `在第 ${prevPoint.floor} 层到第 ${floor} 层切换时，${timeDiff.toFixed(1)}秒内可能存在楼层遮挡`,
            fromFloor: prevPoint.floor,
            toFloor: floor,
            duration: timeDiff
          });
        }
      }
    }

    for (const artwork of artworks) {
      let nearTime = 0;
      let firstNearIndex = -1;
      let lastNearIndex = -1;

      for (let i = 0; i < points.length; i++) {
        const dist = distance2D(points[i], artwork);
        if (dist < (artwork.interactionRadius || 3)) {
          if (firstNearIndex === -1) firstNearIndex = i;
          lastNearIndex = i;
          if (i > 0) {
            nearTime += (points[i].timestamp - points[i - 1].timestamp) / 1000;
          }
        }
      }

      if (nearTime > 5) {
        const entrancePoint = points[0];
        const distToEntrance = distance2D(entrancePoint, { x: 0, z: GALLERY_DIMENSIONS.depth / 2 });
        
        if (firstNearIndex < 3 && distToEntrance > 10) {
          biasRecords.push({
            visitorId: visitor.id,
            artworkId: artwork.id,
            reason: `进入后 ${nearTime.toFixed(1)} 秒内到达 ${artwork.name}，可能受到入口人流引导`,
            timeFromEntrance: nearTime,
            distToEntrance: distToEntrance.toFixed(1)
          });
        }

        artworkVisits.push({
          artworkId: artwork.id,
          artworkName: artwork.name,
          duration: nearTime,
          firstSeen: firstNearIndex,
          lastSeen: lastNearIndex,
          avgDistance: 2
        });
      }
    }

    return {
      points,
      artworkVisits,
      totalDuration,
      totalDistance
    };
  }

  groupVisitorsByBatch(visitors) {
    const batches = groupBy(visitors, v => v.batch);
    return Object.entries(batches).map(([batchId, batchVisitors]) => ({
      id: batchId,
      name: batchId === 'default' ? '默认批次' : `批次 ${batchId}`,
      visitorCount: batchVisitors.length,
      entranceTime: Math.min(...batchVisitors.map(v => v.entranceTime)),
      exitTime: Math.max(...batchVisitors.map(v => v.exitTime)),
      avgDuration: mean(batchVisitors.map(v => v.totalDuration)),
      color: this.getBatchColor(batchId)
    }));
  }

  getBatchColor(batchId) {
    const colors = [0x667eea, 0x764ba2, 0xf093fb, 0x4ade80, 0xfbbf24, 0x60a5fa, 0xf472b6, 0xa78bfa];
    const index = parseInt(batchId) || 0;
    return colors[index % colors.length];
  }

  generateHeatmapData(visitors) {
    const { width, depth } = GALLERY_DIMENSIONS;
    const gridSize = 1;
    const gridWidth = Math.ceil(width / gridSize);
    const gridDepth = Math.ceil(depth / gridSize);
    
    const grid = {};

    for (const visitor of visitors) {
      for (let i = 0; i < visitor.path.length; i++) {
        const p = visitor.path[i];
        const gridX = Math.floor((p.x + width / 2) / gridSize);
        const gridZ = Math.floor((p.z + depth / 2) / gridSize);
        const key = `${gridX},${gridZ},${p.floor}`;
        
        if (!grid[key]) {
          grid[key] = {
            x: p.x,
            z: p.z,
            floor: p.floor,
            value: 0,
            duration: 0
          };
        }
        
        grid[key].value += 1;
        
        if (i > 0) {
          const timeDiff = (p.timestamp - visitor.path[i - 1].timestamp) / 1000;
          grid[key].duration += timeDiff;
        }
      }
    }

    return Object.values(grid);
  }

  detectCongestionPoints(visitors) {
    const { width, depth } = GALLERY_DIMENSIONS;
    const timeWindow = 60000;
    const congestionThreshold = 5;

    const congestionPoints = [];
    const allPoints = [];

    for (const visitor of visitors) {
      for (const p of visitor.path) {
        allPoints.push({ ...p, visitorId: visitor.id });
      }
    }

    allPoints.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < allPoints.length; i++) {
      const windowEnd = allPoints[i].timestamp + timeWindow;
      const windowPoints = [allPoints[i]];
      
      for (let j = i + 1; j < allPoints.length && allPoints[j].timestamp < windowEnd; j++) {
        if (distance2D(allPoints[j], allPoints[i]) < 3) {
          windowPoints.push(allPoints[j]);
        }
      }

      const uniqueVisitors = new Set(windowPoints.map(p => p.visitorId)).size;
      
      if (uniqueVisitors >= congestionThreshold) {
        const existing = congestionPoints.find(cp => 
          distance2D(cp, allPoints[i]) < 5 && 
          Math.abs(cp.timestamp - allPoints[i].timestamp) < timeWindow
        );

        if (!existing) {
          congestionPoints.push({
            id: generateId(),
            x: allPoints[i].x,
            z: allPoints[i].z,
            floor: allPoints[i].floor,
            timestamp: allPoints[i].timestamp,
            visitorCount: uniqueVisitors,
            duration: timeWindow / 1000,
            severity: uniqueVisitors >= 10 ? 'high' : uniqueVisitors >= 7 ? 'medium' : 'low'
          });
        }
      }
    }

    return congestionPoints;
  }

  calculateStatistics(visitors, artworks, issueCounts) {
    const durations = visitors.map(v => v.totalDuration);
    const distances = visitors.map(v => v.totalDistance);
    const artworkVisitCounts = artworks.map(() => 0);
    const artworkStayDurations = artworks.map(() => []);

    for (const visitor of visitors) {
      for (const visit of visitor.artworkVisits) {
        const idx = artworks.findIndex(a => a.id === visit.artworkId);
        if (idx !== -1) {
          artworkVisitCounts[idx]++;
          artworkStayDurations[idx].push(visit.duration);
        }
      }
    }

    const artworkStats = artworks.map((artwork, idx) => ({
      ...artwork,
      totalVisitors: artworkVisitCounts[idx],
      avgStayDuration: mean(artworkStayDurations[idx]),
      medianStayDuration: median(artworkStayDurations[idx]),
      heatValue: artworkVisitCounts[idx] * mean(artworkStayDurations[idx])
    }));

    return {
      totalVisitors: visitors.length,
      uniqueVisitors: new Set(visitors.map(v => v.deviceId)).size,
      avgDuration: mean(durations),
      medianDuration: median(durations),
      avgDistance: mean(distances),
      medianDistance: median(distances),
      totalArtworks: artworks.length,
      avgArtworksPerVisitor: mean(visitors.map(v => v.artworkVisits.length)),
      artworks: artworkStats.sort((a, b) => b.heatValue - a.heatValue),
      issues: issueCounts
    };
  }

  createRecordFromExisting(existingRecordId, newData, fileName) {
    const existingRecord = this.getRecord(existingRecordId);
    if (!existingRecord) return null;

    const processedData = this.processRawData(newData);
    
    const mergedVisitors = [...existingRecord.visitors, ...processedData.visitors];
    const mergedArtworks = uniqBy([...existingRecord.artworks, ...processedData.artworks], 'id');

    const mergedBatches = this.groupVisitorsByBatch(mergedVisitors);
    const mergedHeatmap = this.generateHeatmapData(mergedVisitors);
    const mergedCongestion = this.detectCongestionPoints(mergedVisitors);
    const mergedStats = this.calculateStatistics(mergedVisitors, mergedArtworks, {
      duplicates: processedData.issues.duplicates.length,
      occlusions: processedData.issues.occlusions.length,
      biases: processedData.issues.biases.length
    });

    const mergedRecord = {
      ...existingRecord,
      id: generateId(),
      name: `${existingRecord.name} (追加 ${formatDateTime(Date.now())})`,
      createdAt: existingRecord.createdAt,
      updatedAt: Date.now(),
      parentRecordId: existingRecordId,
      artworks: mergedArtworks,
      visitors: mergedVisitors,
      batches: mergedBatches,
      heatmapData: mergedHeatmap,
      congestionPoints: mergedCongestion,
      statistics: mergedStats,
      issues: {
        duplicates: [...existingRecord.issues.duplicates, ...processedData.issues.duplicates],
        occlusions: [...existingRecord.issues.occlusions, ...processedData.issues.occlusions],
        biases: [...existingRecord.issues.biases, ...processedData.issues.biases]
      },
      filters: {
        ...existingRecord.filters
      }
    };

    this.records.push(mergedRecord);
    this.currentRecordId = mergedRecord.id;
    this.saveToStorage();

    return mergedRecord;
  }

  getCurrentRecord() {
    return this.getRecord(this.currentRecordId);
  }

  getRecord(id) {
    return this.records.find(r => r.id === id);
  }

  getAllRecords() {
    return [...this.records].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  setCurrentRecord(id) {
    this.currentRecordId = id;
    this.saveToStorage();
  }

  updateRecord(id, updates) {
    const record = this.getRecord(id);
    if (!record) return null;

    Object.assign(record, updates, { updatedAt: Date.now() });
    this.saveToStorage();
    return record;
  }

  deleteRecord(id) {
    const index = this.records.findIndex(r => r.id === id);
    if (index !== -1) {
      this.records.splice(index, 1);
      if (this.currentRecordId === id) {
        this.currentRecordId = this.records[0]?.id || null;
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  updateSettings(updates) {
    Object.assign(this.settings, updates);
    this.saveToStorage();
    return this.settings;
  }

  exportRecord(id, format = 'json') {
    const record = this.getRecord(id);
    if (!record) return null;

    const exportData = {
      ...record,
      exportedAt: Date.now(),
      version: '1.0'
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    return exportData;
  }

  getFilteredVisitors(record, filters) {
    if (!record) return [];
    if (!filters) return record.visitors;

    let visitors = [...record.visitors];

    if (filters.selectedBatches && filters.selectedBatches.length > 0) {
      visitors = visitors.filter(v => filters.selectedBatches.includes(v.batch));
    }

    if (filters.selectedFloors && filters.selectedFloors.length > 0) {
      visitors = visitors.filter(v => 
        v.path.some(p => filters.selectedFloors.includes(p.floor))
      );
    }

    if (filters.timeRange) {
      visitors = visitors.filter(v => 
        v.entranceTime >= filters.timeRange.start &&
        v.exitTime <= filters.timeRange.end
      );
    }

    return visitors;
  }

  getFilteredArtworks(record, filters) {
    if (!record) return [];
    if (!filters) return record.artworks;

    let artworks = [...record.artworks];

    if (filters.selectedArtworks && filters.selectedArtworks.length > 0) {
      artworks = artworks.filter(a => filters.selectedArtworks.includes(a.id));
    }

    if (filters.selectedFloors && filters.selectedFloors.length > 0) {
      artworks = artworks.filter(a => filters.selectedFloors.includes(a.floor || 1));
    }

    return artworks;
  }
}
