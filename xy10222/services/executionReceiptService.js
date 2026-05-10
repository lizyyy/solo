const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const petService = require('./petService');
const medicationPlanService = require('./medicationPlanService');

class ExecutionReceiptService {
  createExecutionReceipt(receiptData) {
    const pet = petService.getPetById(receiptData.petId);
    if (!pet) {
      throw new Error(`找不到 ID 为 "${receiptData.petId}" 的宠物`);
    }

    const plan = medicationPlanService.getMedicationPlanById(receiptData.planId);
    if (!plan) {
      throw new Error(`找不到 ID 为 "${receiptData.planId}" 的喂药计划`);
    }

    this.validateExecutionReceipt(receiptData, plan);

    const receipt = {
      id: uuidv4(),
      ...receiptData,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 验证剂量是否符合计划
    if (receipt.actualDosage !== plan.dosage) {
      receipt.dosageVariance = {
        planned: plan.dosage,
        actual: receipt.actualDosage,
        variance: receipt.actualDosage - plan.dosage
      };
    }

    return store.addExecutionReceipt(receipt);
  }

  validateExecutionReceipt(receiptData, plan) {
    if (!receiptData.executedBy) {
      throw new Error('缺少必填字段：执行人');
    }
    if (!receiptData.actualDosage) {
      throw new Error('缺少必填字段：实际剂量');
    }
    if (!receiptData.executionTime) {
      throw new Error('缺少必填字段：执行时间');
    }

    // 检查禁食约束
    if (plan.fastingInstructions && plan.fastingInstructions.required) {
      const executionTime = new Date(receiptData.executionTime);
      const lastMealTime = receiptData.lastMealTime ? new Date(receiptData.lastMealTime) : null;

      if (!lastMealTime) {
        throw new Error('该药物需要禁食，必须提供上次进食时间');
      }

      const hoursSinceMeal = (executionTime - lastMealTime) / (1000 * 60 * 60);
      if (hoursSinceMeal < plan.fastingInstructions.hoursBefore) {
        throw new Error(`禁食时间不足：需要 ${plan.fastingInstructions.hoursBefore} 小时，实际只有 ${hoursSinceMeal.toFixed(1)} 小时`);
      }
    }
  }

  getExecutionReceiptById(receiptId) {
    return store.getExecutionReceiptById(receiptId);
  }

  getExecutionReceiptsByPlanId(planId) {
    return store.getExecutionReceiptsByPlanId(planId);
  }

  getExecutionReceiptsByPetId(petId) {
    return store.getExecutionReceiptsByPetId(petId);
  }

  correctExecutionReceipt(receiptId, corrections) {
    const receipt = store.getExecutionReceiptById(receiptId);
    if (!receipt) {
      throw new Error(`找不到 ID 为 "${receiptId}" 的执行回执`);
    }

    const correctionRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      correctedBy: corrections.correctedBy,
      originalValues: {},
      newValues: {},
      reason: corrections.reason
    };

    const allowedFields = ['actualDosage', 'notes', 'compliance', 'executionTime'];
    allowedFields.forEach(field => {
      if (corrections[field] !== undefined && corrections[field] !== receipt[field]) {
        correctionRecord.originalValues[field] = receipt[field];
        correctionRecord.newValues[field] = corrections[field];
      }
    });

    if (Object.keys(correctionRecord.originalValues).length === 0) {
      throw new Error('没有需要修正的字段');
    }

    const existingCorrections = receipt.corrections || [];
    const updatedCorrections = [...existingCorrections, correctionRecord];

    const updates = {
      corrections: updatedCorrections,
      updatedAt: new Date().toISOString()
    };

    allowedFields.forEach(field => {
      if (corrections[field] !== undefined) {
        updates[field] = corrections[field];
      }
    });

    return store.updateExecutionReceipt(receiptId, updates);
  }
}

module.exports = new ExecutionReceiptService();
