const crypto = require('crypto');

class Vehicle {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.vin = data.vin;
    this.plateNumber = data.plateNumber;
    this.brand = data.brand;
    this.model = data.model;
    this.year = data.year;
    this.mileage = data.mileage;
    this.purchasePrice = Number(data.purchasePrice) || 0;
    this.expectedSellingPrice = Number(data.expectedSellingPrice) || 0;
    this.status = data.status || 'in_preparation';
    this.preparationItems = [];
    this.costs = [];
    this.priceAdjustments = [];
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  get displayName() {
    return `${this.year} ${this.brand} ${this.model}`;
  }

  addPreparationItem(item) {
    this.preparationItems.push(item);
  }

  addCost(cost) {
    this.costs.push(cost);
  }

  addPriceAdjustment(adjustment) {
    this.priceAdjustments.push(adjustment);
  }

  getTotalPreparationCost() {
    return this.costs.reduce((sum, cost) => sum + cost.getTotal(), 0);
  }

  getTotalCost() {
    return this.purchasePrice + this.getTotalPreparationCost();
  }

  getCurrentSellingPrice() {
    if (this.priceAdjustments.length > 0) {
      const lastAdjustment = this.priceAdjustments[this.priceAdjustments.length - 1];
      return lastAdjustment.newPrice;
    }
    return this.expectedSellingPrice;
  }

  getOriginalSellingPrice() {
    return this.expectedSellingPrice;
  }

  getProfit() {
    return this.getCurrentSellingPrice() - this.getTotalCost();
  }

  getOriginalProfit() {
    return this.getOriginalSellingPrice() - this.getTotalCost();
  }

  getProfitMargin() {
    const totalCost = this.getTotalCost();
    if (totalCost === 0) return 0;
    return (this.getProfit() / totalCost) * 100;
  }

  isPreparationComplete() {
    if (this.preparationItems.length === 0) return false;
    return this.preparationItems.every(item => item.status === 'completed');
  }

  hasIssues() {
    return this.getIssues().length > 0;
  }

  getIssues() {
    const issues = [];

    if (this.status === 'for_sale' && !this.isPreparationComplete()) {
      issues.push({
        type: 'UNFINISHED_PREPARATION',
        severity: 'warning',
        message: '车辆标记为待售但整备项目未全部完成'
      });
    }

    if (this.getCurrentSellingPrice() < this.getTotalCost()) {
      issues.push({
        type: 'PRICE_BELOW_COST',
        severity: 'error',
        message: `售价(${this.formatPrice(this.getCurrentSellingPrice())})低于总成本(${this.formatPrice(this.getTotalCost())})`
      });
    }

    const duplicateItems = this.findDuplicateItems();
    duplicateItems.forEach(item => {
      issues.push({
        type: 'DUPLICATE_ITEM',
        severity: 'warning',
        message: `重复的整备项目: ${item.type}，共 ${item.count} 次`
      });
    });

    return issues;
  }

  findDuplicateItems() {
    const itemTypes = {};
    this.preparationItems.forEach(item => {
      if (item.type) {
        itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
      }
    });

    const duplicates = [];
    Object.keys(itemTypes).forEach(type => {
      if (itemTypes[type] > 1) {
        duplicates.push({ type, count: itemTypes[type] });
      }
    });

    return duplicates;
  }

  formatPrice(price) {
    return `¥${price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  }

  toJSON() {
    return {
      id: this.id,
      vin: this.vin,
      plateNumber: this.plateNumber,
      brand: this.brand,
      model: this.model,
      year: this.year,
      mileage: this.mileage,
      purchasePrice: this.purchasePrice,
      expectedSellingPrice: this.expectedSellingPrice,
      status: this.status,
      preparationItems: this.preparationItems.map(item => item.toJSON()),
      costs: this.costs.map(cost => cost.toJSON()),
      priceAdjustments: this.priceAdjustments.map(adj => adj.toJSON()),
      notes: this.notes,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    const vehicle = new Vehicle(json);
    vehicle.preparationItems = json.preparationItems.map(item => PreparationItem.fromJSON(item));
    vehicle.costs = json.costs.map(cost => Cost.fromJSON(cost));
    vehicle.priceAdjustments = json.priceAdjustments.map(adj => PriceAdjustment.fromJSON(adj));
    return vehicle;
  }
}

class PreparationItem {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.type = data.type;
    this.description = data.description || '';
    this.status = data.status || 'pending';
    this.startDate = data.startDate;
    this.completedDate = data.completedDate;
    this.assignedTo = data.assignedTo;
    this.notes = data.notes || '';
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      status: this.status,
      startDate: this.startDate,
      completedDate: this.completedDate,
      assignedTo: this.assignedTo,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new PreparationItem(json);
  }
}

class Cost {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.vehicleId = data.vehicleId;
    this.category = data.category;
    this.description = data.description || '';
    this.partsCost = Number(data.partsCost) || 0;
    this.laborCost = Number(data.laborCost) || 0;
    this.laborHours = Number(data.laborHours) || 0;
    this.date = data.date || new Date().toISOString();
    this.notes = data.notes || '';
  }

  getTotal() {
    return this.partsCost + this.laborCost;
  }

  toJSON() {
    return {
      id: this.id,
      vehicleId: this.vehicleId,
      category: this.category,
      description: this.description,
      partsCost: this.partsCost,
      laborCost: this.laborCost,
      laborHours: this.laborHours,
      date: this.date,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new Cost(json);
  }
}

class PriceAdjustment {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.vehicleId = data.vehicleId;
    this.oldPrice = Number(data.oldPrice);
    this.newPrice = Number(data.newPrice);
    this.reason = data.reason;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
  }

  getDifference() {
    return this.newPrice - this.oldPrice;
  }

  getProfitChange(vehicle) {
    const oldProfit = this.oldPrice - vehicle.getTotalCost();
    const newProfit = this.newPrice - vehicle.getTotalCost();
    return newProfit - oldProfit;
  }

  toJSON() {
    return {
      id: this.id,
      vehicleId: this.vehicleId,
      oldPrice: this.oldPrice,
      newPrice: this.newPrice,
      reason: this.reason,
      createdAt: this.createdAt,
      createdBy: this.createdBy
    };
  }

  static fromJSON(json) {
    return new PriceAdjustment(json);
  }
}

module.exports = {
  Vehicle,
  PreparationItem,
  Cost,
  PriceAdjustment
};
