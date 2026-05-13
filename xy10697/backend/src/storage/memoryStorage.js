const Cylinder = require('../models/Cylinder');
const FillBatch = require('../models/FillBatch');
const StatusHistory = require('../models/StatusHistory');
const Customer = require('../models/Customer');

class MemoryStorage {
  constructor() {
    this.cylinders = new Map();
    this.batches = new Map();
    this.histories = [];
    this.customers = new Map();
    this.requestIds = new Set();
  }

  isDuplicateRequest(requestId) {
    if (this.requestIds.has(requestId)) {
      return true;
    }
    this.requestIds.add(requestId);
    return false;
  }

  addCylinder(data) {
    const cylinder = new Cylinder(data);
    this.cylinders.set(cylinder.id, cylinder);
    return cylinder;
  }

  getCylinder(id) {
    return this.cylinders.get(id);
  }

  getCylinderByNo(cylinderNo) {
    for (const cylinder of this.cylinders.values()) {
      if (cylinder.cylinderNo === cylinderNo) {
        return cylinder;
      }
    }
    return null;
  }

  getAllCylinders() {
    return Array.from(this.cylinders.values());
  }

  updateCylinder(id, data) {
    const cylinder = this.cylinders.get(id);
    if (cylinder) {
      cylinder.update(data);
      return cylinder;
    }
    return null;
  }

  addBatch(data) {
    const batch = new FillBatch(data);
    this.batches.set(batch.id, batch);
    return batch;
  }

  getBatch(id) {
    return this.batches.get(id);
  }

  getBatchByNo(batchNo) {
    for (const batch of this.batches.values()) {
      if (batch.batchNo === batchNo) {
        return batch;
      }
    }
    return null;
  }

  getAllBatches() {
    return Array.from(this.batches.values());
  }

  addHistory(data) {
    const history = new StatusHistory(data);
    this.histories.push(history);
    return history;
  }

  getHistoriesByCylinder(cylinderId) {
    return this.histories.filter(h => h.cylinderId === cylinderId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getAllHistories() {
    return [...this.histories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  addCustomer(data) {
    const customer = new Customer(data);
    this.customers.set(customer.id, customer);
    return customer;
  }

  getCustomer(id) {
    return this.customers.get(id);
  }

  getAllCustomers() {
    return Array.from(this.customers.values());
  }

  getCustomerByNo(customerNo) {
    for (const customer of this.customers.values()) {
      if (customer.customerNo === customerNo) {
        return customer;
      }
    }
    return null;
  }
}

module.exports = new MemoryStorage();
