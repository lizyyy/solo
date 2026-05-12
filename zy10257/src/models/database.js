const { v4: uuidv4 } = require('uuid');

class Database {
  constructor() {
    this.members = new Map();
    this.coupons = new Map();
    this.storedValue = new Map();
    this.points = new Map();
    this.stores = new Map();
    this.events = new Map();
    this.idempotencyKeys = new Map();
    this.offlineBatches = new Map();
    this._initSampleData();
  }

  _initSampleData() {
    this.createStore({ id: 'store_a', name: 'A门店', address: '北京市朝阳区' });
    this.createStore({ id: 'store_b', name: 'B门店', address: '上海市浦东新区' });
    
    this.createMember({
      id: 'member_001',
      name: '张三',
      phone: '13800138000',
      level: 'gold'
    });
    
    this.createCoupon({
      id: 'coupon_001',
      memberId: 'member_001',
      type: 'discount',
      value: 50,
      minSpend: 200,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2026-12-31'),
      status: 'available'
    });
    
    this.createCoupon({
      id: 'coupon_002',
      memberId: 'member_001',
      type: 'free',
      value: 1,
      name: '免费商品券',
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2026-12-31'),
      status: 'available'
    });
    
    this.updateStoredValue('member_001', 1000);
    this.updatePoints('member_001', 5000);
  }

