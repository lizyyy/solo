const { ImpactAnalysis, RepairOrder, Community, Hospital, FireHydrant, PriorityUser, Valve } = require('../models');
const TopologyService = require('./TopologyService');

class ImpactService {
  static async createAnalysis(repairOrderId, valveIds, options = {}) {
    const repairOrder = await RepairOrder.findByPk(repairOrderId);
    if (!repairOrder) {
      throw new Error('抢修工单不存在');
    }
    
    for (const valveId of valveIds) {
      const valve = await Valve.findByPk(valveId);
      if (!valve) {
        throw new Error(`阀门 ${valveId} 不存在`);
      }
      if (valve.status === 'closed') {
        throw new Error(`阀门 ${valveId} 已关闭，无法再次操作`);
      }
    }
    
    const impact = await TopologyService.analyzeImpact(valveIds);
    const warningFlags = this.checkWarnings(impact);
    const needsReview = warningFlags.some(flag => flag.critical);
    
    const analysis = await ImpactAnalysis.create({
      id: `ANA${Date.now().toString().slice(-10)}`,
      repairOrderId,
      closedValveIds: JSON.stringify(valveIds),
      affectedCommunities: JSON.stringify(impact.communities),
      affectedHospitals: JSON.stringify(impact.hospitals),
      affectedFireHydrants: JSON.stringify(impact.fireHydrants),
      affectedPriorityUsers: JSON.stringify(impact.priorityUsers),
      totalAffectedHouseholds: impact.totalHouseholds,
      totalAffectedPopulation: impact.totalPopulation,
      status: needsReview ? 'draft' : 'confirmed',
      warningFlags: JSON.stringify(warningFlags),
      needsReview
    });
    
    await repairOrder.update({
      closedValveIds: JSON.stringify(valveIds),
      impactAnalysisId: analysis.id
    });
    
    return analysis;
  }
  
  static checkWarnings(impact) {
    const warnings = [];
    
    const criticalHospitals = impact.hospitals.filter(h => 
      h.level === 'tertiary' && !h.backupWater
    );
    if (criticalHospitals.length > 0) {
      warnings.push({
        type: 'CRITICAL_HOSPITAL',
        message: `影响 ${criticalHospitals.length} 家三级医院且无备用水源`,
        critical: true,
        details: criticalHospitals.map(h => ({ id: h.id, name: h.name }))
      });
    }
    
    const level1Users = impact.priorityUsers.filter(u => u.priorityLevel === '1');
    if (level1Users.length > 0) {
      warnings.push({
        type: 'LEVEL1_PRIORITY_USER',
        message: `影响 ${level1Users.length} 个一级优先级用户`,
        critical: true,
        details: level1Users.map(u => ({ id: u.id, name: u.name, type: u.type }))
      });
    }
    
    const highPopulation = impact.totalPopulation > 5000;
    if (highPopulation) {
      warnings.push({
        type: 'LARGE_SCALE_IMPACT',
        message: `影响人口超过5000人，共 ${impact.totalPopulation} 人`,
        critical: false,
        details: { households: impact.totalHouseholds, population: impact.totalPopulation }
      });
    }
    
    const schoolUsers = impact.priorityUsers.filter(u => u.type === 'school');
    if (schoolUsers.length > 0) {
      warnings.push({
        type: 'SCHOOL_AFFECTED',
        message: `影响 ${schoolUsers.length} 所学校`,
        critical: false,
        details: schoolUsers.map(u => ({ id: u.id, name: u.name }))
      });
    }
    
    return warnings;
  }
  
  static async confirmAnalysis(analysisId, reviewer, notes) {
    const analysis = await ImpactAnalysis.findByPk(analysisId);
    if (!analysis) {
      throw new Error('影响分析不存在');
    }
    
    if (analysis.status === 'final') {
      throw new Error('该分析已最终确认，不可修改');
    }
    
    await analysis.update({
      status: 'confirmed',
      needsReview: false,
      reviewer,
      reviewNotes: notes,
      reviewTime: new Date()
    });
    
    return analysis;
  }
  
  static async updateAnalysis(analysisId, newValveIds) {
    const analysis = await ImpactAnalysis.findByPk(analysisId);
    if (!analysis) {
      throw new Error('影响分析不存在');
    }
    
    if (analysis.status === 'final') {
      throw new Error('该分析已最终确认，不可修改');
    }
    
    for (const valveId of newValveIds) {
      const valve = await Valve.findByPk(valveId);
      if (!valve) {
        throw new Error(`阀门 ${valveId} 不存在`);
      }
    }
    
    const impact = await TopologyService.analyzeImpact(newValveIds);
    const warningFlags = this.checkWarnings(impact);
    const needsReview = warningFlags.some(flag => flag.critical);
    
    await analysis.update({
      closedValveIds: JSON.stringify(newValveIds),
      affectedCommunities: JSON.stringify(impact.communities),
      affectedHospitals: JSON.stringify(impact.hospitals),
      affectedFireHydrants: JSON.stringify(impact.fireHydrants),
      affectedPriorityUsers: JSON.stringify(impact.priorityUsers),
      totalAffectedHouseholds: impact.totalHouseholds,
      totalAffectedPopulation: impact.totalPopulation,
      status: needsReview ? 'draft' : 'updated',
      warningFlags: JSON.stringify(warningFlags),
      needsReview
    });
    
    const repairOrder = await RepairOrder.findByPk(analysis.repairOrderId);
    if (repairOrder) {
      await repairOrder.update({
        closedValveIds: JSON.stringify(newValveIds)
      });
    }
    
    return analysis;
  }
  
  static async finalizeAnalysis(analysisId) {
    const analysis = await ImpactAnalysis.findByPk(analysisId);
    if (!analysis) {
      throw new Error('影响分析不存在');
    }
    
    if (!analysis.reviewer) {
      throw new Error('需要先确认分析结果');
    }
    
    const valveIds = JSON.parse(analysis.closedValveIds || '[]');
    for (const valveId of valveIds) {
      const valve = await Valve.findByPk(valveId);
      if (valve) {
        await valve.update({ status: 'closed' });
      }
    }
    
    await analysis.update({
      status: 'final'
    });
    
    return analysis;
  }
  
  static async getAnalysisById(analysisId) {
    return await ImpactAnalysis.findByPk(analysisId);
  }
  
  static async getAnalysesByRepairOrder(repairOrderId) {
    return await ImpactAnalysis.findAll({
      where: { repairOrderId },
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = ImpactService;