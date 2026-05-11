const { Equipment, MaintenancePlan, MaintenanceRecord, HourReport, SkipRequest, DowntimeImpact
} = require('../models');
const MaintenanceStatus = require('./MaintenanceStatus');

class QueryService {
  async getEquipmentMaintenanceStatus(equipmentId) {
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }

    const currentPlans = await MaintenancePlan.find({
      equipmentId,
      status: { $in: ['pending', 'overdue'] }
    }).sort({ createdAt: 1 });

    const statuses = currentPlans.map(plan => {
      const statusInfo = MaintenanceStatus.getMaintenanceStatus(
        plan,
        equipment.currentRunningHours,
        new Date()
      );
      return {
        plan: plan.toObject(),
        ...statusInfo
      };
    });

    const overduePlans = statuses.filter(s => s.status === 'overdue');
    overduePlans.sort((a, b) => {
      if (a.plan.cycleType === 'hour') return b.overdueHours - a.overdueHours;
      return b.overdueDays - a.overdueDays;
    });

    const totalOverdueHours = overduePlans.reduce((sum, s) => sum + (s.overdueHours || 0), 0);
    const totalOverdueDays = overduePlans.reduce((sum, s) => sum + (s.overdueDays || 0), 0);

    const hasOverdue = overduePlans.length > 0;
    const latestOverdue = overduePlans.length > 0 ? overduePlans[0] : null;

    let overallStatus = 'no_plan';
    if (hasOverdue) {
      overallStatus = 'overdue';
    } else if (currentPlans.length > 0) {
      overallStatus = 'normal';
    }

    return {
      equipment: equipment.toObject(),
      overallStatus,
      hasOverdue,
      overdueCount: overduePlans.length,
      totalOverdueHours,
      totalOverdueDays,
      reminderEnabled: currentPlans.some(p => p.plan.reminderEnabled),
      currentPlans: statuses,
      latestOverdue
    };
  }

  async getMaintenanceHistory(equipmentId, limit = 50) {
    const records = await MaintenanceRecord.find({ equipmentId })
      .sort({ completedAt: -1 })
      .limit(limit);

    const plans = await MaintenancePlan.find({
      _id: { $in: records.map(r => r.planId) }
    });

    const planMap = new Map(plans.map(p => [p._id.toString(), p.toObject()]));

    return records.map(record => {
      const recordObj = record.toObject();
      return {
        ...recordObj,
        plan: planMap.get(record.planId.toString())
      };
    });
  }

  async getOverdueEquipment(filters = {}) {
    const equipment = await Equipment.find({ status: 'active' });
    const results = [];

    for (const eq of equipment) {
      const status = await this.getEquipmentMaintenanceStatus(eq.equipmentId);
      results.push(status);
    }

    if (filters.onlyOverdue) {
      return results.filter(s => s.hasOverdue);
    }

    return results;
  }

  async getEquipmentStatusSummary() {
    const equipment = await Equipment.find();
    const summary = [];

    for (const eq of equipment) {
      const status = await this.getEquipmentMaintenanceStatus(eq.equipmentId);
      summary.push(status);
    }

    const overdueEquipment = summary.filter(s => s.hasOverdue);
    const normalEquipment = summary.filter(s => !s.hasOverdue && s.currentPlans.length > 0);

    const overdueLines = new Set(overdueEquipment.map(s => s.equipment.productionLine));

    return {
      totalEquipment: equipment.length,
      overdueCount: overdueEquipment.length,
      normalCount: normalEquipment.length,
      affectedProductionLines: Array.from(overdueLines),
      equipmentStatuses: summary
    };
  }

  async getProductionLineStatus(productionLine) {
    const equipment = await Equipment.find({ productionLine });
    const lineStatus = [];

    for (const eq of equipment) {
      const status = await this.getEquipmentMaintenanceStatus(eq.equipmentId);
      lineStatus.push(status);
    }

    const hasOverdue = lineStatus.some(s => s.hasOverdue);

    return {
      productionLine,
      equipmentCount: equipment.length,
      hasOverdue,
      equipmentStatuses: lineStatus
    };
  }

  async getAffectedProductionLines() {
    const equipment = await Equipment.find({ status: 'active' });
    const affectedLines = new Set();

    for (const eq of equipment) {
      const status = await this.getEquipmentMaintenanceStatus(eq.equipmentId);
      if (status.hasOverdue) {
        affectedLines.add(eq.productionLine);
      }
    }

    return {
      affectedProductionLines: Array.from(affectedLines)
    };
  }
}

module.exports = new QueryService();
