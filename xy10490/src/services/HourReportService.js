const { HourReport, Equipment, MaintenancePlan } = require('../models');
const { generateHourReportId } = require('../utils/idGenerator');
const MaintenanceStatus = require('./MaintenanceStatus');

class HourReportService {
  async reportHours(equipmentId, reportData) {
    const Equipment = require('../models').Equipment;
    
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      const error = new Error('设备不存在');
      error.statusCode = 404;
      throw error;
    }

    const { runningHours } = reportData;
    const previousHours = equipment.currentRunningHours;
    
    if (runningHours < previousHours) {
      const error = new Error('上报的运行小时数不能小于当前值');
      error.statusCode = 400;
      throw error;
    }

    const existingReport = await HourReport.findOne({
      equipmentId,
      runningHours
    });

    if (existingReport) {
      return {
        report: existingReport,
        equipment,
        isDuplicate: true,
        message: '重复上报，已返回已有记录'
      };
    }

    const deltaHours = runningHours - previousHours;

    const report = await HourReport.create({
      reportId: generateHourReportId(),
      equipmentId,
      runningHours,
      reportTime: reportData.reportTime || new Date(),
      reportedBy: reportData.reportedBy,
      previousHours,
      deltaHours,
      isDuplicate: false,
      notes: reportData.notes
    });

    equipment.currentRunningHours = runningHours;
    equipment.lastReportTime = report.reportTime;
    await equipment.save();

    await this.checkAndUpdateOverduePlans(equipment);

    return {
      report,
      equipment,
      isDuplicate: false,
      deltaHours
    };
  }

  async checkAndUpdateOverduePlans(equipment) {
    const MaintenancePlan = require('../models').MaintenancePlan;
    
    const pendingPlans = await MaintenancePlan.find({
      equipmentId: equipment.equipmentId,
      status: 'pending'
    });

    for (const plan of pendingPlans) {
      const statusInfo = MaintenanceStatus.getMaintenanceStatus(
        plan,
        equipment.currentRunningHours,
        new Date()
      );

      if (statusInfo.overdue) {
        plan.status = 'overdue';
        plan.reminderEnabled = true;
        await plan.save();
      }
    }
  }

  async getHourReports(equipmentId, filters = {}) {
    const query = { equipmentId };
    if (filters.startDate || filters.endDate) {
      query.reportTime = {};
      if (filters.startDate) query.reportTime.$gte = new Date(filters.startDate);
      if (filters.endDate) query.reportTime.$lte = new Date(filters.endDate);
    }

    return await HourReport.find(query).sort({ reportTime: -1 });
  }
}

module.exports = new HourReportService();
