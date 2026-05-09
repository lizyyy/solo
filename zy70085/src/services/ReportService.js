const { Op, fn, col, literal } = require('sequelize');
const {
  OccupationApplication, RoadSection, ExtensionApplication,
  WithdrawalApplication, FineRecord, FineRule
} = require('../models');
const {
  ApplicationStatus, ExtensionStatus, WithdrawalStatus, FineStatus
} = require('../constants/status');

class ReportService {
  static async getDashboardStats() {
    const [
      totalApplications,
      pendingApprovals,
      inProgress,
      completed,
      activeFines,
      overdueApplications
    ] = await Promise.all([
      OccupationApplication.count(),
      OccupationApplication.count({
        where: { status: ApplicationStatus.SUBMITTED }
      }),
      OccupationApplication.count({
        where: { status: ApplicationStatus.IN_PROGRESS }
      }),
      OccupationApplication.count({
        where: { status: { [Op.in]: [ApplicationStatus.COMPLETED, ApplicationStatus.CLOSED] } }
      }),
      FineRecord.count({
        where: {
          isActive: true,
          status: { [Op.notIn]: [FineStatus.PAID, FineStatus.WAIVED] }
        }
      }),
      OccupationApplication.count({
        where: {
          status: { [Op.in]: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.EXTENSION_REJECTED] },
          endDate: { [Op.lt]: new Date() }
        }
      })
    ]);

