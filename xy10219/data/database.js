const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class Database {
  constructor() {
    this.faultOrders = new Map();
    this.sparePartBatches = new Map();
    this.requisitionRecords = new Map();
    this.receiptRecords = new Map();
    this.replacementRecords = new Map();
    this.requestLog = new Map();
    this.initDemoData();
  }

  initDemoData() {
    this.addSparePartBatch({
      batchNo: 'SP-2024-001',
      partCode: 'DOOR-SENSOR-001',
      partName: '电梯门传感器',
      manufacturer: 'OTIS',
      quantity: 10,
      productionDate: '2024-01-15',
      expiryDate: '2026-01-15',
      warehouseLocation: 'A区-123',
      operator: '仓库管理员A'
    });

    this.addSparePartBatch({
      batchNo: 'SP-2024-002',
      partCode: 'MOTOR-CONTROL-001',
      partName: '电机控制器',
      manufacturer: '三菱',
      quantity: 5,
      productionDate: '2024-02-01',
      expiryDate: '2027-02-01',
      warehouseLocation: 'B区-045',
      operator: '仓库管理员B'
    });

    this.addSparePartBatch({
      batchNo: 'SP-2024-003',
      partCode: 'BRAKE-PAD-001',
      partName: '制动刹车片',
      manufacturer: '通力',
      quantity: 20,
      productionDate: '2024-03-10',
      expiryDate: '2025-09-10',
      warehouseLocation: 'C区-008',
      operator: '仓库管理员A'
    });
  }

  generateId() {
    return uuidv4();
  }

  generateRequestKey(method, endpoint, body) {
    const bodyStr = JSON.stringify(body);
    return `${method}:${endpoint}:${bodyStr}`;
  }

  logRequest(requestKey, response) {
    this.requestLog.set(requestKey, {
      response,
      timestamp: moment().toISOString()
    });
  }

  getCachedRequest(requestKey) {
    return this.requestLog.get(requestKey);
  }

  addFaultOrder(data) {
    const id = this.generateId();
    const order = {
      id,
      orderNo: `FO-${moment().format('YYYYMMDD')}-${String(this.faultOrders.size + 1).padStart(3, '0')}`,
      ...data,
      status: 'CREATED',
      statusHistory: [{
        status: 'CREATED',
        timestamp: moment().toISOString(),
        operator: data.operator || 'system',
        remark: '故障单已创建'
      }],
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    };
    this.faultOrders.set(id, order);
    return order;
  }

  getFaultOrder(id) {
    return this.faultOrders.get(id);
  }

  getFaultOrderByNo(orderNo) {
    for (const order of this.faultOrders.values()) {
      if (order.orderNo === orderNo) return order;
    }
    return null;
  }

  updateFaultOrder(id, updates) {
    const order = this.faultOrders.get(id);
    if (!order) return null;
    const updated = { ...order, ...updates, updatedAt: moment().toISOString() };
    this.faultOrders.set(id, updated);
    return updated;
  }

  addStatusHistory(id, status, operator, remark) {
    const order = this.faultOrders.get(id);
    if (!order) return null;
    order.statusHistory.push({
      status,
      timestamp: moment().toISOString(),
      operator,
      remark
    });
    order.status = status;
    order.updatedAt = moment().toISOString();
    this.faultOrders.set(id, order);
    return order;
  }

  getAllFaultOrders() {
    return Array.from(this.faultOrders.values());
  }

  addSparePartBatch(data) {
    const id = this.generateId();
    const batch = {
      id,
      ...data,
      availableQuantity: data.quantity,
      allocatedQuantity: 0,
      usedQuantity: 0,
      status: 'AVAILABLE',
      createdAt: moment().toISOString()
    };
    this.sparePartBatches.set(id, batch);
    return batch;
  }

  getSparePartBatch(id) {
    return this.sparePartBatches.get(id);
  }

  getSparePartBatchByNo(batchNo) {
    for (const batch of this.sparePartBatches.values()) {
      if (batch.batchNo === batchNo) return batch;
    }
    return null;
  }

  updateSparePartBatch(id, updates) {
    const batch = this.sparePartBatches.get(id);
    if (!batch) return null;
    const updated = { ...batch, ...updates };
    this.sparePartBatches.set(id, updated);
    return updated;
  }

  getAllSparePartBatches() {
    return Array.from(this.sparePartBatches.values());
  }

  addRequisitionRecord(data) {
    const id = this.generateId();
    const record = {
      id,
      requisitionNo: `RQ-${moment().format('YYYYMMDD')}-${String(this.requisitionRecords.size + 1).padStart(3, '0')}`,
      ...data,
      status: 'PENDING',
      createdAt: moment().toISOString()
    };
    this.requisitionRecords.set(id, record);
    return record;
  }

  getRequisitionRecord(id) {
    return this.requisitionRecords.get(id);
  }

  getRequisitionRecordsByFaultOrder(faultOrderId) {
    return Array.from(this.requisitionRecords.values()).filter(
      r => r.faultOrderId === faultOrderId
    );
  }

  updateRequisitionRecord(id, updates) {
    const record = this.requisitionRecords.get(id);
    if (!record) return null;
    const updated = { ...record, ...updates };
    this.requisitionRecords.set(id, updated);
    return updated;
  }

  addReceiptRecord(data) {
    const id = this.generateId();
    const record = {
      id,
      receiptNo: `RC-${moment().format('YYYYMMDD')}-${String(this.receiptRecords.size + 1).padStart(3, '0')}`,
      ...data,
      status: 'SIGNED',
      signedAt: moment().toISOString()
    };
    this.receiptRecords.set(id, record);
    return record;
  }

  getReceiptRecord(id) {
    return this.receiptRecords.get(id);
  }

  getReceiptRecordsByRequisition(requisitionId) {
    return Array.from(this.receiptRecords.values()).filter(
      r => r.requisitionId === requisitionId
    );
  }

  addReplacementRecord(data) {
    const id = this.generateId();
    const record = {
      id,
      replacementNo: `RP-${moment().format('YYYYMMDD')}-${String(this.replacementRecords.size + 1).padStart(3, '0')}`,
      ...data,
      status: 'CONFIRMED',
      confirmedAt: moment().toISOString()
    };
    this.replacementRecords.set(id, record);
    return record;
  }

  getReplacementRecord(id) {
    return this.replacementRecords.get(id);
  }

  getReplacementRecordsByFaultOrder(faultOrderId) {
    return Array.from(this.replacementRecords.values()).filter(
      r => r.faultOrderId === faultOrderId
    );
  }
}

module.exports = new Database();
