const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const petService = require('./petService');

class MedicationPlanService {
  createMedicationPlan(planData) {
    const pet = petService.getPetById(planData.petId);
    if (!pet) {
      throw new Error(`找不到 ID 为 "${planData.petId}" 的宠物`);
    }

    this.validateMedicationPlan(planData);

    const plan = {
      id: uuidv4(),
      ...planData,
      status: 'active',
      progress: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return store.addMedicationPlan(plan);
  }

  validateMedicationPlan(planData) {
    if (!planData.medicationName) {
      throw new Error('缺少必填字段：药物名称');
    }
    if (!planData.dosage) {
      throw new Error('缺少必填字段：剂量');
    }
    if (!planData.frequency) {
      throw new Error('缺少必填字段：频率');
    }
    if (!planData.startDate) {
      throw new Error('缺少必填字段：开始日期');
    }
    if (!planData.endDate) {
      throw new Error('缺少必填字段：结束日期');
    }

    if (new Date(planData.startDate) > new Date(planData.endDate)) {
      throw new Error('开始日期不能晚于结束日期');
    }
  }

  getMedicationPlanById(planId) {
    return store.getMedicationPlanById(planId);
  }

  getMedicationPlansByPetId(petId) {
    return store.getMedicationPlansByPetId(petId);
  }

  updateMedicationPlan(planId, updates) {
    const existingPlan = store.getMedicationPlanById(planId);
    if (!existingPlan) {
      throw new Error(`找不到 ID 为 "${planId}" 的喂药计划`);
    }

    const updatedPlan = { ...existingPlan, ...updates };
    this.validateMedicationPlan(updatedPlan);

    return store.updateMedicationPlan(planId, updates);
  }

  advancePlan(planId, executionData) {
    const plan = store.getMedicationPlanById(planId);
    if (!plan) {
      throw new Error(`找不到 ID 为 "${planId}" 的喂药计划`);
    }

    if (plan.status !== 'active') {
      throw new Error(`喂药计划状态为 "${plan.status}"，无法推进`);
    }

    const progress = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      executedBy: executionData.executedBy,
      actualDosage: executionData.actualDosage || plan.dosage,
      notes: executionData.notes || '',
      compliance: executionData.compliance || 'full'
    };

    const updatedProgress = [...(plan.progress || []), progress];

    return store.updateMedicationPlan(planId, {
      progress: updatedProgress,
      updatedAt: new Date().toISOString()
    });
  }

  withdrawPlan(planId, reason) {
    const plan = store.getMedicationPlanById(planId);
    if (!plan) {
      throw new Error(`找不到 ID 为 "${planId}" 的喂药计划`);
    }

    return store.updateMedicationPlan(planId, {
      status: 'withdrawn',
      withdrawalReason: reason,
      withdrawnAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  correctPlan(planId, corrections) {
    const plan = store.getMedicationPlanById(planId);
    if (!plan) {
      throw new Error(`找不到 ID 为 "${planId}" 的喂药计划`);
    }

    const correctionRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      correctedBy: corrections.correctedBy,
      originalValues: {},
      newValues: {},
      reason: corrections.reason
    };

    const allowedFields = ['dosage', 'frequency', 'medicationName', 'notes', 'fastingInstructions'];
    allowedFields.forEach(field => {
      if (corrections[field] !== undefined && corrections[field] !== plan[field]) {
        correctionRecord.originalValues[field] = plan[field];
        correctionRecord.newValues[field] = corrections[field];
      }
    });

    if (Object.keys(correctionRecord.originalValues).length === 0) {
      throw new Error('没有需要修正的字段');
    }

    const existingCorrections = plan.corrections || [];
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

    return store.updateMedicationPlan(planId, updates);
  }
}

module.exports = new MedicationPlanService();
