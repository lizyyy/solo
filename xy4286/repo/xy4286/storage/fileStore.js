const fs = require('fs');
const path = require('path');
const config = require('../config');

class FileStore {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.filePath = path.join(
      config.storage.baseDir,
      config.storage.collections[collectionName]
    );
    this._ensureDirectory();
  }

  _ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _readFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error(`Error reading file ${this.filePath}:`, error);
    }
    return [];
  }

  _writeFile(data) {
    try {
      this._ensureDirectory();
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Error writing file ${this.filePath}:`, error);
      return false;
    }
  }

  getAll() {
    return this._readFile();
  }

  getById(id) {
    const items = this._readFile();
    return items.find(item => item.id === id) || null;
  }

  create(item) {
    const items = this._readFile();
    items.push(item);
    this._writeFile(items);
    return item;
  }

  update(id, updates) {
    const items = this._readFile();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      return null;
    }
    items[index] = { ...items[index], ...updates };
    this._writeFile(items);
    return items[index];
  }

  delete(id) {
    const items = this._readFile();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }
    items.splice(index, 1);
    this._writeFile(items);
    return true;
  }

  findByField(field, value) {
    const items = this._readFile();
    return items.filter(item => item[field] === value);
  }

  findByFields(filters) {
    const items = this._readFile();
    return items.filter(item => {
      return Object.keys(filters).every(key => item[key] === filters[key]);
    });
  }

  findOneByField(field, value) {
    const items = this._readFile();
    return items.find(item => item[field] === value) || null;
  }

  clear() {
    this._writeFile([]);
  }
}

module.exports = FileStore;
