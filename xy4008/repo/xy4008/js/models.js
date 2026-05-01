(function(global) {
  'use strict';

  // 生成唯一ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 物料分类
  const ITEM_CATEGORIES = [
    '道具',
    '灯光',
    '录音',
    '摄影',
    '其他'
  ];

  // 借还状态
  const BORROW_STATUS = {
    BORROWED: 'borrowed',
    OVERDUE: 'overdue',
    RETURNED: 'returned'
  };

  // 历史操作类型
  const HISTORY_TYPES = {
    BORROW: 'borrow',
    RETURN: 'return',
    ITEM_CREATE: 'item_create',
    ITEM_UPDATE: 'item_update',
    ITEM_DELETE: 'item_delete'
  };

  // 物料模型
  class Item {
    constructor(data) {
      this.id = data.id || generateId();
      this.name = data.name || '';
      this.category = data.category || '';
      this.totalQuantity = parseInt(data.totalQuantity) || 0;
      this.borrowedQuantity = parseInt(data.borrowedQuantity) || 0;
      this.description = data.description || '';
      this.createdAt = data.createdAt || new Date().toISOString();
      this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    get availableQuantity() {
      return this.totalQuantity - this.borrowedQuantity;
    }

    get status() {
      if (this.availableQuantity <= 0) {
      return 'unavailable';
    } else if (this.availableQuantity <= 3) {
      return 'low';
    }
      return 'available';
    }

    canBorrow(quantity) {
      return this.availableQuantity >= quantity && quantity > 0;
    }

    borrow(quantity) {
      if (!this.canBorrow(quantity)) {
        return false;
      }
      this.borrowedQuantity += quantity;
      this.updatedAt = new Date().toISOString();
      return true;
    }

    returnItem(quantity) {
      if (quantity <= 0 || this.borrowedQuantity < quantity) {
        return false;
      }
      this.borrowedQuantity -= quantity;
      this.updatedAt = new Date().toISOString();
      return true;
    }

    toJSON() {
      return {
        id: this.id,
        name: this.name,
        category: this.category,
        totalQuantity: this.totalQuantity,
        borrowedQuantity: this.borrowedQuantity,
        description: this.description,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
  }

  // 借还记录模型
  class BorrowRecord {
    constructor(data) {
      this.id = data.id || generateId();
      this.itemId = data.itemId || '';
      this.itemName = data.itemName || '';
      this.quantity = parseInt(data.quantity) || 0;
      this.project = data.project || '';
      this.person = data.person || '';
      this.borrowedAt = data.borrowedAt || new Date().toISOString();
      this.expectedReturnAt = data.expectedReturnAt || '';
      this.returnedAt = data.returnedAt || null;
      this.notes = data.notes || '';
      this.status = data.status || BORROW_STATUS.BORROWED;
      this.createdAt = data.createdAt || new Date().toISOString();
    }

    get isOverdue() {
      if (this.status === BORROW_STATUS.RETURNED) {
        return false;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expectedReturn = new Date(this.expectedReturnAt);
      expectedReturn.setHours(0, 0, 0, 0);
      return today > expectedReturn;
    }

    get currentStatus() {
      if (this.status === BORROW_STATUS.RETURNED) {
        return BORROW_STATUS.RETURNED;
      }
      return this.isOverdue ? BORROW_STATUS.OVERDUE : BORROW_STATUS.BORROWED;
    }

    returnItem() {
      if (this.status === BORROW_STATUS.RETURNED) {
        return false;
      }
      this.status = BORROW_STATUS.RETURNED;
      this.returnedAt = new Date().toISOString();
      return true;
    }

    toJSON() {
      return {
        id: this.id,
        itemId: this.itemId,
        itemName: this.itemName,
        quantity: this.quantity,
        project: this.project,
        person: this.person,
        borrowedAt: this.borrowedAt,
        expectedReturnAt: this.expectedReturnAt,
        returnedAt: this.returnedAt,
        notes: this.notes,
        status: this.status,
        createdAt: this.createdAt
      };
    }
  }

  // 历史记录模型
  class HistoryRecord {
    constructor(data) {
      this.id = data.id || generateId();
      this.type = data.type || '';
      this.title = data.title || '';
      this.details = data.details || '';
      this.data = data.data || {};
      this.createdAt = data.createdAt || new Date().toISOString();
    }

    toJSON() {
      return {
        id: this.id,
        type: this.type,
        title: this.title,
        details: this.details,
        data: this.data,
        createdAt: this.createdAt
      };
    }
  }

  // 工具函数
  function formatDate(dateString, format = 'short') {
    if (!dateString) return '';
    const date = new Date(dateString);
    
    if (format === 'short') {
      return date.toLocaleDateString('zh-CN');
    } else if (format === 'long') {
      return date.toLocaleString('zh-CN');
    }
    return date.toISOString().split('T')[0];
  }

  function formatDateForInput(dateString) {
    if (!dateString) {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
    return new Date(dateString).toISOString().split('T')[0];
  }

  function getDaysDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function getStatusLabel(status) {
    const labels = {
      [BORROW_STATUS.BORROWED]: '借出中',
      [BORROW_STATUS.OVERDUE]: '已逾期',
      [BORROW_STATUS.RETURNED]: '已归还'
    };
    return labels[status] || status;
  }

  function getHistoryTypeLabel(type) {
    const labels = {
      [HISTORY_TYPES.BORROW]: '借出',
      [HISTORY_TYPES.RETURN]: '归还',
      [HISTORY_TYPES.ITEM_CREATE]: '新增物料',
      [HISTORY_TYPES.ITEM_UPDATE]: '编辑物料',
      [HISTORY_TYPES.ITEM_DELETE]: '删除物料'
    };
    return labels[type] || type;
  }

  function getHistoryIcon(type) {
    const icons = {
      [HISTORY_TYPES.BORROW]: '📤',
      [HISTORY_TYPES.RETURN]: '📥',
      [HISTORY_TYPES.ITEM_CREATE]: '➕',
      [HISTORY_TYPES.ITEM_UPDATE]: '✏️',
      [HISTORY_TYPES.ITEM_DELETE]: '🗑️'
    };
    return icons[type] || '📝';
  }

  // 导出到全局
  global.Models = {
    Item,
    BorrowRecord,
    HistoryRecord,
    ITEM_CATEGORIES,
    BORROW_STATUS,
    HISTORY_TYPES,
    generateId,
    formatDate,
    formatDateForInput,
    getDaysDiff,
    getStatusLabel,
    getHistoryTypeLabel,
    getHistoryIcon
  };

})(window);
