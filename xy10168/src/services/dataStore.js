const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON, ensureDir, appendJSONLine } = require('../utils/fileUtils');

class DataStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.inventoryFile = path.join(dataDir, 'inventory.json');
    this.temperatureFile = path.join(dataDir, 'temperature.json');
    this.exceptionsFile = path.join(dataDir, 'exceptions.json');
    this.importHistoryFile = path.join(dataDir, 'import-history.jsonl');
    this.ensureDataFiles();
  }
  
  ensureDataFiles() {
    ensureDir(this.dataDir);
    if (!fs.existsSync(this.inventoryFile)) {
      writeJSON(this.inventoryFile, { lots: [], crossZoneMovements: [] });
    }
    if (!fs.existsSync(this.temperatureFile)) {
      writeJSON(this.temperatureFile, { records: [] });
    }
    if (!fs.existsSync(this.exceptionsFile)) {
      writeJSON(this.exceptionsFile, { records: [] });
    }
  }
  
  getInventory() {
    return readJSON(this.inventoryFile) || { lots: [], crossZoneMovements: [] };
  }
  
  saveInventory(data) {
    writeJSON(this.inventoryFile, data);
  }
  
  getTemperature() {
    return readJSON(this.temperatureFile) || { records: [] };
  }
  
  saveTemperature(data) {
    writeJSON(this.temperatureFile, data);
  }
  
  getExceptions() {
    return readJSON(this.exceptionsFile) || { records: [] };
  }
  
  saveExceptions(data) {
    writeJSON(this.exceptionsFile, data);
  }
  
  recordImport(importInfo) {
    const record = {
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
      ...importInfo
    };
    appendJSONLine(this.importHistoryFile, record);
    return record;
  }
  
  getImportHistory() {
    const lines = fs.readFileSync(this.importHistoryFile, 'utf8').split('\n').filter(Boolean);
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }
  
  findLotByNumber(lotNumber) {
    const inventory = this.getInventory();
    return inventory.lots.find(lot => lot.lotNumber === lotNumber);
  }
  
  upsertLot(lotData, source) {
    const inventory = this.getInventory();
    const existingIndex = inventory.lots.findIndex(lot => lot.lotNumber === lotData.lotNumber);
    
    if (existingIndex >= 0) {
      const existing = inventory.lots[existingIndex];
      const merged = {
        ...existing,
        ...lotData,
        id: existing.id,
        updatedAt: dayjs().toISOString(),
        updateSource: source,
        version: (existing.version || 1) + 1,
        history: [
          ...(existing.history || []),
          {
            timestamp: existing.updatedAt,
            data: { ...existing }
          }
        ]
      };
      inventory.lots[existingIndex] = merged;
      this.saveInventory(inventory);
      return { lot: merged, isNew: false };
    } else {
      const newLot = {
        id: uuidv4(),
        ...lotData,
        createdAt: dayjs().toISOString(),
        updatedAt: dayjs().toISOString(),
        updateSource: source,
        version: 1,
        history: []
      };
      inventory.lots.push(newLot);
      this.saveInventory(inventory);
      return { lot: newLot, isNew: true };
    }
  }
  
  addCrossZoneMovement(movement) {
    const inventory = this.getInventory();
    const record = {
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
      ...movement
    };
    inventory.crossZoneMovements.push(record);
    this.saveInventory(inventory);
    return record;
  }
  
  addTemperatureRecord(record) {
    const temperature = this.getTemperature();
    const newRecord = {
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
      ...record
    };
    temperature.records.push(newRecord);
    this.saveTemperature(temperature);
    return newRecord;
  }
  
  addException(exception) {
    const exceptions = this.getExceptions();
    const record = {
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
      status: 'open',
      ...exception
    };
    exceptions.records.push(record);
    this.saveExceptions(exceptions);
    return record;
  }
  
  getLotTemperatureRecords(lotNumber) {
    const temperature = this.getTemperature();
    return temperature.records.filter(r => r.lotNumber === lotNumber);
  }
  
  getOpenExceptions() {
    const exceptions = this.getExceptions();
    return exceptions.records.filter(e => e.status === 'open');
  }
  
  resetExceptions() {
    writeJSON(this.exceptionsFile, { records: [] });
  }
  
  resetAllData() {
    writeJSON(this.inventoryFile, { lots: [], crossZoneMovements: [] });
    writeJSON(this.temperatureFile, { records: [] });
    writeJSON(this.exceptionsFile, { records: [] });
    if (fs.existsSync(this.importHistoryFile)) {
      fs.unlinkSync(this.importHistoryFile);
    }
  }
}

module.exports = DataStore;