    return {
      summary: {
        totalApplications,
        pendingApprovals,
        inProgress,
        completed,
        activeFines,
        overdueApplications
      }
    };
  }

  static async getApplicationStatusBreakdown() {
    const results = await OccupationApplication.findAll({
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    return results.map(r => ({
      status: r.status,
      count: parseInt(r.count, 10)
    }));
  }

  static async getRoadSectionUtilization() {
    const sections = await RoadSection.findAll({
      include: [{
        model: OccupationApplication,
        as: 'applications',
        where: {
          status: { [Op.in]: [ApplicationStatus.APPROVED, ApplicationStatus.IN_PROGRESS] }
        },
        required: false
      }]
    });

    return sections.map(section => {
      const occupiedLength = section.totalLength - section.availableLength;
      const utilizationRate = section.totalLength > 0
        ? (occupiedLength / section.totalLength * 100).toFixed(2)
        : 0;

      return {
        roadSectionId: section.id,
        roadName: section.roadName,
        sectionName: section.sectionName,
        totalLength: section.totalLength,
        availableLength: section.availableLength,
        occupiedLength,
        utilizationRate: parseFloat(utilizationRate),
        status: section.status,
        activeApplications: section.applications ? section.applications.length : 0
      };
    });
  }

  static async getContractorStatistics(contractorId) {
    const applications = await OccupationApplication.findAll({
      where: { contractorId },
      include: [
        { model: ExtensionApplication, as: 'extensions' },
        { model: WithdrawalApplication, as: 'withdrawals' },
        { model: FineRecord, as: 'fines' }
      ]
    });

    const totalApplications = applications.length;
    const approvedCount = applications.filter(
      a => [ApplicationStatus.APPROVED, ApplicationStatus.IN_PROGRESS, ApplicationStatus.COMPLETED, ApplicationStatus.CLOSED].includes(a.status)
    ).length;
    const totalExtensions = applications.reduce((sum, a) => sum + (a.extensions?.length || 0), 0);
    const totalFines = applications.reduce((sum, a) => sum + (a.fines?.length || 0), 0);
    const totalFineAmount = applications.reduce((sum, a) => {
      return sum + (a.fines || []).reduce((fsum, f) => fsum + parseFloat(f.totalAmount), 0);
    }, 0);

    return {
      contractorId,
      statistics: {
        totalApplications,
        approvedCount,
        approvalRate: totalApplications > 0 ? (approvedCount / totalApplications * 100).toFixed(2) : 0,
        totalExtensions,
        totalFines,
        totalFineAmount: totalFineAmount.toFixed(2)
      }
    };
  }

  static async getFineStatistics(startDate, endDate) {
    const where = {
      createdAt: { [Op.between]: [startDate, endDate] }
    };

    const fines = await FineRecord.findAll({
      where,
      include: [{ model: FineRule, as: 'fineRule' }]
    });

    const byType = {};
    const byStatus = {};
    let totalAmount = 0;
    let collectedAmount = 0;

    for (const fine of fines) {
      const ruleType = fine.ruleType || 'UNKNOWN';
      if (!byType[ruleType]) {
        byType[ruleType] = { count: 0, amount: 0 };
      }
      byType[ruleType].count++;
      byType[ruleType].amount += parseFloat(fine.totalAmount);

      if (!byStatus[fine.status]) {
        byStatus[fine.status] = { count: 0, amount: 0 };
      }
      byStatus[fine.status].count++;
      byStatus[fine.status].amount += parseFloat(fine.totalAmount);

      totalAmount += parseFloat(fine.totalAmount);

      if (fine.status === FineStatus.PAID) {
        collectedAmount += parseFloat(fine.totalAmount);
      }
    }

    return {
      period: { startDate, endDate },
      summary: {
        totalFines: fines.length,
        totalAmount: totalAmount.toFixed(2),
        collectedAmount: collectedAmount.toFixed(2),
        collectionRate: totalAmount > 0 ? (collectedAmount / totalAmount * 100).toFixed(2) : 0
      },
      byType,
      byStatus
    };
  }

  static async getOverdueReport() {
    const now = new Date();
    const overdueApplications = await OccupationApplication.findAll({
      where: {
        status: { [Op.in]: [ApplicationStatus.IN_PROGRESS, ApplicationStatus.EXTENSION_REJECTED] },
        endDate: { [Op.lt]: now },
        hasActiveExtension: false
      },
      include: [
        { model: RoadSection, as: 'roadSection' },
        { model: FineRecord, as: 'fines' }
      ]
    });

    const results = overdueApplications.map(app => {
      const overdueDays = Math.floor((now - new Date(app.endDate)) / (1000 * 60 * 60 * 24));
      const activeFines = (app.fines || []).filter(f => f.isActive && f.status !== FineStatus.PAID && f.status !== FineStatus.WAIVED);

      return {
        applicationId: app.id,
        applicationNo: app.applicationNo,
        contractorId: app.contractorId,
        contractorName: app.contractorName,
        projectName: app.projectName,
        roadName: app.roadSection?.roadName,
        sectionName: app.roadSection?.sectionName,
        status: app.status,
        originalEndDate: app.originalEndDate,
        currentEndDate: app.endDate,
        overdueDays,
        hasActiveFine: app.hasActiveFine,
        activeFineCount: activeFines.length,
        totalFineAmount: activeFines.reduce((sum, f) => sum + parseFloat(f.totalAmount), 0).toFixed(2)
      };
    });

    return {
      generatedAt: now,
      totalOverdue: results.length,
      applications: results
    };
  }

  static async getInspectionReport() {
    const pendingInspections = await WithdrawalApplication.findAll({
      where: {
        status: {
          [Op.in]: [
            WithdrawalStatus.PENDING,
            WithdrawalStatus.INSPECTING,
            WithdrawalStatus.REINSPECTION_PENDING
          ]
        }
      },
      include: [
        {
          model: OccupationApplication,
          as: 'occupationApplication',
          include: [{ model: RoadSection, as: 'roadSection' }]
        }
      ],
      order: [['submittedAt', 'ASC']]
    });

    const results = pendingInspections.map(wi => ({
      withdrawalId: wi.id,
      applicationNo: wi.applicationNo,
      status: wi.status,
      submittedAt: wi.submittedAt,
      inspectionDate: wi.inspectionDate,
      reapplicationCount: wi.reapplicationCount,
      projectName: wi.occupationApplication?.projectName,
      contractorName: wi.occupationApplication?.contractorName,
      roadName: wi.occupationApplication?.roadSection?.roadName,
      sectionName: wi.occupationApplication?.roadSection?.sectionName
    }));

    return {
      generatedAt: new Date(),
      totalPending: results.length,
      inspections: results
    };
  }

  static async generateFullReport() {
    const [
      dashboard,
      statusBreakdown,
      utilization,
      overdue,
      inspections
    ] = await Promise.all([
      this.getDashboardStats(),
      this.getApplicationStatusBreakdown(),
      this.getRoadSectionUtilization(),
      this.getOverdueReport(),
      this.getInspectionReport()
    ]);

    return {
      generatedAt: new Date(),
      dashboard,
      statusBreakdown,
      roadSectionUtilization: utilization,
      overdueReport: overdue,
      pendingInspections: inspections
    };
  }
}

module.exports = {
  ReportService
};
