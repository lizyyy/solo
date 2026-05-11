const fs = require('fs');
const path = require('path');
const Garment = require('../models/garment');
const BorrowRecord = require('../models/borrowRecord');
const ImportHistory = require('../models/importHistory');

class DataStore {
  constructor(dataDir = null) {
    this.dataDir = dataDir || path.join(process.cwd(), '.garment-data');
    this.garmentsFile = path.join(this.dataDir, 'garments.json');
    this.recordsFile = path.join(this.dataDir, 'borrowRecords.json');
    this.importsFile = path.join(this.dataDir, 'importHistory.json');
    this._initialized = false;
    this._garments = [];
    this._records = [];
    this._imports = [];
  }

  initialize() {
    if (this._initialized) return;
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this._loadGarments();
    this._loadRecords();
    this._loadImports();
    this._initialized = true;
  }

  _loadGarments() {
    if (fs.existsSync(this.garmentsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.garmentsFile, 'utf8'));
        this._garments = data.map(d => new Garment(d));
      } catch (e) {
        this._garments = [];
      }
    } else {
      this._garments = [];
    }
  }

  _loadRecords() {
    if (fs.existsSync(this.recordsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.recordsFile, 'utf8'));
        this._records = data.map(d => new BorrowRecord(d));
      } catch (e) {
        this._records = [];
      }
    } else {
      this._records = [];
    }
  }

  _loadImports() {
    if (fs.existsSync(this.importsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.importsFile, 'utf8'));
        this._imports = data.map(d => new ImportHistory(d));
      } catch (e) {
        this._imports = [];
      }
    } else {
      this._imports = [];
    }
  }

  _saveGarments() {
    fs.writeFileSync(this.garmentsFile, JSON.stringify(this._garments.map(g => g.toJSON()), null, 2));
  }

  _saveRecords() {
    fs.writeFileSync(this.recordsFile, JSON.stringify(this._records.map(r => r.toJSON()), null, 2));
  }

  _saveImports() {
    fs.writeFileSync(this.importsFile, JSON.stringify(this._imports.map(i => i.toJSON()), null, 2));
  }

  getGarments() {
    return this._garments;
  }

  getGarmentById(id) {
    return this._garments.find(g => g.id === id);
  }

  getGarmentByKey(styleNo, size, color) {
    return this._garments.find(g => 
      g.styleNo === styleNo && g.size === size && g.color === color
    );
  }

  addGarment(garment) {
    const existing = this.getGarmentByKey(garment.styleNo, garment.size, garment.color);
    if (existing) {
      return existing;
    }
    const newGarment = new Garment(garment);
    this._garments.push(newGarment);
    this._saveGarments();
    return newGarment;
  }

  updateGarment(id, updates) {
    const index = this._garments.findIndex(g => g.id === id);
    if (index === -1) return null;
    
    this._garments[index] = new Garment({
      ...this._garments[index].toJSON(),
      ...updates,
      updatedAt: new Date().toISOString()
    });
    this._saveGarments();
    return this._garments[index];
  }

  getRecords() {
    return this._records;
  }

  getRecordById(id) {
    return this._records.find(r => r.id === id);
  }

  getRecordsByGarmentId(garmentId) {
    return this._records.filter(r => r.garmentId === garmentId);
  }

  getRecordsByGarmentKey(styleNo, size, color) {
    return this._records.filter(r => 
      r.garmentInfo.styleNo === styleNo && 
      r.garmentInfo.size === size && 
      r.garmentInfo.color === color
    );
  }

  addRecord(record) {
    const newRecord = new BorrowRecord(record);
    this._records.push(newRecord);
    this._saveRecords();
    return newRecord;
  }

  updateRecord(id, updates) {
    const index = this._records.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this._records[index] = new BorrowRecord({
      ...this._records[index].toJSON(),
      ...updates,
      updatedAt: new Date().toISOString()
    });
    this._saveRecords();
    return this._records[index];
  }

  getImportHistory() {
    return this._imports;
  }

  getImportByBatchId(batchId) {
    return this._imports.find(i => i.batchId === batchId);
  }

  getImportByFileHash(fileHash) {
    return this._imports.find(i => i.fileHash === fileHash);
  }

  addImportHistory(importData) {
    const newImport = new ImportHistory(importData);
    this._imports.push(newImport);
    this._saveImports();
    return newImport;
  }

  updateImportHistory(id, updates) {
    const index = this._imports.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    this._imports[index] = new ImportHistory({
      ...this._imports[index].toJSON(),
      ...updates
    });
    this._saveImports();
    return this._imports[index];
  }

  getAllImportedKeys() {
    const keys = new Set();
    for (const imp of this._imports) {
      for (const key of imp.importedKeys || []) {
        keys.add(key);
      }
    }
    return keys;
  }
}

module.exports = new DataStore();
module.exports.DataStore = DataStore;
