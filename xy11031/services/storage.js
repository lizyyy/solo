const { DispatchOrder } = require('../models/dispatch');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');

class StorageService {
  constructor() {
    this.orders = new Map();
    this.batches = new Map();
    this.ensureDataDir();
    this.loadFromFile();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  loadFromFile() {
    try {
      if (fs.existsSync(ORDERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
        data.forEach(order => {
          this.orders.set(order.id, new DispatchOrder(order));
        });
      }
      
      if (fs.existsSync(BATCHES_FILE)) {
        const data = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
        data.forEach(batch => {
          this.batches.set(batch.batchId, batch);
        });
      }
    } catch (error) {
      console.error('加载数据失败:', error.message);
    }
  }

  saveToFile() {
    try {
      const ordersArray = Array.from(this.orders.values()).map(o => o.toJSON());
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersArray, null, 2), 'utf8');
      
      const batchesArray = Array.from(this.batches.values());
      fs.writeFileSync(BATCHES_FILE, JSON.stringify(batchesArray, null, 2), 'utf8');
    } catch (error) {
      console.error('保存数据失败:', error.message);
    }
  }

  addOrder(order) {
    this.orders.set(order.id, order);
    this.saveToFile();
    return order;
  }

  getOrderById(id) {
    return this.orders.get(id);
  }

  getOrderByOrderNo(orderNo) {
    return Array.from(this.orders.values()).find(o => o.orderNo === orderNo);
  }

  getAllOrders() {
    return Array.from(this.orders.values());
  }

  updateOrder(id, updates) {
    const order = this.orders.get(id);
    if (order) {
      Object.assign(order, updates);
      order.updatedAt = new Date().toISOString();
      this.saveToFile();
      return order;
    }
    return null;
  }

  deleteOrder(id) {
    const deleted = this.orders.delete(id);
    if (deleted) {
      this.saveToFile();
    }
    return deleted;
  }

  getOrdersByTechnician(technicianId) {
    return Array.from(this.orders.values()).filter(o => o.technicianId === technicianId);
  }

  getOrdersByDate(scheduledDate) {
    return Array.from(this.orders.values()).filter(o => o.scheduledDate === scheduledDate);
  }

  getOrdersByStatus(status) {
    return Array.from(this.orders.values()).filter(o => o.status === status);
  }

  getOrdersNeedingReview() {
    return Array.from(this.orders.values()).filter(o => o.needsReview);
  }

  addBatch(batch) {
    this.batches.set(batch.batchId, batch);
    this.saveToFile();
    return batch;
  }

  getBatch(batchId) {
    return this.batches.get(batchId);
  }

  getAllBatches() {
    return Array.from(this.batches.values());
  }

  clearAll() {
    this.orders.clear();
    this.batches.clear();
    this.saveToFile();
  }
}

module.exports = new StorageService();
