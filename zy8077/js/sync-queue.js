class SyncQueue {
  constructor(dbName = 'syncQueueDB') {
    this.dbName = dbName;
    this.db = null;
    this.processing = false;
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
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async add(item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const request = store.add(item);
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['queue'], 'readonly');
      const store = transaction.objectStore('queue');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['queue'], 'readonly');
      const store = transaction.objectStore('queue');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async update(item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const request = store.put(item);
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async remove(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
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
      const transaction = this.db.transaction(['queue'], 'readwrite');
      const store = transaction.objectStore('queue');
      const request = store.clear();
      
      request.onsuccess = () => {
        this.notifyListeners();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async process(apiService, conflictResolver, logger) {
    if (this.processing) return;
    this.processing = true;

    try {
      const items = await this.getAll();
      const failedItems = [];

      for (const item of items) {
        if (failedItems.length > 0) {
          failedItems.push(item);
          continue;
        }

        try {
          await this.processItem(item, apiService, conflictResolver, logger);
          await this.remove(item.id);
          logger.log(`处理成功: ${item.action} - ${item.data.id}`, 'success');
        } catch (error) {
          item.retryCount++;
          item.status = 'failed';
          item.error = error.message;
          await this.update(item);
          failedItems.push(item);
          logger.log(`处理失败: ${item.action} - ${item.data.id}: ${error.message}`, 'error');
        }
      }

      for (const failedItem of failedItems.slice(1)) {
        failedItem.status = 'pending';
        await this.update(failedItem);
      }

    } finally {
      this.processing = false;
    }
  }

  async processItem(item, apiService, conflictResolver, logger) {
    switch (item.action) {
      case 'create':
        return await apiService.createInspection(item.data);
      case 'update':
        try {
          const serverData = await apiService.getInspection(item.data.id);
          if (serverData && serverData.version > item.data.version) {
            const resolved = await conflictResolver.resolve(item.data, serverData);
            return await apiService.updateInspection(resolved);
          }
          return await apiService.updateInspection(item.data);
        } catch (error) {
          if (error.status === 404) {
            return await apiService.createInspection(item.data);
          }
          throw error;
        }
      case 'delete':
        return await apiService.deleteInspection(item.data.id);
      default:
        throw new Error(`未知操作: ${item.action}`);
    }
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
  module.exports = { SyncQueue };
}
