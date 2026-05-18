const fs = require('fs');
const path = require('path');
const Evaluation = require('../models/Evaluation');

class EvaluationStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensureDataFile();
  }

  ensureDataFile() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]), 'utf8');
    }
  }

  readAll() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const items = JSON.parse(data);
      return items.map(item => new Evaluation(item));
    } catch (error) {
      return [];
    }
  }

  writeAll(evaluations) {
    const data = evaluations.map(e => e.toJSON());
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  findById(id) {
    const evaluations = this.readAll();
    return evaluations.find(e => e.id === id);
  }

  findByOrderNo(orderNo) {
    const evaluations = this.readAll();
    return evaluations.find(e => e.orderNo === orderNo);
  }

  findByFilters(filters = {}) {
    let evaluations = this.readAll();

    if (filters.startDate) {
      evaluations = evaluations.filter(e => e.trialDate >= filters.startDate);
    }

    if (filters.endDate) {
      evaluations = evaluations.filter(e => e.trialDate <= filters.endDate);
    }

    if (filters.status) {
      evaluations = evaluations.filter(e => e.status === filters.status);
    }

    if (filters.managerId) {
      evaluations = evaluations.filter(e => e.managerId === filters.managerId);
    }

    if (filters.storeId) {
      evaluations = evaluations.filter(e => e.storeId === filters.storeId);
    }

    if (filters.auntId) {
      evaluations = evaluations.filter(e => e.auntId === filters.auntId);
    }

    if (filters.customerId) {
      evaluations = evaluations.filter(e => e.customerId === filters.customerId);
    }

    if (filters.serviceType) {
      evaluations = evaluations.filter(e => e.serviceType === filters.serviceType);
    }

    return evaluations;
  }

  create(data) {
    const evaluations = this.readAll();
    const evaluation = new Evaluation(data);
    evaluations.push(evaluation);
    this.writeAll(evaluations);
    return evaluation;
  }

  update(id, data) {
    const evaluations = this.readAll();
    const index = evaluations.findIndex(e => e.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedData = { ...evaluations[index].toJSON(), ...data, updatedAt: new Date().toISOString() };
    evaluations[index] = new Evaluation(updatedData);
    this.writeAll(evaluations);
    return evaluations[index];
  }

  delete(id) {
    const evaluations = this.readAll();
    const index = evaluations.findIndex(e => e.id === id);
    
    if (index === -1) {
      return false;
    }

    evaluations.splice(index, 1);
    this.writeAll(evaluations);
    return true;
  }

  batchImport(items) {
    const evaluations = this.readAll();
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const validation = Evaluation.validate(item);

      if (!validation.isValid) {
        results.push({
          row: i + 1,
          success: false,
          orderNo: item.orderNo,
          errors: validation.errors
        });
        continue;
      }

      const existing = evaluations.find(e => e.orderNo === item.orderNo);
      if (existing) {
        results.push({
          row: i + 1,
          success: false,
          orderNo: item.orderNo,
          errors: ['订单号已存在']
        });
        continue;
      }

      try {
        const evaluation = new Evaluation(item);
        evaluations.push(evaluation);
        results.push({
          row: i + 1,
          success: true,
          orderNo: item.orderNo,
          id: evaluation.id
        });
      } catch (error) {
        results.push({
          row: i + 1,
          success: false,
          orderNo: item.orderNo,
          errors: [error.message]
        });
      }
    }

    this.writeAll(evaluations);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      total: items.length,
      success: successCount,
      fail: failCount,
      results
    };
  }
}

module.exports = EvaluationStore;
