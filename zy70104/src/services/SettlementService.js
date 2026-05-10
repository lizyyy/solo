const Batch = require('../models/Batch');
const BatchService = require('./BatchService');
const dataStore = require('../utils/dataStore');
const moistureCalculator = require('../utils/moistureCalculator');
const energyAllocator = require('../utils/energyAllocator');
const { v4: uuidv4 } = require('uuid');

const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  CALCULATING: 'calculating',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
  ROLLBACK: 'rollback'
};

class SettlementService {
  
  constructor() {
    this.batchService = new BatchService();
  }
  
  async calculateSettlement(batchNo, allowRetry = false) {
    const batch = this.batchService.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    if (!batch.canSettle()) {
      throw new Error(`批次状态为 ${batch.status}，无法结算。请先通过审核。`);
    }
    
    const existingSettlement = dataStore.getSettlementByBatch(batchNo);
    if (existingSettlement && existingSettlement.status === SETTLEMENT_STATUS.COMPLETED) {
      return existingSettlement;
    }
    
    if (this._shouldSimulateTimeout(allowRetry)) {
      throw new Error('结算超时，请使用 --retry 重试');
    }
    
    const config = dataStore.getConfig();
    const allBatches = dataStore.getBatches();
    
    const moistureRemoved = moistureCalculator.calculateMoistureRemoved(
      batch.inWeight,
      batch.inMoisture,
      batch.outMoisture
    );
    
    const dryingAmount = batch.inWeight - batch.outWeight;
    
    const moistureLossRatio = moistureCalculator.calculateMoistureLossRatio(
      batch.inMoisture,
      batch.outMoisture
    );
    
    const weightLossRatio = moistureCalculator.calculateWeightLossRatio(
      batch.inWeight,
      batch.outWeight
    );
    
    const energyAllocation = energyAllocator.allocateEnergyToBatch(
      batch,
      allBatches,
      config
    );
    
    if (energyAllocation.hasAnomaly) {
      energyAllocation.anomalies.forEach(anomaly => {
        dataStore.saveAnomaly({
          id: uuidv4(),
          batchNo,
          type: anomaly.type,
          message: anomaly.message,
          details: anomaly,
          detectedAt: new Date().toISOString(),
          status: 'open'
        });
      });
    }
    
    const basePrice = config.settlement.basePricePerKg;
    const moistureBonus = config.settlement.moistureReductionBonus;
    
    const baseAmount = batch.outWeight * basePrice;
    const moistureReductionAmount = moistureLossRatio * moistureBonus;
    const serviceFee = energyAllocation.totalEnergyCost;
    
    const settlementAmount = baseAmount + moistureReductionAmount - serviceFee;
    
    const energyEfficiency = energyAllocator.calculateEnergyEfficiency(
      batch.dryingTime || 0,
      moistureRemoved,
      batch.powerUsed || 0
    );
    
    const settlement = {
      id: uuidv4(),
      batchNo,
      batchSnapshot: this._createBatchSnapshot(batch),
      status: SETTLEMENT_STATUS.COMPLETED,
      
      moistureRemoved,
      moistureLossRatio,
      weightLossRatio,
      dryingAmount,
      
      energyCost: energyAllocation.totalEnergyCost,
      fuelCost: energyAllocation.directCost.fuelCost,
      powerCost: energyAllocation.directCost.powerCost,
      directEnergyCost: energyAllocation.directCost.totalDirectCost,
      sharedEnergyCost: energyAllocation.sharedCost.indirectCost || 0,
      
      baseAmount,
      moistureReductionAmount,
      serviceFee,
      settlementAmount,
      
      energyEfficiency,
      hasEnergyAnomaly: energyAllocation.hasAnomaly,
      energyAnomalies: energyAllocation.anomalies,
      
      calculateTime: new Date().toISOString(),
      rollbackTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dataStore.saveSettlement(settlement);
    this.batchService.updateBatchStatus(batchNo, Batch.STATUS.SETTLED);
    
    return settlement;
  }
  
  listSettlements(status = null) {
    let settlements = dataStore.getSettlements();
    if (status) {
      settlements = settlements.filter(s => s.status === status);
    }
    return settlements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  
  getSettlementById(id) {
    return dataStore.getSettlementById(id);
  }
  
  getSettlementByBatch(batchNo) {
    return dataStore.getSettlementByBatch(batchNo);
  }
  
  rollbackSettlement(batchNo) {
    const settlement = dataStore.getSettlementByBatch(batchNo);
    if (!settlement) {
      throw new Error(`未找到批次 ${batchNo} 的有效结算单`);
    }
    
    if (settlement.status !== SETTLEMENT_STATUS.COMPLETED) {
      throw new Error(`结算状态为 ${settlement.status}，无法撤销`);
    }
    
    settlement.status = SETTLEMENT_STATUS.ROLLBACK;
    settlement.rollbackTime = new Date().toISOString();
    settlement.updatedAt = new Date().toISOString();
    
    dataStore.saveSettlement(settlement);
    this.batchService.updateBatchStatus(batchNo, Batch.STATUS.APPROVED);
    
    return settlement;
  }
  
  generateSettlementReport(batchNo) {
    const settlement = this.getSettlementByBatch(batchNo);
    if (!settlement) {
      throw new Error(`未找到批次 ${batchNo} 的结算单`);
    }
    
    const batch = this.batchService.getBatchByNo(batchNo);
    if (!batch) {
      throw new Error(`未找到批次: ${batchNo}`);
    }
    
    return {
      settlementId: settlement.id,
      batchNo: settlement.batchNo,
      grainType: batch.grainType,
      
      inputData: {
        weight: batch.inWeight,
        moisture: batch.inMoisture,
        temp: batch.inTemp
      },
      
      outputData: {
        weight: batch.outWeight,
        moisture: batch.outMoisture,
        temp: batch.outTemp
      },
      
      metrics: {
        moistureRemoved: settlement.moistureRemoved.toFixed(2),
        moistureLossRatio: settlement.moistureLossRatio.toFixed(2),
        weightLossRatio: settlement.weightLossRatio.toFixed(2),
        dryingAmount: settlement.dryingAmount.toFixed(2)
      },
      
      costs: {
        fuelCost: settlement.fuelCost.toFixed(2),
        powerCost: settlement.powerCost.toFixed(2),
        directCost: settlement.directEnergyCost.toFixed(2),
        sharedCost: settlement.sharedEnergyCost.toFixed(2),
        totalEnergyCost: settlement.energyCost.toFixed(2)
      },
      
      settlement: {
        baseAmount: settlement.baseAmount.toFixed(2),
        moistureReductionAmount: settlement.moistureReductionAmount.toFixed(2),
        serviceFee: settlement.serviceFee.toFixed(2),
        total: settlement.settlementAmount.toFixed(2)
      },
      
      efficiency: {
        rating: settlement.energyEfficiency.rating,
        timePerPercent: settlement.energyEfficiency.timePerPercent.toFixed(2),
        energyPerKgWater: settlement.energyEfficiency.energyPerKgWater.toFixed(2)
      },
      
      calculateTime: settlement.calculateTime,
      status: settlement.status
    };
  }
  
  _createBatchSnapshot(batch) {
    return {
      batchNo: batch.batchNo,
      grainType: batch.grainType,
      inWeight: batch.inWeight,
      inMoisture: batch.inMoisture,
      outWeight: batch.outWeight,
      outMoisture: batch.outMoisture,
      dryingTime: batch.dryingTime,
      fuelUsed: batch.fuelUsed,
      powerUsed: batch.powerUsed,
      version: batch.version
    };
  }
  
  _shouldSimulateTimeout(allowRetry) {
    if (allowRetry) {
      return Math.random() > 0.7;
    }
    return false;
  }
}

SettlementService.STATUS = SETTLEMENT_STATUS;

module.exports = SettlementService;
