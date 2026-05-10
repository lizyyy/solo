const fs = require('fs');
const path = require('path');
const dataStore = require('../utils/dataStore');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  
  exportAnomalies(options = {}) {
    const { outputPath, type } = options;
    const dataDir = dataStore.getDataDir();
    
    let anomalies = dataStore.getAnomalies();
    
    if (type) {
      anomalies = anomalies.filter(a => a.type === type);
    }
    
    const exportData = {
      exportId: uuidv4(),
      exportTime: new Date().toISOString(),
      totalCount: anomalies.length,
      type: type || 'all',
      anomalies: anomalies
    };
    
    let filePath;
    if (outputPath) {
      filePath = path.resolve(outputPath);
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filePath = path.join(dataDir, `anomalies_${timestamp}.json`);
    }
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    return {
      filePath,
      count: anomalies.length,
      anomalies
    };
  }
  
  exportSettlementReport(batchNo, outputPath = null) {
    const SettlementService = require('./SettlementService');
    const settlementService = new SettlementService();
    
    const report = settlementService.generateSettlementReport(batchNo);
    const dataDir = dataStore.getDataDir();
    
    let filePath;
    if (outputPath) {
      filePath = path.resolve(outputPath);
    } else {
      filePath = path.join(dataDir, `settlement_${batchNo}.json`);
    }
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    
    return {
      filePath,
      report
    };
  }
  
  exportBatchSummary(options = {}) {
    const BatchService = require('./BatchService');
    const batchService = new BatchService();
    
    const dataDir = dataStore.getDataDir();
    const batches = batchService.listBatches(options.status);
    
    const summary = batches.map(batch => ({
      batchNo: batch.batchNo,
      grainType: batch.grainType,
      status: batch.status,
      inWeight: batch.inWeight,
      inMoisture: batch.inMoisture,
      outWeight: batch.outWeight || null,
      outMoisture: batch.outMoisture || null,
      version: batch.version,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    }));
    
    const exportData = {
      exportId: uuidv4(),
      exportTime: new Date().toISOString(),
      totalCount: batches.length,
      status: options.status || 'all',
      batches: summary
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dataDir, `batch_summary_${timestamp}.json`);
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    return {
      filePath,
      count: batches.length,
      batches: summary
    };
  }
  
  getAnomalyTypes() {
    const anomalies = dataStore.getAnomalies();
    const types = new Set(anomalies.map(a => a.type));
    return Array.from(types);
  }
  
  getAnomalyStats() {
    const anomalies = dataStore.getAnomalies();
    
    const stats = {
      total: anomalies.length,
      byType: {},
      byStatus: {},
      byBatch: {}
    };
    
    anomalies.forEach(a => {
      stats.byType[a.type] = (stats.byType[a.type] || 0) + 1;
      stats.byStatus[a.status] = (stats.byStatus[a.status] || 0) + 1;
      stats.byBatch[a.batchNo] = (stats.byBatch[a.batchNo] || 0) + 1;
    });
    
    return stats;
  }
}

module.exports = ExportService;
