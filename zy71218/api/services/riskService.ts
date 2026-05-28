import { CaseDAO, RiskReportDAO } from '../dao/index.js';
import { auditService } from './auditService.js';
import { versionService } from './versionService.js';
import type {
  BusinessCase,
  RiskLevel,
  RiskDashboardStats,
  RegressionAnalysis,
  User,
  BusinessDataType,
  RiskReport,
} from '../../shared/types.js';

function generateId(): string {
  return `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const riskService = {
  async getDashboardStats(period?: string): Promise<RiskDashboardStats> {
    const stats = await CaseDAO.getStats();
    
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    return {
      totalCases: stats.totalCases,
      overdueCases: stats.overdueCases,
      totalAmount: stats.totalAmount,
      overdueAmount: stats.overdueAmount,
      highRiskCases: stats.highRiskCases,
      inCollectionCases: stats.inCollectionCases,
    };
  },

  async compareVersions(
    recordId: string,
    version1: number,
    version2: number,
    recordType: BusinessDataType = 'invoice'
  ) {
    return await versionService.compareVersions(recordId, recordType, version1, version2);
  },

  async analyzeRegression(businessNo?: string): Promise<RegressionAnalysis[]> {
    if (businessNo) {
      const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
      if (!caseInfo) {
        throw new Error(`案件不存在: ${businessNo}`);
      }

      const versionHistory = await versionService.getVersionHistory(businessNo, 'invoice');
      
      const statusChanges = versionHistory
        .filter(v => {
          const after = v.afterData ? JSON.parse(v.afterData) : {};
          const before = v.beforeData ? JSON.parse(v.beforeData) : {};
          return before.currentStatus !== after.currentStatus;
        })
        .map(v => {
          const after = JSON.parse(v.afterData || '{}');
          const before = JSON.parse(v.beforeData || '{}');
          return {
            fromStatus: before.currentStatus,
            toStatus: after.currentStatus,
            timestamp: v.timestamp,
            operator: v.operatorName,
            reason: v.changeReason,
          };
        });

      const reverseTransitions = statusChanges.filter(
        c => c.fromStatus && c.toStatus && ['overdue', 'in_collection', 'legal_action', 're_overdue'].includes(c.fromStatus) &&
          ['normal_repayment', 'confirmed'].includes(c.toStatus)
      );

      const escalations = statusChanges.filter(
        c => c.fromStatus && c.toStatus && ['overdue', 'in_collection', 'legal_action', 're_overdue'].includes(c.toStatus)
      );

      const regressionType = reverseTransitions.length > 0 
        ? 'status_reverse' 
        : (escalations.length > 0 ? 'payment_revoked' : 'confirmation_withdrawn');
      
      return [{
        businessNo,
        regressionType,
        analysis: `该案件存在 ${escalations.length} 次状态升级，${reverseTransitions.length} 次状态逆转`,
        impactScope: [businessNo],
        suggestions: riskService.generateRegressionRecommendations(reverseTransitions, escalations),
        affectedAmount: caseInfo.totalAmount,
      }];
    }

    const allCases = await CaseDAO.list({}, 1, 100);
    const results: RegressionAnalysis[] = [];

    for (const caseInfo of allCases.list) {
      const versionHistory = await versionService.getVersionHistory(caseInfo.businessNo, 'invoice');
      
      const statusChanges = versionHistory
        .filter(v => {
          const after = v.afterData ? JSON.parse(v.afterData) : {};
          const before = v.beforeData ? JSON.parse(v.beforeData) : {};
          return before.currentStatus !== after.currentStatus;
        })
        .map(v => {
          const after = JSON.parse(v.afterData || '{}');
          const before = JSON.parse(v.beforeData || '{}');
          return {
            fromStatus: before.currentStatus,
            toStatus: after.currentStatus,
            timestamp: v.timestamp,
            operator: v.operatorName,
            reason: v.changeReason,
          };
        });

      const reverseTransitions = statusChanges.filter(
        c => c.fromStatus && c.toStatus && ['overdue', 'in_collection', 'legal_action', 're_overdue'].includes(c.fromStatus) &&
          ['normal_repayment', 'confirmed'].includes(c.toStatus)
      );

      const escalations = statusChanges.filter(
        c => c.fromStatus && c.toStatus && ['overdue', 'in_collection', 'legal_action', 're_overdue'].includes(c.toStatus)
      );

      if (reverseTransitions.length > 0 || escalations.length > 0) {
        const regressionType = reverseTransitions.length > 0 
          ? 'status_reverse' 
          : (escalations.length > 0 ? 'payment_revoked' : 'confirmation_withdrawn');
        
        results.push({
          businessNo: caseInfo.businessNo,
          regressionType,
          analysis: `该案件存在 ${escalations.length} 次状态升级，${reverseTransitions.length} 次状态逆转`,
          impactScope: [caseInfo.businessNo],
          suggestions: riskService.generateRegressionRecommendations(reverseTransitions, escalations),
          affectedAmount: caseInfo.totalAmount,
        });
      }
    }

    return results;
  },

  generateRegressionRecommendations(
    reverseTransitions: any[],
    escalations: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (reverseTransitions.length > 0) {
      recommendations.push('该案件存在多次从不良状态恢复的情况，建议加强后续监控');
      recommendations.push('分析之前恢复成功的因素，总结经验应用于其他案件');
    }

    if (escalations.length > 2) {
      recommendations.push('该案件状态升级频繁，建议采取更激进的催收措施');
      recommendations.push('考虑启动法律程序前的准备工作');
    }

    if (reverseTransitions.length > 0 && escalations.length > 2) {
      recommendations.push('该案件波动性较大，建议提高检查频率');
    }

    if (recommendations.length === 0) {
      recommendations.push('案件状态稳定，按常规流程处理即可');
    }

    return recommendations;
  },

  calculateRiskLevel(caseData: Partial<BusinessCase>): RiskLevel {
    let score = 0;
    const factors: string[] = [];

    if (caseData.overdueDays !== undefined) {
      if (caseData.overdueDays > 90) {
        score += 40;
        factors.push('逾期超过90天');
      } else if (caseData.overdueDays > 60) {
        score += 30;
        factors.push('逾期60-90天');
      } else if (caseData.overdueDays > 30) {
        score += 20;
        factors.push('逾期30-60天');
      } else if (caseData.overdueDays > 0) {
        score += 10;
        factors.push('逾期1-30天');
      }
    }

    if (caseData.currentStatus) {
      switch (caseData.currentStatus) {
        case 'legal_action':
          score += 35;
          factors.push('已进入法律程序');
          break;
        case 'in_collection':
          score += 25;
          factors.push('正在催收中');
          break;
        case 're_overdue':
          score += 30;
          factors.push('再次逾期');
          break;
        case 'overdue':
          score += 15;
          factors.push('首次逾期');
          break;
      }
    }

    if (caseData.totalAmount !== undefined) {
      if (caseData.totalAmount > 5000000) {
        score += 20;
        factors.push('金额超过500万');
      } else if (caseData.totalAmount > 1000000) {
        score += 10;
        factors.push('金额100-500万');
      }
    }

    if (score >= 70) {
      return 'critical';
    } else if (score >= 50) {
      return 'high';
    } else if (score >= 25) {
      return 'medium';
    }
    return 'low';
  },

  async updateRiskLevel(businessNo: string, operator: User): Promise<RiskLevel> {
    if (!businessNo) {
      throw new Error('业务编号不能为空');
    }

    const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
    if (!caseInfo) {
      throw new Error(`案件不存在: ${businessNo}`);
    }

    const newRiskLevel = riskService.calculateRiskLevel(caseInfo);

    if (newRiskLevel !== caseInfo.riskLevel) {
      const beforeData = { ...caseInfo };
      caseInfo.riskLevel = newRiskLevel;
      
      await CaseDAO.updateStatus(businessNo, caseInfo.currentStatus, newRiskLevel);
      
      await versionService.saveVersion(
        businessNo,
        'invoice',
        beforeData,
        caseInfo,
        operator,
        `自动更新风险等级: ${beforeData.riskLevel} -> ${newRiskLevel}`
      );

      await auditService.logAction(
        operator.id,
        operator.name,
        'update_risk_level',
        'case',
        businessNo,
        `风险等级变更: ${beforeData.riskLevel} -> ${newRiskLevel}`,
      );
    }

    return newRiskLevel;
  },

  async generateRiskReport(businessNo: string, operator: User): Promise<RiskReport> {
    if (!businessNo) {
      throw new Error('业务编号不能为空');
    }

    const caseInfo = await CaseDAO.findByBusinessNo(businessNo);
    if (!caseInfo) {
      throw new Error(`案件不存在: ${businessNo}`);
    }

    const riskLevel = riskService.calculateRiskLevel(caseInfo);
    const regressionAnalysisList = await riskService.analyzeRegression(businessNo);
    const regressionAnalysis = regressionAnalysisList[0];

    const factors: string[] = [];
    if (caseInfo.overdueDays && caseInfo.overdueDays > 0) {
      factors.push(`逾期 ${caseInfo.overdueDays} 天`);
    }
    if (regressionAnalysis?.analysis?.includes('升级')) {
      factors.push('存在历史状态升级');
    }
    if (regressionAnalysis?.analysis?.includes('逆转')) {
      factors.push('存在历史状态逆转');
    }

    const id = generateId();
    
    const report = await RiskReportDAO.create({
      id,
      businessNo,
      riskLevel,
      reportDate: new Date().toISOString(),
      analyst: operator.name,
      keyFindings: factors.join('; '),
      recommendations: regressionAnalysis?.suggestions?.join('; ') || '',
    });

    await auditService.logAction(
      operator.id,
      operator.name,
      'generate_risk_report',
      'risk_report',
      businessNo,
      `生成风险报告，风险等级: ${riskLevel}`,
    );

    return report;
  },
};

export default riskService;