  createMember(data) {
    const member = {
      id: data.id || uuidv4(),
      name: data.name,
      phone: data.phone,
      level: data.level || 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
    this.members.set(member.id, member);
    return member;
  }

  getMember(id) {
    return this.members.get(id);
  }

  createStore(data) {
    const store = {
      id: data.id || uuidv4(),
      name: data.name,
      address: data.address,
      status: 'active',
      lastSyncTime: null,
      createdAt: new Date()
    };
    this.stores.set(store.id, store);
    return store;
  }

  getStore(id) {
    return this.stores.get(id);
  }

  getAllStores() {
    return Array.from(this.stores.values());
  }

  createCoupon(data) {
    const coupon = {
      id: data.id || uuidv4(),
      memberId: data.memberId,
      type: data.type,
      name: data.name || `${data.type}券`,
      value: data.value,
      minSpend: data.minSpend || 0,
      validFrom: data.validFrom,
      validTo: data.validTo,
      status: data.status || 'available',
      usedAt: null,
      usedStore: null,
      usedOrder: null,
      createdAt: new Date(),
      version: 1
    };
    this.coupons.set(coupon.id, coupon);
    return coupon;
  }

  getCoupon(id) {
    return this.coupons.get(id);
  }

  getMemberCoupons(memberId) {
    return Array.from(this.coupons.values()).filter(c => c.memberId === memberId);
  }

  updateCouponStatus(id, status, usedStore = null, usedOrder = null) {
    const coupon = this.coupons.get(id);
    if (!coupon) return null;
    coupon.status = status;
    coupon.usedAt = new Date();
    coupon.usedStore = usedStore;
    coupon.usedOrder = usedOrder;
    coupon.version++;
    coupon.updatedAt = new Date();
    return coupon;
  }

  getStoredValue(memberId) {
    if (!this.storedValue.has(memberId)) {
      this.storedValue.set(memberId, {
        memberId,
        balance: 0,
        version: 1,
        updatedAt: new Date()
      });
    }
    return this.storedValue.get(memberId);
  }

  updateStoredValue(memberId, amount) {
    const sv = this.getStoredValue(memberId);
    sv.balance += amount;
    sv.version++;
    sv.updatedAt = new Date();
    return sv;
  }

  setStoredValueBalance(memberId, balance, version) {
    const sv = this.getStoredValue(memberId);
    sv.balance = balance;
    sv.version = version;
    sv.updatedAt = new Date();
    return sv;
  }

  getPoints(memberId) {
    if (!this.points.has(memberId)) {
      this.points.set(memberId, {
        memberId,
        balance: 0,
        version: 1,
        updatedAt: new Date()
      });
    }
    return this.points.get(memberId);
  }

  updatePoints(memberId, amount) {
    const pts = this.getPoints(memberId);
    pts.balance += amount;
    pts.version++;
    pts.updatedAt = new Date();
    return pts;
  }

  setPointsBalance(memberId, balance, version) {
    const pts = this.getPoints(memberId);
    pts.balance = balance;
    pts.version = version;
    pts.updatedAt = new Date();
    return pts;
  }

  createEvent(data) {
    const event = {
      id: data.id || uuidv4(),
      eventType: data.eventType,
      storeId: data.storeId,
      memberId: data.memberId,
      entityType: data.entityType,
      entityId: data.entityId,
      payload: data.payload,
      timestamp: data.timestamp || new Date(),
      sequence: data.sequence,
      batchId: data.batchId,
      status: data.status || 'applied',
      conflictInfo: data.conflictInfo || null,
      createdAt: new Date()
    };
    this.events.set(event.id, event);
    return event;
  }

  getEvents(filters = {}) {
    let result = Array.from(this.events.values());
    if (filters.memberId) {
      result = result.filter(e => e.memberId === filters.memberId);
    }
    if (filters.storeId) {
      result = result.filter(e => e.storeId === filters.storeId);
    }
    if (filters.batchId) {
      result = result.filter(e => e.batchId === filters.batchId);
    }
    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  getEventById(id) {
    return this.events.get(id);
  }

  checkIdempotency(key) {
    return this.idempotencyKeys.get(key);
  }

  markIdempotent(key, result) {
    this.idempotencyKeys.set(key, {
      result,
      timestamp: new Date()
    });
  }

  createOfflineBatch(data) {
    const batchId = data.id || uuidv4();
    const existingBatch = this.offlineBatches.get(batchId);
    
    if (existingBatch) {
      if (existingBatch.status === 'completed' || existingBatch.status === 'partial') {
        return {
          ...existingBatch,
          _existing: true,
          _processed: true
        };
      }
      return {
        ...existingBatch,
        _existing: true,
        _processed: false
      };
    }
    
    const batch = {
      id: batchId,
      storeId: data.storeId,
      events: data.events || [],
      status: 'pending',
      totalCount: data.events?.length || 0,
      successCount: 0,
      failedCount: 0,
      failedEvents: [],
      createdAt: new Date(),
      syncedAt: null
    };
    this.offlineBatches.set(batch.id, batch);
    return {
      ...batch,
      _existing: false,
      _processed: false
    };
  }

  updateOfflineBatch(id, updates) {
    const batch = this.offlineBatches.get(id);
    if (!batch) return null;
    Object.assign(batch, updates);
    return batch;
  }

  getOfflineBatch(id) {
    return this.offlineBatches.get(id);
  }

  getAllBatches() {
    return Array.from(this.offlineBatches.values());
  }

  getMemberSummary(memberId) {
    const member = this.getMember(memberId);
    if (!member) return null;
    
    const coupons = this.getMemberCoupons(memberId);
    const storedValue = this.getStoredValue(memberId);
    const points = this.getPoints(memberId);
    const events = this.getEvents({ memberId });
    
    return {
      member,
      coupons: {
        total: coupons.length,
        available: coupons.filter(c => c.status === 'available').length,
        used: coupons.filter(c => c.status === 'used').length,
        expired: coupons.filter(c => c.status === 'expired').length,
        list: coupons
      },
      storedValue,
      points,
      recentEvents: events.slice(-20),
      eventCount: events.length
    };
  }

  getSyncStatus() {
    const batches = this.getAllBatches();
    const events = this.getEvents();
    
    return {
      totalStores: this.stores.size,
      totalMembers: this.members.size,
      totalEvents: events.length,
      totalBatches: batches.length,
      pendingBatches: batches.filter(b => b.status === 'pending').length,
      partiallySyncedBatches: batches.filter(b => b.status === 'partial').length,
      completedBatches: batches.filter(b => b.status === 'completed').length,
      conflictedEvents: events.filter(e => e.status === 'conflicted').length,
      lastSyncTime: batches.length > 0 ? 
        batches.reduce((latest, b) => b.syncedAt > latest ? b.syncedAt : latest, batches[0].syncedAt) : null
    };
  }
}

module.exports = new Database();
