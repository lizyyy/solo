const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const SIGNS_FILE = path.join(DATA_DIR, 'signs.json');
const INSPECTIONS_FILE = path.join(DATA_DIR, 'inspections.json');
const RISK_RESULTS_FILE = path.join(DATA_DIR, 'risk-results.json');
const IMPORT_LOG_FILE = path.join(DATA_DIR, 'import-log.json');

class BillBoardManager {
  constructor() {
    this.initialized = false;
  }

  async init() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    await this._ensureFile(SIGNS_FILE, []);
    await this._ensureFile(INSPECTIONS_FILE, []);
    await this._ensureFile(RISK_RESULTS_FILE, []);
    await this._ensureFile(IMPORT_LOG_FILE, []);
    
    this.initialized = true;
  }

  async _ensureFile(filePath, defaultContent) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  async _readFile(filePath) {
    await this.init();
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async _writeFile(filePath, data) {
    await this.init();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async getAllSigns() {
    return await this._readFile(SIGNS_FILE);
  }

  async getSignById(id) {
    const signs = await this.getAllSigns();
    return signs.find(s => s.id === id);
  }

  async saveSign(sign) {
    const signs = await this.getAllSigns();
    const existingIndex = signs.findIndex(s => s.id === sign.id);
    
    if (existingIndex >= 0) {
      signs[existingIndex] = { ...signs[existingIndex], ...sign, updatedAt: new Date().toISOString() };
    } else {
      signs.push({ ...sign, createdAt: new Date().toISOString() });
    }
    
    await this._writeFile(SIGNS_FILE, signs);
    return sign;
  }

  async saveSigns(signs) {
    for (const sign of signs) {
      await this.saveSign(sign);
    }
  }

  async getAllInspections() {
    return await this._readFile(INSPECTIONS_FILE);
  }

  async getInspectionsBySignId(signId) {
    const inspections = await this.getAllInspections();
    return inspections.filter(i => i.signId === signId);
  }

  async getLatestInspection(signId) {
    const inspections = await this.getInspectionsBySignId(signId);
    if (inspections.length === 0) return null;
    
    return inspections.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  }

  async saveInspection(inspection) {
    const inspections = await this.getAllInspections();
    
    const conflictCheck = inspections.find(i => 
      i.signId === inspection.signId && 
      i.date === inspection.date
    );
    
    if (conflictCheck) {
      return { 
        status: 'conflict', 
        message: `广告牌 ${inspection.signId} 在 ${inspection.date} 已有巡检记录`,
        existing: conflictCheck,
        new: inspection
      };
    }
    
    inspections.push({ ...inspection, createdAt: new Date().toISOString() });
    await this._writeFile(INSPECTIONS_FILE, inspections);
    return { status: 'success', data: inspection };
  }

  async saveInspections(inspections) {
    const results = {
      success: [],
      conflicts: [],
      missingSigns: [],
      duplicates: []
    };

    const existingInspections = await this.getAllInspections();
    const existingMap = new Map(
      existingInspections.map(i => [`${i.signId}-${i.date}`, i])
    );
    
    const currentBatchMap = new Map();
    
    const signs = await this.getAllSigns();
    const signIds = new Set(signs.map(s => s.id));

    for (const inspection of inspections) {
      if (!signIds.has(inspection.signId)) {
        results.missingSigns.push({
          inspection,
          reason: `广告牌 ID ${inspection.signId} 不存在`
        });
        continue;
      }

      const key = `${inspection.signId}-${inspection.date}`;
      
      if (existingMap.has(key)) {
        const existing = existingMap.get(key);
        
        const isDuplicate = JSON.stringify(inspection) === JSON.stringify({
          signId: existing.signId,
          date: existing.date,
          inspector: existing.inspector,
          rustLevel: existing.rustLevel,
          lightingStatus: existing.lightingStatus,
          notes: existing.notes
        });

        if (isDuplicate) {
          results.duplicates.push({
            inspection,
            reason: '与现有记录完全重复'
          });
        } else {
          results.conflicts.push({
            inspection,
            existing,
            reason: `同一广告牌在同一天有不同巡检数据`
          });
        }
        continue;
      }
      
      if (currentBatchMap.has(key)) {
        const previousInBatch = currentBatchMap.get(key);
        
        const isDuplicate = JSON.stringify(inspection) === JSON.stringify(previousInBatch);
        
        if (isDuplicate) {
          results.duplicates.push({
            inspection,
            reason: '与当前批次中记录重复'
          });
        } else {
          results.conflicts.push({
            inspection,
            existing: previousInBatch,
            reason: `同一广告牌在当前批次中有不同巡检数据`
          });
        }
        continue;
      }
      
      currentBatchMap.set(key, inspection);
      const saveResult = await this.saveInspection(inspection);
      if (saveResult.status === 'success') {
        results.success.push(inspection);
      } else {
        results.conflicts.push(saveResult);
      }
    }

    return results;
  }

  async getRiskResults() {
    return await this._readFile(RISK_RESULTS_FILE);
  }

  async saveRiskResults(results) {
    const timestamped = results.map(r => ({
      ...r,
      assessedAt: new Date().toISOString()
    }));
    await this._writeFile(RISK_RESULTS_FILE, timestamped);
  }

  async getImportLog() {
    return await this._readFile(IMPORT_LOG_FILE);
  }

  async addImportLog(entry) {
    const logs = await this.getImportLog();
    logs.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
    await this._writeFile(IMPORT_LOG_FILE, logs);
  }

  async clearAll() {
    await this._writeFile(SIGNS_FILE, []);
    await this._writeFile(INSPECTIONS_FILE, []);
    await this._writeFile(RISK_RESULTS_FILE, []);
    await this._writeFile(IMPORT_LOG_FILE, []);
  }
}

module.exports = { BillBoardManager };
