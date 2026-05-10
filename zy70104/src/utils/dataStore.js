const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const FILES = {
  batches: path.join(DATA_DIR, 'batches.json'),
  reviews: path.join(DATA_DIR, 'reviews.json'),
  settlements: path.join(DATA_DIR, 'settlements.json'),
  anomalies: path.join(DATA_DIR, 'anomalies.json'),
  conflicts: path.join(DATA_DIR, 'conflicts.json'),
  config: path.join(DATA_DIR, 'config.json')
};

const DEFAULT_CONFIG = {
  settlement: {
    basePricePerKg: 0.15,
    moistureReductionBonus: 0.02,
    fuelCostPerUnit: 1.2,
    powerCostPerKWh: 0.8,
    energyShareRatio: 0.6
  },
  validation: {
    maxInMoisture: 35,
    minOutMoisture: 10,
    maxMoistureLoss: 20,
    maxDryingTime: 1440,
    weightLossTolerance: 0.2
  },
  retry: {
    maxAttempts: 3,
    backoffMs: 1000,
    timeoutMs: 5000
  }
};

class DataStore {
  constructor() {
    this.memory = {
      batches: [],
      reviews: [],
      settlements: [],
      anomalies: [],
      conflicts: [],
      config: DEFAULT_CONFIG
    };
    this.loaded = false;
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    Object.values(FILES).forEach(file => {
      if (!fs.existsSync(file)) {
        const data = file === FILES.config ? DEFAULT_CONFIG : [];
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
      }
    });
    
    this.loadAll();
    console.log(`数据目录已初始化: ${DATA_DIR}`);
  }

  loadAll() {
    this._loadFile('batches');
    this._loadFile('reviews');
    this._loadFile('settlements');
    this._loadFile('anomalies');
    this._loadFile('conflicts');
    this._loadFile('config');
    this.loaded = true;
  }

  _loadFile(key) {
    const file = FILES[key];
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        this.memory[key] = JSON.parse(content);
      } catch (e) {
        this.memory[key] = key === 'config' ? DEFAULT_CONFIG : [];
      }
    }
  }

  _saveFile(key) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      FILES[key],
      JSON.stringify(this.memory[key], null, 2),
      'utf-8'
    );
  }

  getBatches() {
    if (!this.loaded) this.loadAll();
    return this.memory.batches;
  }

  getBatchById(id) {
    return this.getBatches().find(b => b.id === id);
  }

  getBatchByNo(batchNo) {
    return this.getBatches().find(b => b.batchNo === batchNo);
  }

  saveBatch(batch) {
    const existingIndex = this.memory.batches.findIndex(b => b.id === batch.id);
    if (existingIndex >= 0) {
      this.memory.batches[existingIndex] = batch;
    } else {
      this.memory.batches.push(batch);
    }
    this._saveFile('batches');
    return batch;
  }

  deleteBatch(id) {
    this.memory.batches = this.memory.batches.filter(b => b.id !== id);
    this._saveFile('batches');
  }

  getReviews() {
    if (!this.loaded) this.loadAll();
    return this.memory.reviews;
  }

  getReviewById(id) {
    return this.getReviews().find(r => r.id === id);
  }

  getReviewsByBatch(batchNo) {
    return this.getReviews().filter(r => r.batchNo === batchNo);
  }

  saveReview(review) {
    const existingIndex = this.memory.reviews.findIndex(r => r.id === review.id);
    if (existingIndex >= 0) {
      this.memory.reviews[existingIndex] = review;
    } else {
      this.memory.reviews.push(review);
    }
    this._saveFile('reviews');
    return review;
  }

  getSettlements() {
    if (!this.loaded) this.loadAll();
    return this.memory.settlements;
  }

  getSettlementById(id) {
    return this.getSettlements().find(s => s.id === id);
  }

  getSettlementByBatch(batchNo) {
    return this.getSettlements().find(s => s.batchNo === batchNo && s.status !== 'rollback');
  }

  saveSettlement(settlement) {
    const existingIndex = this.memory.settlements.findIndex(s => s.id === settlement.id);
    if (existingIndex >= 0) {
      this.memory.settlements[existingIndex] = settlement;
    } else {
      this.memory.settlements.push(settlement);
    }
    this._saveFile('settlements');
    return settlement;
  }

  getAnomalies() {
    if (!this.loaded) this.loadAll();
    return this.memory.anomalies;
  }

  saveAnomaly(anomaly) {
    this.memory.anomalies.push(anomaly);
    this._saveFile('anomalies');
    return anomaly;
  }

  getConflicts() {
    if (!this.loaded) this.loadAll();
    return this.memory.conflicts;
  }

  saveConflict(conflict) {
    this.memory.conflicts.push(conflict);
    this._saveFile('conflicts');
    return conflict;
  }

  getConfig() {
    if (!this.loaded) this.loadAll();
    return this.memory.config;
  }

  updateConfig(updates) {
    this.memory.config = { ...this.memory.config, ...updates };
    this._saveFile('config');
    return this.memory.config;
  }

  getDataDir() {
    return DATA_DIR;
  }
}

module.exports = new DataStore();
