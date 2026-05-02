class LocalStorage {
  constructor(dbName = 'inspectionDB') {
    this.dbName = dbName;
    this.db = null;
    this.listeners = [];
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('inspections')) {
          const store = db.createObjectStore('inspections', { keyPath: 'id' });
          store.createIndex('lastModified', 'lastModified', { unique: false });
        }
      };
    });
  }

  async save(inspection) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['inspections'], 'readwrite');
      const store = transaction.objectStore('inspections');
      const request = store.put(inspection);
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['inspections'], 'readonly');
      const store = transaction.objectStore('inspections');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['inspections'], 'readonly');
      const store = transaction.objectStore('inspections');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result.sort((a, b) => b.lastModified - a.lastModified);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['inspections'], 'readwrite');
      const store = transaction.objectStore('inspections');
      const request = store.delete(id);
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['inspections'], 'readwrite');
      const store = transaction.objectStore('inspections');
      const request = store.clear();
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocalStorage };
}
