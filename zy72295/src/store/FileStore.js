const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const EXPORT_IMG_DIR = path.join(process.cwd(), 'public', 'exports');

const STORE_FILES = {
  cadLayers: 'cadLayers.json',
  measurementRecords: 'measurementRecords.json',
  supplementaryRoutes: 'supplementaryRoutes.json',
  temperatureZones: 'temperatureZones.json',
  history: 'history.json',
  exports: 'exports.json',
  meta: 'meta.json'
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class FileStore {
  constructor() {
    ensureDir(DATA_DIR);
    ensureDir(EXPORT_IMG_DIR);
    this._cache = {};
    this._loadAll();
  }

  _loadAll() {
    for (const [key, filename] of Object.entries(STORE_FILES)) {
      const filePath = path.join(DATA_DIR, filename);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          this._cache[key] = JSON.parse(raw);
        } catch (e) {
          this._cache[key] = this._defaultForKey(key);
        }
      } else {
        this._cache[key] = this._defaultForKey(key);
      }
    }
  }

  _defaultForKey(key) {
    switch (key) {
      case 'meta':
        return { globalSeq: 0, importedFingerprints: [] };
      default:
        return [];
    }
  }

  _persist(key) {
    const filePath = path.join(DATA_DIR, STORE_FILES[key]);
    fs.writeFileSync(filePath, JSON.stringify(this._cache[key], null, 2), 'utf-8');
  }

  getAll(key) {
    return [...this._cache[key]];
  }

  getById(key, id) {
    return this._cache[key].find(item => item.id === id) || null;
  }

  findOne(key, predicate) {
    return this._cache[key].find(predicate) || null;
  }

  findMany(key, predicate) {
    return this._cache[key].filter(predicate);
  }

  add(key, item) {
    this._cache[key].push(item);
    this._persist(key);
    return item;
  }

  update(key, id, updates) {
    const idx = this._cache[key].findIndex(item => item.id === id);
    if (idx === -1) return null;
    this._cache[key][idx] = { ...this._cache[key][idx], ...updates };
    this._persist(key);
    return this._cache[key][idx];
  }

  remove(key, id) {
    const idx = this._cache[key].findIndex(item => item.id === id);
    if (idx === -1) return false;
    this._cache[key].splice(idx, 1);
    this._persist(key);
    return true;
  }

  clear(key) {
    this._cache[key] = this._defaultForKey(key);
    this._persist(key);
  }

  clearAll() {
    for (const key of Object.keys(STORE_FILES)) {
      this._cache[key] = this._defaultForKey(key);
      this._persist(key);
    }
  }

  getMeta() {
    return { ...this._cache.meta };
  }

  getGlobalSeq() {
    return this._cache.meta.globalSeq || 0;
  }

  incrementGlobalSeq() {
    this._cache.meta.globalSeq = (this._cache.meta.globalSeq || 0) + 1;
    this._persist('meta');
    return this._cache.meta.globalSeq;
  }

  getImportedFingerprints() {
    return [...(this._cache.meta.importedFingerprints || [])];
  }

  addImportedFingerprint(fp) {
    if (!this._cache.meta.importedFingerprints) {
      this._cache.meta.importedFingerprints = [];
    }
    if (!this._cache.meta.importedFingerprints.includes(fp)) {
      this._cache.meta.importedFingerprints.push(fp);
      this._persist('meta');
    }
  }

  hasImportedFingerprint(fp) {
    return (this._cache.meta.importedFingerprints || []).includes(fp);
  }

  reload() {
    this._loadAll();
  }
}

const store = new FileStore();

module.exports = { FileStore, store, DATA_DIR, EXPORT_IMG_DIR };
