(function(global) {
  'use strict';

  const { Item, BorrowRecord, HistoryRecord } = global.Models || {};

  // localStorage 键名
  const STORAGE_KEYS = {
    ITEMS: 'inventory_items',
    BORROW_RECORDS: 'inventory_borrow_records',
    HISTORY: 'inventory_history'
  };

  // 默认数据
  const DEFAULT_DATA = {
    items: [],
    borrowRecords: [],
    history: []
  };

  // 存储管理器
  class StorageManager {
    constructor() {
      this.initStorage();
    }

    // 初始化存储
    initStorage() {
      for (const key of Object.values(STORAGE_KEYS)) {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify([]));
        }
      }
    }

    // 读取数据
    read(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        console.error('读取数据失败:', error);
        return [];
      }
    }

    // 写入数据
    write(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('写入数据失败:', error);
        return false;
      }
    }

    // 清空所有数据
    clear() {
      for (const key of Object.values(STORAGE_KEYS)) {
        localStorage.removeItem(key);
      }
      this.initStorage();
    }

    // ===== 物料相关操作 =====

    getItems() {
      const data = this.read(STORAGE_KEYS.ITEMS);
      return data.map(item => new Item(item));
    }

    getItemById(id) {
      const items = this.getItems();
      return items.find(item => item.id === id) || null;
    }

    saveItem(item) {
      const items = this.read(STORAGE_KEYS.ITEMS);
      const existingIndex = items.findIndex(i => i.id === item.id);
      
      if (existingIndex >= 0) {
        items[existingIndex] = item.toJSON();
      } else {
        items.push(item.toJSON());
      }
      
      return this.write(STORAGE_KEYS.ITEMS, items);
    }

    deleteItem(id) {
      const items = this.read(STORAGE_KEYS.ITEMS);
      const filtered = items.filter(item => item.id !== id);
      return this.write(STORAGE_KEYS.ITEMS, filtered);
    }

    // ===== 借还记录相关操作 =====

    getBorrowRecords() {
      const data = this.read(STORAGE_KEYS.BORROW_RECORDS);
      return data.map(record => new BorrowRecord(record));
    }

    getBorrowRecordById(id) {
      const records = this.getBorrowRecords();
      return records.find(record => record.id === id) || null;
    }

    getActiveBorrowRecords() {
      return this.getBorrowRecords().filter(
        record => record.status !== 'returned'
      );
    }

    getBorrowRecordsByItemId(itemId) {
      return this.getBorrowRecords().filter(
        record => record.itemId === itemId
      );
    }

    getActiveBorrowRecordsByItemId(itemId) {
      return this.getActiveBorrowRecords().filter(
        record => record.itemId === itemId
      );
    }

    saveBorrowRecord(record) {
      const records = this.read(STORAGE_KEYS.BORROW_RECORDS);
      const existingIndex = records.findIndex(r => r.id === record.id);
      
      if (existingIndex >= 0) {
        records[existingIndex] = record.toJSON();
      } else {
        records.push(record.toJSON());
      }
      
      return this.write(STORAGE_KEYS.BORROW_RECORDS, records);
    }

    // ===== 历史记录相关操作 =====

    getHistory() {
      const data = this.read(STORAGE_KEYS.HISTORY);
      return data.map(record => new HistoryRecord(record));
    }

    addHistory(historyRecord) {
      const history = this.read(STORAGE_KEYS.HISTORY);
      history.unshift(historyRecord.toJSON());
      
      const MAX_HISTORY = 500;
      if (history.length > MAX_HISTORY) {
        history.splice(MAX_HISTORY);
      }
      
      return this.write(STORAGE_KEYS.HISTORY, history);
    }

    clearHistory() {
      return this.write(STORAGE_KEYS.HISTORY, []);
    }

    // ===== 导入导出 =====

    exportAllData() {
      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        items: this.read(STORAGE_KEYS.ITEMS),
        borrowRecords: this.read(STORAGE_KEYS.BORROW_RECORDS),
        history: this.read(STORAGE_KEYS.HISTORY)
      };
    }

    importAllData(data) {
      try {
        if (data.items) {
          this.write(STORAGE_KEYS.ITEMS, data.items);
        }
        if (data.borrowRecords) {
          this.write(STORAGE_KEYS.BORROW_RECORDS, data.borrowRecords);
        }
        if (data.history) {
          this.write(STORAGE_KEYS.HISTORY, data.history);
        }
        return true;
      } catch (error) {
        console.error('导入数据失败:', error);
        return false;
      }
    }
  }

  // 创建单例
  const Storage = new StorageManager();

  // 导出到全局
  global.Storage = Storage;
  global.StorageManager = StorageManager;
  global.STORAGE_KEYS = STORAGE_KEYS;

})(window);
