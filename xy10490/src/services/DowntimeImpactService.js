const { DowntimeImpact, Equipment, MaintenancePlan } = require('../models');
const { generateImpactId } = require('../utils/idGenerator');

class DowntimeImpactService {
  async recordImpact(equipmentId, impactData) {
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }

    let planId = null;
    let maintenanceType = 'preventive';

    if (impactData.planId) {
      const plan = await MaintenancePlan.findById(impactData.planId);
      if (plan) {
        planId = plan._id;
        if (plan.status === 'overdue') {
          maintenanceType = 'overdue';
        }
      }
    }

    let durationMinutes = null;
    if (impactData.endTime && impactData.startTime) {
      durationMinutes = Math.floor(
        (new Date(impactData.endTime) - new Date(impactData.startTime)) / (1000 * 60)
      );
    }

    const impact = await DowntimeImpact.create({
      impactId: generateImpactId(),
      equipmentId,
      planId,
      maintenanceType,
      startTime: impactData.startTime,
      endTime: impactData.endTime,
      durationMinutes,
      affectedProductionLine: equipment.productionLine,
      impactDescription: impactData.impactDescription,
      estimatedLoss: impactData.estimatedLoss,
      reportedBy: impactData.reportedBy
    });

    return impact;
  }

  async getImpactsByEquipment(equipmentId, filters = {}) {
    const query = { equipmentId };
    if (filters.startTime) query.startTime = { $gte: new Date(filters.startTime) };
    if (filters.endTime) query.startTime.$lte = new Date(filters.endTime);
    if (filters.maintenanceType) query.maintenanceType = filters.maintenanceType;

    return await DowntimeImpact.find(query).sort({ startTime: -1 });
  }

  async updateImpactEndTime(impactId, endTime) {
    const impact = await DowntimeImpact.findById(impactId);
    if (!impact) {
      const error = new Error('停机记录不存在');
      error.statusCode = 404;
      throw error;
    }

    impact.endTime = endTime || new Date();
    impact.durationMinutes = Math.floor(
      (new Date(impact.endTime) - new Date(impact.startTime)) / (1000 * 60)
    );

    await impact.save();
    return impact;
  }
}

module.exports = new DowntimeImpactService();
