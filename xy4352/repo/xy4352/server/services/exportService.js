const dayjs = require('dayjs');
const { Op } = require('sequelize');
const { Risk, ReviewRecord, DisposalRecord, WaterSample } = require('../models');
const { WATER_QUALITY_STANDARDS, getParameterStatus } = require('../config/waterQualityStandards');

const RISK_TYPE_MAP = {
  'CONTINUOUS_ANOMALY': '连续异常',
  'REPEATED_OVERLIMIT': '反复超标',
  'NO_RECOVERY_AFTER_TREATMENT': '补药后未恢复'
};

const SEVERITY_MAP = {
  'LOW': '低',
  'MEDIUM': '中',
  'HIGH': '高',
  'CRITICAL': '严重'
};

const STATUS_MAP = {
  'PENDING': '待处理',
  'REVIEWING': '复核中',
  'RESOLVED': '已解决',
  'DISMISSED': '已忽略',
  'REVISED': '已改判'
};

const PARAMETER_NAME_MAP = {
  'chlorine': '余氯',
  'ph': 'pH值',
  'turbidity': '浊度',
  'temperature': '水温'
};

const DISPOSAL_TYPE_MAP = {
  'CHLORINE_ADD': '加氯',
  'PH_ADJUST': '调pH',
  'FILTER_BACKWASH': '反冲洗过滤',
  'WATER_REPLACE': '换水',
  'ALGAECIDE_ADD': '加除藻剂',
  'OTHER': '其他'
};

const EFFECT_ASSESSMENT_MAP = {
  'EXCELLENT': '优秀',
  'GOOD': '良好',
  'FAIR': '一般',
  'POOR': '差',
  'UNKNOWN': '未知'
};

