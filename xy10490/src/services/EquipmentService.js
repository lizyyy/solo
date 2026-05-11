const { Equipment, MaintenancePlan } = require('../models');
const { generateEquipmentId } = require('../utils/idGenerator');
const MaintenanceStatus = require('./MaintenanceStatus');

class EquipmentService {
  async createEquipment(equipmentData) {
    const existing = await Equipment.findOne({ equipmentId: equipmentData.equipmentId });
    if (existing) {
      const error = new Error('设备ID已存在');
      error.statusCode = 409;
      throw error;
    }

    const equipment = await Equipment.create({
      ...equipmentData,
      currentRunningHours: equipmentData.initialRunningHours || 0
    });

    const initialPlan = await this.createInitialMaintenancePlan(equipment);

    return { equipment, initialPlan };
  }

  async createInitialMaintenancePlan(equipment) {
    const { MaintenancePlan } = require('../models');
    const { generatePlanId } = require('../utils/idGenerator');

    let planData = {
      planId: generatePlanId(),
      equipmentId: equipment.equipmentId,
      cycleType: equipment.maintenanceCycleType,
      cycleValue: equipment.maintenanceCycleValue,
      planType: 'regular',
      status: 'pending',
      reminderEnabled: true
    };

    if (equipment.maintenanceCycleType === 'hour') {
      planData.targetHours = equipment.initialRunningHours + equipment.maintenanceCycleValue;
      planData.deadlineHours = equipment.initialRunningHours + equipment.maintenanceCycleValue;
    } else {
      const moment = require('moment');
      const targetDate = moment().add(equipment.maintenanceCycleValue, 'days');
      planData.targetDate = targetDate.toDate();
      planData.deadlineDate = targetDate.toDate();
    }

    return await MaintenancePlan.create(planData);
  }

  async getEquipmentById(equipmentId) {
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }
    return equipment;
  }

  async getAllEquipment(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.productionLine) query.productionLine = filters.productionLine;

    return await Equipment.find(query).sort({ createdAt: -1 });
  }

  async updateEquipment(equipmentId, updateData) {
    const equipment = await Equipment.findOneAndUpdate(
      { equipmentId },
      { $set: updateData },
      { new: true }
    );
    
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }
    
    return equipment;
  }

  async getEquipmentWithStatus(equipmentId) {
    const equipment = await this.getEquipmentById(equipmentId);
    const MaintenancePlan = require('../models').MaintenancePlan;
    
    const currentPlan = await MaintenancePlan.findOne({
      equipmentId: equipment.equipmentId,
      status: { $in: ['pending', 'overdue'] }
    }).sort({ createdAt: -1 });

    let statusInfo = null;
    if (currentPlan) {
      statusInfo = MaintenanceStatus.getMaintenanceStatus(
        currentPlan,
        equipment.currentRunningHours,
        new Date()
      );
    }

    return {
      ...equipment.toObject(),
      currentMaintenanceStatus: statusInfo,
      currentPlan: currentPlan ? currentPlan.toObject() : null
    };
  }
}

module.exports = new EquipmentService();
