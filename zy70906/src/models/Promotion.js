const { v4: uuidv4 } = require('uuid');

class Promotion {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description || "";
    this.pointsMultiplier = parseFloat(data.pointsMultiplier) || 1;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.storeIds = data.storeIds || [];
    this.memberLevels = data.memberLevels || [];
    this.minAmount = parseFloat(data.minAmount) || 0;
    this.maxPoints = parseInt(data.maxPoints) || null;
    this.excludedCategories = data.excludedCategories || [];
    this.isActive = data.isActive !== false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  isApplicable(transactionDate, storeId, amount, memberLevel) {
    if (!this.isActive) return false;
    const txDate = new Date(transactionDate);
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    if (txDate < start || txDate > end) return false;
    if (this.storeIds.length > 0 && !this.storeIds.includes(storeId)) return false;
    if (this.memberLevels.length > 0 && !this.memberLevels.includes(memberLevel)) return false;
    if (this.minAmount > 0 && amount < this.minAmount) return false;
    return true;
  }

  calculatePoints(basePoints) {
    let points = Math.floor(basePoints * this.pointsMultiplier);
    if (this.maxPoints && points > this.maxPoints) {
      points = this.maxPoints;
    }
    return points;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      pointsMultiplier: this.pointsMultiplier,
      startDate: this.startDate,
      endDate: this.endDate,
      storeIds: this.storeIds,
      memberLevels: this.memberLevels,
      minAmount: this.minAmount,
      maxPoints: this.maxPoints,
      excludedCategories: this.excludedCategories,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Promotion;
