const { getPlansPath } = require('../utils/path');
const { readJSON, writeJSON, findJSON, appendJSON, removeJSON, updateJSON } = require('../utils/fs');
const DeliveryPlan = require('../models/deliveryPlan');

class PlanStore {
  constructor() {
    this.filePath = getPlansPath();
  }

  getAll() {
    const data = readJSON(this.filePath, []);
    return data.map(DeliveryPlan.fromJSON);
  }

  get(idOrName) {
    const data = findJSON(this.filePath, p => p.id === idOrName || p.name === idOrName);
    return data ? DeliveryPlan.fromJSON(data) : null;
  }

  exists(idOrName) {
    return this.get(idOrName) !== null;
  }

  save(plan) {
    const existing = this.get(plan.name);
    if (existing) {
      throw new Error(`计划 ${plan.name} 已存在`);
    }
    appendJSON(this.filePath, plan.toJSON());
    return plan;
  }

  updateStatus(id, status) {
    return updateJSON(
      this.filePath,
      p => p.id === id,
      p => ({ ...p, status })
    );
  }

  delete(idOrName) {
    return removeJSON(this.filePath, p => p.id === idOrName || p.name === idOrName) > 0;
  }

  clear() {
    writeJSON(this.filePath, []);
  }
}

module.exports = PlanStore;
