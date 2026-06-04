const fs = require('fs');
const path = require('path');

class DataStore {
  constructor(dataDir = './data') {
    this.dataDir = path.join(__dirname, '..', '..', dataDir);
    this.ensureDataDir();
    this.collections = {
      sensors: [],
      photos: [],
      notes: [],
      heatLoads: []
    };
    this.loadAll();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getFilePath(collectionName) {
    return path.join(this.dataDir, `${collectionName}.json`);
  }

  load(collectionName) {
    const filePath = this.getFilePath(collectionName);
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        this.collections[collectionName] = JSON.parse(data);
      } catch (e) {
        this.collections[collectionName] = [];
      }
    } else {
      this.collections[collectionName] = [];
    }
    return this.collections[collectionName];
  }

  loadAll() {
    Object.keys(this.collections).forEach(name => this.load(name));
  }

  save(collectionName) {
    const filePath = this.getFilePath(collectionName);
    fs.writeFileSync(filePath, JSON.stringify(this.collections[collectionName], null, 2), 'utf8');
  }

  saveAll() {
    Object.keys(this.collections).forEach(name => this.save(name));
  }

  findAll(collectionName) {
    return this.collections[collectionName];
  }

  findById(collectionName, id) {
    return this.collections[collectionName].find(item => item.id === id);
  }

  findOne(collectionName, predicate) {
    return this.collections[collectionName].find(predicate);
  }

  find(collectionName, predicate) {
    return this.collections[collectionName].filter(predicate);
  }

  create(collectionName, item) {
    this.collections[collectionName].push(item);
    this.save(collectionName);
    return item;
  }

  update(collectionName, id, updates) {
    const index = this.collections[collectionName].findIndex(item => item.id === id);
    if (index !== -1) {
      this.collections[collectionName][index] = {
        ...this.collections[collectionName][index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save(collectionName);
      return this.collections[collectionName][index];
    }
    return null;
  }

  delete(collectionName, id) {
    const index = this.collections[collectionName].findIndex(item => item.id === id);
    if (index !== -1) {
      const deleted = this.collections[collectionName].splice(index, 1);
      this.save(collectionName);
      return deleted[0];
    }
    return null;
  }

  clear(collectionName) {
    this.collections[collectionName] = [];
    this.save(collectionName);
  }

  clearAll() {
    Object.keys(this.collections).forEach(name => this.clear(name));
  }
}

const store = new DataStore();
module.exports = store;
