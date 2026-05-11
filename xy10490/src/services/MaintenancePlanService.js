const { MaintenancePlan, MaintenanceRecord, Equipment } = require('../models');
const { generatePlanId, generateRecordId } = require('../utils/idGenerator');
const MaintenanceStatus = require('./MaintenanceStatus');

class MaintenancePlanService {
  async createNextPlan(equipment, previousPlan, completedHours, completedDate) {
    const nextPlanData = {
      planId: generatePlanId(),
      equipmentId: equipment.equipmentId,
      cycleType: equipment.maintenanceCycleType,
      cycleValue: equipment.maintenanceCycleValue,
      planType: 'regular',
      status: 'pending',
      reminderEnabled: true,
      previousPlanId: previousPlan ? previousPlan._id : null
    };

    if (equipment.maintenanceCycleType === 'hour') {
      nextPlanData.targetHours = completedHours + equipment.maintenanceCycleValue;
      nextPlanData.deadlineHours = completedHours + equipment.maintenanceCycleValue;
    } else {
      const moment = require('moment');
      const nextDate = moment(completedDate).add(equipment.maintenanceCycleValue, 'days');
      nextPlanData.targetDate = nextDate.toDate();
      nextPlanData.deadlineDate = nextDate.toDate();
    }

    return await MaintenancePlan.create(nextPlanData);
  }

  async createPlanAfterSkip(equipment, skippedPlan) {
    const nextTarget = MaintenanceStatus.calculateNextPlanAfterSkip(equipment, skippedPlan);
    
    const nextPlan = await MaintenancePlan.create({
      planId: generatePlanId(),
      equipmentId: equipment.equipmentId,
      cycleType: equipment.maintenanceCycleType,
      cycleValue: equipment.maintenanceCycleValue,
      planType: 'regular',
      status: 'pending',
      reminderEnabled: true,
      previousPlanId: skippedPlan._id,
      ...nextTarget
    });

    return nextPlan;
  }

  async completeMaintenance(planId, completeData) {
    const plan = await MaintenancePlan.findById(planId);
    if (!plan) {
      const error = new Error('保养计划不存在');
      error.statusCode = 404;
      throw error;
    }

    if (plan.status === 'completed') {
      const error = new Error('该保养计划已完成');
      error.statusCode = 400;
      throw error;
    }

    if (plan.status === 'skipped') {
      const error = new Error('该保养计划已被跳过');
      error.statusCode = 400;
      throw error;
    }

    const equipment = await Equipment.findOne({ equipmentId: plan.equipmentId });
    const completedDate = new Date();
    const completedHours = equipment.currentRunningHours;

    plan.status = 'completed';
    plan.actualHours = completedHours;
    plan.actualDate = completedDate;
    plan.completedBy = completeData.completedBy;
    plan.completedAt = completedDate;
    plan.completedNotes = completeData.notes;
    plan.reminderEnabled = false;

    await plan.save();

    await MaintenanceRecord.create({
      recordId: generateRecordId(),
      equipmentId: plan.equipmentId,
      planId: plan._id,
      maintenanceType: plan.planType,
      runningHours: completedHours,
      completedBy: completeData.completedBy,
      completedAt: completedDate,
      status: 'completed',
      notes: completeData.notes,
      beforeStatus: plan.status
    });

    const nextPlan = await this.createNextPlan(equipment, plan, completedHours, completedDate);

    return {
      completedPlan: plan,
      nextPlan,
      equipment
    };
  }

  async getPendingPlans(equipmentId) {
    const query = { status: { $in: ['pending', 'overdue'] } };
    if (equipmentId) query.equipmentId = equipmentId;
    
    return await MaintenancePlan.find(query).sort({ createdAt: -1 });
  }

  async getPlanById(planId) {
    const plan = await MaintenancePlan.findById(planId);
    if (!plan) {
      const error = new Error('保养计划不存在');
      error.statusCode = 404;
      throw error;
    }
    return plan;
  }

  async getAllPlans(filters = {}) {
    const query = {};
    if (filters.equipmentId) query.equipmentId = filters.equipmentId;
    if (filters.status) query.status = filters.status;
    if (filters.planType) query.planType = filters.planType;

    return await MaintenancePlan.find(query).sort({ createdAt: -1 });
  }
}

module.exports = new MaintenancePlanService();