class ExportService {
  static async generateMarkdownHandover(options = {}) {
    const { date = new Date(), operator = '值班员', includeResolved = false } = options;
    
    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();
    
    const riskWhereClause = includeResolved 
      ? {} 
      : { status: { [Op.in]: ['PENDING', 'REVIEWING'] } };
    
    const risks = await Risk.findAll({
      where: riskWhereClause,
      include: [
        {
          model: ReviewRecord,
          as: 'reviews',
          separate: true,
          order: [['reviewedAt', 'DESC']]
        },
        {
          model: DisposalRecord,
          as: 'disposals',
          separate: true,
          order: [['disposedAt', 'DESC']]
        }
      ],
      order: [
        ['severity', 'DESC'],
        ['detectionTime', 'DESC']
      ]
    });
    
    const todayStats = await this.getTodayStatistics(startOfDay, endOfDay);
    
    let markdown = `# 游泳池水质巡检交接单\n\n`;
    markdown += `> 生成时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n`;
    markdown += `> 值班人员：${operator}\n`;
    markdown += `> 交接日期：${dayjs(date).format('YYYY年MM月DD日')}\n\n`;
    
    markdown += `---\n\n`;
    
    markdown += `## 今日统计\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 导入采样数据 | ${todayStats.importedCount} 条 |\n`;
    markdown += `| 新发现风险 | ${todayStats.newRiskCount} 个 |\n`;
    markdown += `| 已处理风险 | ${todayStats.resolvedCount} 个 |\n`;
    markdown += `| 待处理风险 | ${todayStats.pendingCount} 个 |\n\n`;
    
    markdown += `---\n\n`;
    
    const pendingRisks = risks.filter(r => r.status === 'PENDING' || r.status === 'REVIEWING');
    const resolvedRisks = risks.filter(r => r.status === 'RESOLVED');
    const dismissedRisks = risks.filter(r => r.status === 'DISMISSED');
    const revisedRisks = risks.filter(r => r.status === 'REVISED');
    
    if (pendingRisks.length > 0) {
      markdown += `## 待处理风险 (${pendingRisks.length}个)\n\n`;
      
      for (const risk of pendingRisks) {
        markdown += `### 风险 #${risk.id} - ${RISK_TYPE_MAP[risk.riskType]}\n\n`;
        markdown += `- **严重程度**：${SEVERITY_MAP[risk.severity]}\n`;
        markdown += `- **当前状态**：${STATUS_MAP[risk.status]}\n`;
        markdown += `- **采样点**：${risk.samplePoint}\n`;
        markdown += `- **受影响参数**：${PARAMETER_NAME_MAP[risk.affectedParameter]}\n`;
        markdown += `- **检测时间**：${dayjs(risk.detectionTime).format('YYYY-MM-DD HH:mm:ss')}\n`;
        markdown += `- **描述**：${risk.description}\n\n`;
        
        if (risk.reviews && risk.reviews.length > 0) {
          markdown += `#### 复核记录\n\n`;
          for (const review of risk.reviews) {
            markdown += `- **${dayjs(review.reviewedAt).format('HH:mm')}** - ${review.reviewer}：${review.comment || '无备注'}\n`;
          }
          markdown += `\n`;
        }
        
        if (risk.disposals && risk.disposals.length > 0) {
          markdown += `#### 处置记录\n\n`;
          for (const disposal of risk.disposals) {
            markdown += `- **${dayjs(disposal.disposedAt).format('HH:mm')}** - ${disposal.disposer}：`;
            markdown += `${DISPOSAL_TYPE_MAP[disposal.disposalType]}`;
            if (disposal.disposalAmount) {
              markdown += ` ${disposal.disposalAmount} ${disposal.disposalUnit || ''}`;
            }
            if (disposal.description) {
              markdown += ` - ${disposal.description}`;
            }
            markdown += `\n`;
          }
          markdown += `\n`;
        }
        
        markdown += `---\n\n`;
      }
    }
    
    if (resolvedRisks.length > 0) {
      markdown += `## 已解决风险 (${resolvedRisks.length}个)\n\n`;
      markdown += `| 风险ID | 类型 | 采样点 | 处理人员 | 解决时间 |\n`;
      markdown += `|--------|------|--------|----------|----------|\n`;
      for (const risk of resolvedRisks) {
        const lastDisposal = risk.disposals && risk.disposals.length > 0 ? risk.disposals[0] : null;
        markdown += `| ${risk.id} | ${RISK_TYPE_MAP[risk.riskType]} | ${risk.samplePoint} | ${lastDisposal?.disposer || '-'} | ${lastDisposal ? dayjs(lastDisposal.disposedAt).format('MM-DD HH:mm') : '-'} |\n`;
      }
      markdown += `\n`;
    }
    
    if (revisedRisks.length > 0) {
      markdown += `## 已改判风险 (${revisedRisks.length}个)\n\n`;
      markdown += `| 风险ID | 类型 | 采样点 | 改判人员 | 改判原因 |\n`;
      markdown += `|--------|------|--------|----------|----------|\n`;
      for (const risk of revisedRisks) {
        markdown += `| ${risk.id} | ${RISK_TYPE_MAP[risk.riskType]} | ${risk.samplePoint} | ${risk.revisedBy || '-'} | ${risk.revisedReason || '-'} |\n`;
      }
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `## 水质标准参考\n\n`;
    markdown += `| 参数 | 标准范围 | 单位 |\n`;
    markdown += `|------|----------|------|\n`;
    for (const [key, standard] of Object.entries(WATER_QUALITY_STANDARDS)) {
      markdown += `| ${standard.name} | ${standard.min} ~ ${standard.max} | ${standard.unit || '-'} |\n`;
    }
    markdown += `\n`;
    
    markdown += `---\n\n`;
    markdown += `## 交接备注\n\n`;
    markdown += `_请在此处填写额外的交接说明..._\n\n`;
    markdown += `---\n\n`;
    markdown += `> 本交接单由系统自动生成，所有数据已保存至本地数据库。\n`;
    
    return {
      content: markdown,
      filename: `水质巡检交接单_${dayjs(date).format('YYYYMMDD')}.md`
    };
  }

  static async generateJsonAuditPackage(options = {}) {
    const { startDate, endDate, includeAllData = false } = options;
    
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.detectionTime = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    const risks = await Risk.findAll({
      where: whereClause,
      include: [
        {
          model: ReviewRecord,
          as: 'reviews',
          separate: true,
          order: [['reviewedAt', 'ASC']]
        },
        {
          model: DisposalRecord,
          as: 'disposals',
          separate: true,
          order: [['disposedAt', 'ASC']]
        }
      ],
      order: [['detectionTime', 'ASC']]
    });
    
    const allSampleIds = new Set();
    risks.forEach(risk => {
      risk.affectedSampleIds.forEach(id => allSampleIds.add(id));
    });
    
    const samples = await WaterSample.findAll({
      where: includeAllData ? {} : { id: { [Op.in]: Array.from(allSampleIds) } },
      order: [['sampleTime', 'ASC']]
    });
    
    const statistics = {
      totalRisks: risks.length,
      byType: {},
      bySeverity: {},
      byStatus: {},
      bySamplePoint: {}
    };
    
    risks.forEach(risk => {
      statistics.byType[risk.riskType] = (statistics.byType[risk.riskType] || 0) + 1;
      statistics.bySeverity[risk.severity] = (statistics.bySeverity[risk.severity] || 0) + 1;
      statistics.byStatus[risk.status] = (statistics.byStatus[risk.status] || 0) + 1;
      statistics.bySamplePoint[risk.samplePoint] = (statistics.bySamplePoint[risk.samplePoint] || 0) + 1;
    });
    
    const auditPackage = {
      metadata: {
        packageType: 'water-quality-audit',
        generatedAt: new Date().toISOString(),
        version: '1.0',
        timeRange: startDate && endDate ? {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        } : null,
        includeAllData
      },
      statistics,
      standards: WATER_QUALITY_STANDARDS,
      samples: samples.map(s => ({
        id: s.id,
        samplePoint: s.samplePoint,
        sampleTime: s.sampleTime,
        chlorine: s.chlorine,
        ph: s.ph,
        turbidity: s.turbidity,
        temperature: s.temperature,
        operator: s.operator,
        sourceFile: s.sourceFile,
        importTime: s.importTime
      })),
      risks: risks.map(risk => ({
        id: risk.id,
        riskType: risk.riskType,
        riskTypeName: RISK_TYPE_MAP[risk.riskType],
        samplePoint: risk.samplePoint,
        affectedSampleIds: risk.affectedSampleIds,
        affectedParameter: risk.affectedParameter,
        affectedParameterName: PARAMETER_NAME_MAP[risk.affectedParameter],
        startTime: risk.startTime,
        endTime: risk.endTime,
        severity: risk.severity,
        severityName: SEVERITY_MAP[risk.severity],
        status: risk.status,
        statusName: STATUS_MAP[risk.status],
        detectionTime: risk.detectionTime,
        description: risk.description,
        revisedStatus: risk.revisedStatus,
        revisedReason: risk.revisedReason,
        revisedBy: risk.revisedBy,
        revisedAt: risk.revisedAt,
        treatmentResult: risk.treatmentResult,
        treatedBy: risk.treatedBy,
        treatedAt: risk.treatedAt,
        reviews: risk.reviews?.map(r => ({
          id: r.id,
          reviewer: r.reviewer,
          reviewType: r.reviewType,
          reviewResult: r.reviewResult,
          comment: r.comment,
          reviewedAt: r.reviewedAt
        })) || [],
        disposals: risk.disposals?.map(d => ({
          id: d.id,
          disposer: d.disposer,
          disposalType: d.disposalType,
          disposalTypeName: DISPOSAL_TYPE_MAP[d.disposalType],
          disposalAmount: d.disposalAmount,
          disposalUnit: d.disposalUnit,
          beforeValue: d.beforeValue,
          targetValue: d.targetValue,
          afterValue: d.afterValue,
          description: d.description,
          effectAssessment: d.effectAssessment,
          effectAssessmentName: EFFECT_ASSESSMENT_MAP[d.effectAssessment],
          disposedAt: d.disposedAt
        })) || []
      }))
    };
    
    return {
      content: JSON.stringify(auditPackage, null, 2),
      filename: `水质审计包_${dayjs().format('YYYYMMDD_HHmmss')}.json`
    };
  }

  static async getTodayStatistics(startOfDay, endOfDay) {
    const importedCount = await WaterSample.count({
      where: {
        importTime: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    const newRiskCount = await Risk.count({
      where: {
        detectionTime: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    const resolvedCount = await Risk.count({
      where: {
        status: 'RESOLVED',
        treatedAt: {
          [Op.between]: [startOfDay, endOfDay]
        }
      }
    });
    
    const pendingCount = await Risk.count({
      where: {
        status: {
          [Op.in]: ['PENDING', 'REVIEWING']
        }
      }
    });
    
    return {
      importedCount,
      newRiskCount,
      resolvedCount,
      pendingCount
    };
  }
}

module.exports = ExportService;
