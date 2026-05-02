(function(global) {
  'use strict';

  const { Item, BorrowRecord, HistoryRecord, HISTORY_TYPES, formatDate, getHistoryIcon } = global.Models || {};
  const Storage = global.Storage;
  const Validation = global.Validation;

  // 事件类型
  const EVENTS = {
    ITEMS_UPDATED: 'items:updated',
    BORROW_RECORDS_UPDATED: 'borrowRecords:updated',
    HISTORY_UPDATED: 'history:updated',
    STATE_CHANGED: 'state:changed'
  };

  // 状态管理器
  class StateManager {
    constructor() {
      this.storage = Storage;
      this.validation = Validation;
      this.listeners = new Map();
      this._items = [];
      this._borrowRecords = [];
      this._history = [];
      
      this.loadFromStorage();
    }

    // 从存储加载数据
    loadFromStorage() {
      this._items = this.storage.getItems();
      this._borrowRecords = this.storage.getBorrowRecords();
      this._history = this.storage.getHistory();
      this.emit(EVENTS.STATE_CHANGED);
    }

    // 获取数据的 getter
    get items() {
      return [...this._items];
    }

    get borrowRecords() {
      return [...this._borrowRecords];
    }

    get history() {
      return [...this._history];
    }

    get activeBorrowRecords() {
      return this._borrowRecords.filter(r => r.status !== 'returned');
    }

    get overdueRecords() {
      return this.activeBorrowRecords.filter(r => r.isOverdue);
    }

    get projects() {
      const projects = new Set();
      this.activeBorrowRecords.forEach(r => {
        if (r.project) projects.add(r.project);
      });
      return Array.from(projects).sort();
    }

    // ===== 事件系统 =====

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
      
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (!this.listeners.has(event)) return;
      
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }

    emit(event, data = null) {
      if (!this.listeners.has(event)) return;
      
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件处理器错误 [${event}]:`, error);
        }
      });
    }

    // ===== 物料操作 =====

    addItem(itemData) {
      const validation = this.validation.validateNewItem(itemData);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const item = new Item({
        name: itemData.name.trim(),
        category: itemData.category || '',
        totalQuantity: parseInt(itemData.totalQuantity) || 0,
        description: itemData.description || ''
      });

      this.storage.saveItem(item);
      this._items = this.storage.getItems();

      this.addHistory({
        type: HISTORY_TYPES.ITEM_CREATE,
        title: '新增物料',
        details: `添加了新物料：${item.name} (库存: ${item.totalQuantity})`,
        data: { itemId: item.id, itemName: item.name }
      });

      this.emit(EVENTS.ITEMS_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true, item };
    }

    updateItem(itemId, itemData) {
      const existingItem = this.storage.getItemById(itemId);
      if (!existingItem) {
        return { success: false, message: '物料不存在' };
      }

      const validation = this.validation.validateUpdateItem(itemData, existingItem);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const updatedItem = new Item({
        ...existingItem.toJSON(),
        name: itemData.name.trim(),
        category: itemData.category || '',
        totalQuantity: parseInt(itemData.totalQuantity) || 0,
        description: itemData.description || '',
        updatedAt: new Date().toISOString()
      });

      this.storage.saveItem(updatedItem);
      this._items = this.storage.getItems();

      const changes = [];
      if (existingItem.name !== updatedItem.name) {
        changes.push(`名称: ${existingItem.name} → ${updatedItem.name}`);
      }
      if (existingItem.category !== updatedItem.category) {
        changes.push(`分类: ${existingItem.category || '未分类'} → ${updatedItem.category || '未分类'}`);
      }
      if (existingItem.totalQuantity !== updatedItem.totalQuantity) {
        changes.push(`库存: ${existingItem.totalQuantity} → ${updatedItem.totalQuantity}`);
      }

      this.addHistory({
        type: HISTORY_TYPES.ITEM_UPDATE,
        title: '编辑物料',
        details: `编辑了物料 ${updatedItem.name}${changes.length > 0 ? ' (' + changes.join('; ') + ')' : ''}`,
        data: { itemId: updatedItem.id, itemName: updatedItem.name }
      });

      this.emit(EVENTS.ITEMS_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true, item: updatedItem };
    }

    deleteItem(itemId) {
      const validation = this.validation.validateDeleteItem(itemId);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const item = this.storage.getItemById(itemId);
      if (!item) {
        return { success: false, message: '物料不存在' };
      }

      this.addHistory({
        type: HISTORY_TYPES.ITEM_DELETE,
        title: '删除物料',
        details: `删除了物料：${item.name} (原库存: ${item.totalQuantity})`,
        data: { itemId: item.id, itemName: item.name }
      });

      this.storage.deleteItem(itemId);
      this._items = this.storage.getItems();

      this.emit(EVENTS.ITEMS_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true };
    }

    getItemById(itemId) {
      return this._items.find(i => i.id === itemId) || null;
    }

    // ===== 借还操作 =====

    borrowItem(borrowData) {
      const validation = this.validation.validateBorrow(borrowData);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const item = this.storage.getItemById(borrowData.itemId);
      const quantity = parseInt(borrowData.quantity) || 1;

      if (!item.borrow(quantity)) {
        return { success: false, message: '库存不足' };
      }

      this.storage.saveItem(item);

      const record = new BorrowRecord({
        itemId: item.id,
        itemName: item.name,
        quantity: quantity,
        project: borrowData.project.trim(),
        person: borrowData.person.trim(),
        expectedReturnAt: borrowData.expectedReturnAt,
        notes: borrowData.notes || ''
      });

      this.storage.saveBorrowRecord(record);
      this._items = this.storage.getItems();
      this._borrowRecords = this.storage.getBorrowRecords();

      this.addHistory({
        type: HISTORY_TYPES.BORROW,
        title: '登记借出',
        details: `${borrowData.person} 从项目 "${borrowData.project}" 借出了 ${quantity} 件 ${item.name}，预计归还 ${formatDate(borrowData.expectedReturnAt)}`,
        data: { 
          recordId: record.id, 
          itemId: item.id, 
          itemName: item.name,
          quantity,
          project: borrowData.project,
          person: borrowData.person
        }
      });

      this.emit(EVENTS.BORROW_RECORDS_UPDATED);
      this.emit(EVENTS.ITEMS_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true, record };
    }

    returnItem(recordId) {
      const validation = this.validation.validateReturn(recordId);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const { borrowRecord, item } = validation.data;

      item.returnItem(borrowRecord.quantity);
      borrowRecord.returnItem();

      this.storage.saveItem(item);
      this.storage.saveBorrowRecord(borrowRecord);

      this._items = this.storage.getItems();
      this._borrowRecords = this.storage.getBorrowRecords();

      let overdueNote = '';
      if (borrowRecord.isOverdue) {
        const overdueDays = Math.floor((new Date() - new Date(borrowRecord.expectedReturnAt)) / (1000 * 60 * 60 * 24));
        overdueNote = ` (逾期 ${overdueDays} 天)`;
      }

      this.addHistory({
        type: HISTORY_TYPES.RETURN,
        title: '确认归还',
        details: `${borrowRecord.person} 归还了 ${borrowRecord.quantity} 件 ${borrowRecord.itemName}${overdueNote}`,
        data: { 
          recordId: borrowRecord.id, 
          itemId: item.id, 
          itemName: item.name,
          quantity: borrowRecord.quantity,
          project: borrowRecord.project,
          person: borrowRecord.person,
          wasOverdue: borrowRecord.isOverdue
        }
      });

      this.emit(EVENTS.BORROW_RECORDS_UPDATED);
      this.emit(EVENTS.ITEMS_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true, record: borrowRecord };
    }

    getBorrowRecordById(recordId) {
      return this._borrowRecords.find(r => r.id === recordId) || null;
    }

    getFilteredBorrowRecords(filters = {}) {
      let records = this.activeBorrowRecords;

      if (filters.project) {
        records = records.filter(r => r.project === filters.project);
      }

      if (filters.status) {
        if (filters.status === 'overdue') {
          records = records.filter(r => r.isOverdue);
        } else if (filters.status === 'borrowed') {
          records = records.filter(r => !r.isOverdue);
        }
      }

      return records.sort((a, b) => 
        new Date(b.borrowedAt) - new Date(a.borrowedAt)
      );
    }

    // ===== 历史操作 =====

    addHistory(historyData) {
      const history = new HistoryRecord({
        type: historyData.type,
        title: historyData.title,
        details: historyData.details,
        data: historyData.data || {}
      });

      this.storage.addHistory(history);
      this._history = this.storage.getHistory();

      this.emit(EVENTS.HISTORY_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return history;
    }

    clearHistory() {
      this.storage.clearHistory();
      this._history = [];

      this.emit(EVENTS.HISTORY_UPDATED);
      this.emit(EVENTS.STATE_CHANGED);

      return { success: true };
    }

    getFilteredHistory(filters = {}) {
      let records = this._history;

      if (filters.type) {
        records = records.filter(r => r.type === filters.type);
      }

      return records;
    }

    // ===== 统计数据 =====

    getStatistics() {
      const totalItems = this._items.reduce((sum, item) => sum + item.totalQuantity, 0);
      const totalBorrowed = this.activeBorrowRecords.reduce((sum, r) => sum + r.quantity, 0);
      const overdueCount = this.overdueRecords.length;
      const availableItems = totalItems - totalBorrowed;

      return {
        totalItems,
        totalBorrowed,
        overdueCount,
        availableItems,
        totalRecords: this._borrowRecords.length,
        activeRecords: this.activeBorrowRecords.length,
        itemCount: this._items.length
      };
    }
  }

  // 创建单例
  const State = new StateManager();

  // 导出到全局
  global.State = State;
  global.StateManager = StateManager;
  global.EVENTS = EVENTS;

})(window);
