const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const Consumption = require('../models/consumption');
const PurchaseCycle = require('../models/purchaseCycle');
const MinStock = require('../models/minStock');
const { EQUIPMENT_CRITICALITY_WEIGHT } = require('../utils/constants');

const calculateMinStock = (partId, equipmentId = null) => {
  const avgDaily = Consumption.getAverageDailyConsumption(partId);
  const cycleDays = PurchaseCycle.getMaxCycleDays(partId);
  const equipments = equipmentId
    ? [Equipment.findById(equipmentId)].filter(Boolean)
    : Equipment.getByPart(partId);
  
  const highestCriticality = equipments.reduce((highest, eq) => {
    const weight = EQUIPMENT_CRITICALITY_WEIGHT[eq.criticality] || 1;
    return Math.max(highest, weight);
  }, 1);
  
  const safetyFactor = 1.0 + (highestCriticality - 1) * 0.2;
  const baseMinStock = Math.ceil(avgDaily.daily * cycleDays * safetyFactor);
  
  return {
    partId,
    equipmentId,
    avgDailyConsumption: avgDaily.daily,
    totalRecentConsumption: avgDaily.total,
    cycleDays,
    highestCriticalityWeight: highestCriticality,
    safetyFactor,
    minQuantity: Math.max(baseMinStock, 1),
    calculatedAt: Date.now()
  };
};

const updateMinStockRule = (partId, equipmentId = null) => {
  const calculation = calculateMinStock(partId, equipmentId);
  const existing = MinStock.findByPartAndEquipment(partId, equipmentId);
  
  if (existing) {
    MinStock.update(existing.id, {
      minQuantity: calculation.minQuantity,
      safetyFactor: calculation.safetyFactor,
      calculatedAt: calculation.calculatedAt
    });
    return { ...calculation, ruleId: existing.id, isNew: false };
  } else {
    const ruleId = MinStock.create({
      partId,
      equipmentId,
      minQuantity: calculation.minQuantity,
      safetyFactor: calculation.safetyFactor,
      calculatedAt: calculation.calculatedAt
    });
    return { ...calculation, ruleId, isNew: true };
  }
};

const recalculateAllParts = () => {
  const parts = SparePart.findAll();
  return parts.map(part => updateMinStockRule(part.id));
};

module.exports = {
  calculateMinStock,
  updateMinStockRule,
  recalculateAllParts
};
