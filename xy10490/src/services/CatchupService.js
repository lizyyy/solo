const { MaintenancePlan, MaintenanceRecord, Equipment } = require('../models');
const { generatePlanId, generateRecordId } = require('../utils/idGenerator');
const MaintenanceStatus = require('./MaintenanceStatus');

class CatchupService {
  async performCatchup(equipmentId, catchupData) {
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }

    const overduePlans = await MaintenancePlan.find({
      equipmentId,
      status: 'overdue'
    }).sort({ createdAt: 1 });

    if (overduePlans.length === 0) {
      const error = new Error('该设备没有超期保养计划');
      error.statusCode = 400;
      throw error;
    }

    const completedDate = new Date();
    const completedHours = equipment.currentRunningHours;
    const completedResults = [];

    for (const overduePlan of overduePlans) {
      overduePlan.status = 'completed';
      overduePlan.actualHours = completedHours;
      overduePlan.actualDate = completedDate;
      overduePlan.completedBy = catchupData.completedBy;
      overduePlan.completedAt = completedDate;
      overduePlan.completedNotes = `补做确认: ${catchupData.notes || '完成补做保养'}`;
      overduePlan.reminderEnabled = false;

      await overduePlan.save();

      await MaintenanceRecord.create({
        recordId: generateRecordId(),
        equipmentId: overduePlan.equipmentId,
        planId: overduePlan._id,
        maintenanceType: 'catchup',
        runningHours: completedHours,
        completedBy: catchupData.completedBy,
        completedAt: completedDate,
        status: 'completed',
        notes: catchupData.notes
      });

      completedResults.push(overduePlan);
    }

    const lastOverduePlan = overduePlans[overduePlans.length - 1];
    const MaintenancePlanService = require('./MaintenancePlanService');
    const nextPlan = await MaintenancePlanService.createNextPlan(
      equipment,
      lastOverduePlan,
      completedHours,
      completedDate
    );

    return {
      completedPlans: completedResults,
      nextPlan,
      equipment
    };
  }
}

module.exports = new CatchupService();
