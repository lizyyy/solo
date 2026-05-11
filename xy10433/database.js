class SimpleDB {
  constructor() {
    this.assets = [];
    this.borrowRequests = [];
    this.borrowRecords = [];
    this.damageRecords = [];
    this.ids = {
      assets: 0,
      borrowRequests: 0,
      borrowRecords: 0,
      damageRecords: 0
    };
  }

  getCurrentDate() {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace('T', ' ');
  }

  getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  createAsset(data) {
    this.ids.assets++;
    const record = {
      id: this.ids.assets,
      ...data,
      created_at: this.getCurrentDate()
    };
    this.assets.push(record);
    return { lastInsertRowid: record.id, changes: 1 };
  }

  createBorrowRequest(data) {
    this.ids.borrowRequests++;
    const record = {
      id: this.ids.borrowRequests,
      ...data,
      status: data.status || 'pending',
      created_at: this.getCurrentDate()
    };
    this.borrowRequests.push(record);
    return { lastInsertRowid: record.id, changes: 1 };
  }

  createBorrowRecord(data) {
    this.ids.borrowRecords++;
    const record = {
      id: this.ids.borrowRecords,
      ...data,
      status: data.status || 'borrowed',
      borrow_date: this.getCurrentDate(),
      created_at: this.getCurrentDate()
    };
    this.borrowRecords.push(record);
    return { lastInsertRowid: record.id, changes: 1 };
  }

  createDamageRecord(data) {
    this.ids.damageRecords++;
    const record = {
      id: this.ids.damageRecords,
      ...data,
      status: data.status || 'pending_compensation',
      created_at: this.getCurrentDate()
    };
    this.damageRecords.push(record);
    return { lastInsertRowid: record.id, changes: 1 };
  }

  getAssetById(id) {
    return this.assets.find(a => a.id === id);
  }

  getAssetByCode(asset_code) {
    return this.assets.find(a => a.asset_code === asset_code);
  }

  getAssets(filters = {}) {
    let result = [...this.assets];
    if (filters.category) {
      result = result.filter(a => a.category === filters.category);
    }
    if (filters.department) {
      result = result.filter(a => a.department === filters.department);
    }
    return result;
  }

  updateAsset(id, updates) {
    const asset = this.assets.find(a => a.id === id);
    if (asset) {
      Object.assign(asset, updates);
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  getBorrowRequestById(id) {
    return this.borrowRequests.find(r => r.id === id);
  }

  getBorrowRequests(filters = {}) {
    let result = [...this.borrowRequests];
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters.request_department) {
      result = result.filter(r => r.request_department === filters.request_department);
    }
    if (filters.asset_code) {
      result = result.filter(r => r.asset_code === filters.asset_code);
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  updateBorrowRequest(id, updates) {
    const request = this.borrowRequests.find(r => r.id === id);
    if (request) {
      Object.assign(request, updates);
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  getBorrowRecordById(id) {
    return this.borrowRecords.find(r => r.id === id);
  }

  getBorrowRecords(filters = {}) {
    let result = [...this.borrowRecords];
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters.request_department) {
      result = result.filter(r => r.request_department === filters.request_department);
    }
    if (filters.asset_code) {
      result = result.filter(r => r.asset_code === filters.asset_code);
    }
    if (filters.asset_id) {
      result = result.filter(r => r.asset_id === filters.asset_id);
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  updateBorrowRecord(id, updates) {
    const record = this.borrowRecords.find(r => r.id === id);
    if (record) {
      Object.assign(record, updates);
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  getDamageRecords(filters = {}) {
    let result = [...this.damageRecords];
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters.record_id) {
      result = result.filter(r => r.record_id === filters.record_id);
    }
    if (filters.asset_code) {
      result = result.filter(r => r.asset_code === filters.asset_code);
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getDamageRecordById(id) {
    return this.damageRecords.find(r => r.id === id);
  }

  updateDamageRecord(id, updates) {
    const record = this.damageRecords.find(r => r.id === id);
    if (record) {
      Object.assign(record, updates);
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  transaction(fn) {
    fn();
  }
}

const db = new SimpleDB();
module.exports = db;
