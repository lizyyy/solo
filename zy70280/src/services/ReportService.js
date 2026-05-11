const { RepairOrder, ImpactAnalysis, Community, Hospital, PriorityUser, Valve, FireHydrant } = require('../models');

class ReportService {
  static async generateWaterOutageReport(repairOrderId) {
    const order = await RepairOrder.findByPk(repairOrderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    const analysis = order.impactAnalysisId 
      ? await ImpactAnalysis.findByPk(order.impactAnalysisId)
      : null;
    
    if (!analysis) {
      throw new Error('缺少影响分析数据');
    }
    
    const communities = JSON.parse(analysis.affectedCommunities || '[]');
    const hospitals = JSON.parse(analysis.affectedHospitals || '[]');
    const fireHydrants = JSON.parse(analysis.affectedFireHydrants || '[]');
    const priorityUsers = JSON.parse(analysis.affectedPriorityUsers || '[]');
    const closedValves = JSON.parse(analysis.closedValveIds || '[]');
    const warnings = JSON.parse(analysis.warningFlags || '[]');
    
    const valveDetails = await Valve.findAll({
      where: { id: closedValves }
    });
    
    const report = {
      reportId: `RPT${Date.now().toString().slice(-10)}`,
      generatedAt: new Date().toISOString(),
      orderInfo: {
        id: order.id,
        title: order.title,
        description: order.description,
        faultLocation: order.faultLocation,
        faultType: order.faultType,
        priority: order.priority,
        status: order.status,
        reportSource: order.reportSource
      },
      timeline: {
        reportedAt: order.reportedTime,
        assignedAt: order.assignedTime,
        startedAt: order.startTime,
        estimatedEnd: order.estimatedEndTime,
        actualEnd: order.actualEndTime
      },
      affectedCommunities: {
        count: communities.length,
        totalHouseholds: analysis.totalAffectedHouseholds,
        totalPopulation: analysis.totalAffectedPopulation,
        details: communities.map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          households: c.households,
          population: c.population,
          contact: c.contactPerson,
          phone: c.contactPhone
        }))
      },
      affectedHospitals: {
        count: hospitals.length,
        details: hospitals.map(h => ({
          id: h.id,
          name: h.name,
          address: h.address,
          level: h.level,
          beds: h.beds,
          hasIcu: h.hasIcu,
          backupWater: h.backupWater,
          contact: h.contactPerson,
          phone: h.contactPhone
        }))
      },
      affectedFireHydrants: {
        count: fireHydrants.length,
        details: fireHydrants.map(f => ({
          id: f.id,
          location: f.location,
          type: f.type,
          status: f.status
        }))
      },
      affectedPriorityUsers: {
        count: priorityUsers.length,
        details: priorityUsers.map(u => ({
          id: u.id,
          name: u.name,
          type: u.type,
          priorityLevel: u.priorityLevel,
          address: u.address,
          contact: u.contactPerson,
          phone: u.contactPhone
        }))
      },
      closedValves: {
        count: valveDetails.length,
        details: valveDetails.map(v => ({
          id: v.id,
          name: v.name,
          location: v.location,
          type: v.type,
          diameter: v.diameter
        }))
      },
      warnings: warnings,
      analysisStatus: analysis.status
    };
    
    return report;
  }
  
  static async getDailyReport(date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const orders = await RepairOrder.findAll({
      where: {
        reportedTime: {
          [require('sequelize').Op.between]: [startDate, endDate]
        }
      },
      order: [['priority', 'ASC']]
    });
    
    let totalAffectedHouseholds = 0;
    let totalAffectedPopulation = 0;
    const summaries = [];
    
    for (const order of orders) {
      const analysis = order.impactAnalysisId 
        ? await ImpactAnalysis.findByPk(order.impactAnalysisId)
        : null;
      
      if (analysis) {
        totalAffectedHouseholds += analysis.totalAffectedHouseholds;
        totalAffectedPopulation += analysis.totalAffectedPopulation;
      }
      
      summaries.push({
        id: order.id,
        title: order.title,
        priority: order.priority,
        status: order.status,
        affectedHouseholds: analysis?.totalAffectedHouseholds || 0,
        affectedPopulation: analysis?.totalAffectedPopulation || 0
      });
    }
    
    return {
      date: date.toISOString().split('T')[0],
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inProgressOrders: orders.filter(o => o.status === 'in_progress').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      totalAffectedHouseholds,
      totalAffectedPopulation,
      orders: summaries
    };
  }
}

module.exports = ReportService;