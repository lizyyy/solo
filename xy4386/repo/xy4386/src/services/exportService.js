const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const config = require('../config');
const store = require('../data/store');
const riskService = require('./riskService');
const reviewService = require('./reviewService');

class ExportService {
  constructor() {
    this.exportsDir = config.data.exportsDir;
    this.ensureExportsDirectory();
  }

  ensureExportsDirectory() {
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  getRiskTypeDescription(type) {
    const descriptions = {
      'oxygen_recovery_insufficient': '氧浓度回升不足',
      'temperature_humidity_out_of_bounds': '温湿度越界',
      'access_control_repair_not_closed': '门禁维修未闭环',
      'duplicate_rack_retrieval': '同一密集架重复调阅',
      'personnel_qualification_mismatch': '人员资质不匹配'
    };
    return descriptions[type] || type;
  }

  getSeverityDescription(severity) {
    const descriptions = {
      'critical': '严重',
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return descriptions[severity] || severity;
  }

  getDecisionDescription(decision) {
    const descriptions = {
      'confirm': '确认风险',
      'dismiss': '驳回风险',
      'escalate': '升级处理'
    };
    return descriptions[decision] || decision;
  }

  generateMarkdownReleaseNote(date = null) {
    const warehouses = store.getAllWarehouses();
    const tasks = date ? store.getTasksByDate(date) : store.getAllTasks();
    const risks = riskService.getAllRisks();
    const reviews = reviewService.getAllReviews();

    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    let markdown = `# 档案馆低氧库房开库放行单\n\n`;
    markdown += `> 生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    markdown += `> 开库日期: ${targetDate}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 一、库房基本情况\n\n`;
    if (warehouses.length === 0) {
      markdown += `暂无库房数据\n\n`;
    } else {
      warehouses.forEach(warehouse => {
        markdown += `### ${warehouse.warehouseName} (${warehouse.warehouseId})\n\n`;
        markdown += `- 测量记录数: ${warehouse.measurements?.length || 0} 条\n`;
        markdown += `- 门禁维修记录数: ${warehouse.repairs?.length || 0} 条\n`;
        
        if (warehouse.measurements && warehouse.measurements.length > 0) {
          const latest = warehouse.measurements
            .sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())[0];
          markdown += `- 最新测量数据: 氧浓度 ${latest.oxygen}%, 温度 ${latest.temperature}°C, 湿度 ${latest.humidity}%\n`;
        }
        markdown += `\n`;
      });
    }

    markdown += `---\n\n`;
    markdown += `## 二、今日调阅任务\n\n`;
    
    if (tasks.length === 0) {
      markdown += `今日无调阅任务\n\n`;
    } else {
      markdown += `| 任务编号 | 库房 | 密集架 | 调阅人员 | 资质情况 |\n`;
      markdown += `|---------|------|--------|----------|----------|\n`;
      
      tasks.forEach(task => {
        const warehouse = store.getWarehouse(task.warehouseId);
        const warehouseName = warehouse ? warehouse.warehouseName : task.warehouseId;
        const personnelNames = task.personnel?.map(p => p.name).join('、') || '-';
        const invalidCount = task.personnel?.filter(p => 
          !config.personnel.validQualifications.includes(p.qualification)
        ).length || 0;
        const status = invalidCount > 0 ? `⚠️ ${invalidCount}人资质异常` : '✅ 正常';
        
        markdown += `| ${task.taskId} | ${warehouseName} | ${task.rackId} | ${personnelNames} | ${status} |\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `## 三、风险检测结果\n\n`;
    
    const pendingRisks = risks.filter(r => r.status === 'pending');
    const reviewedRisks = risks.filter(r => r.status === 'reviewed');
    
    markdown += `### 风险统计\n\n`;
    markdown += `- 待复核风险: ${pendingRisks.length} 项\n`;
    markdown += `- 已复核风险: ${reviewedRisks.length} 项\n\n`;

    if (risks.length > 0) {
      const byType = {};
      const bySeverity = {};
      
      risks.forEach(risk => {
        byType[risk.type] = (byType[risk.type] || 0) + 1;
        bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
      });

      markdown += `#### 按风险类型统计\n\n`;
      for (const [type, count] of Object.entries(byType)) {
        markdown += `- ${this.getRiskTypeDescription(type)}: ${count} 项\n`;
      }
      markdown += `\n`;

      markdown += `#### 按严重程度统计\n\n`;
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      for (const severity of severityOrder) {
        if (bySeverity[severity]) {
          markdown += `- ${this.getSeverityDescription(severity)}: ${bySeverity[severity]} 项\n`;
        }
      }
      markdown += `\n`;
    }

    if (pendingRisks.length > 0) {
      markdown += `### 待复核风险清单\n\n`;
      markdown += `| 风险ID | 类型 | 严重程度 | 描述 | 检测时间 |\n`;
      markdown += `|--------|------|----------|------|----------|\n`;
      
      pendingRisks.forEach(risk => {
        const typeDesc = this.getRiskTypeDescription(risk.type);
        const severityDesc = this.getSeverityDescription(risk.severity);
        const detectedTime = dayjs(risk.detectedAt).format('MM-DD HH:mm');
        
        markdown += `| ${risk.riskId} | ${typeDesc} | ${severityDesc} | ${risk.description} | ${detectedTime} |\n`;
      });
      markdown += `\n`;
    }

    if (reviewedRisks.length > 0) {
      markdown += `### 已复核风险清单\n\n`;
      markdown += `| 风险ID | 类型 | 复核决定 | 复核人 | 复核时间 |\n`;
      markdown += `|--------|------|----------|--------|----------|\n`;
      
      reviewedRisks.forEach(risk => {
        const typeDesc = this.getRiskTypeDescription(risk.type);
        const decisionDesc = this.getDecisionDescription(risk.reviewDecision);
        const reviewedTime = risk.reviewedAt ? 
          dayjs(risk.reviewedAt).format('MM-DD HH:mm') : '-';
        
        markdown += `| ${risk.riskId} | ${typeDesc} | ${decisionDesc} | ${risk.reviewerName || '-'} | ${reviewedTime} |\n`;
      });
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `## 四、开库放行结论\n\n`;

    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const highRisks = risks.filter(r => r.severity === 'high');
    const unaddressedCritical = criticalRisks.filter(r => 
      r.status === 'pending' || r.reviewDecision === 'confirm'
    );
    const unaddressedHigh = highRisks.filter(r => 
      r.status === 'pending' || r.reviewDecision === 'confirm'
    );

    if (unaddressedCritical.length > 0) {
      markdown += `### ❌ 禁止开库\n\n`;
      markdown += `存在 ${unaddressedCritical.length} 项**严重**风险未处理，禁止开库。\n\n`;
      markdown += `请立即处理以下风险：\n\n`;
      unaddressedCritical.forEach(risk => {
        markdown += `- ${this.getRiskTypeDescription(risk.type)}: ${risk.description}\n`;
      });
    } else if (unaddressedHigh.length > 0) {
      markdown += `### ⚠️ 需主管审批后开库\n\n`;
      markdown += `存在 ${unaddressedHigh.length} 项**高风险**未处理，需主管审批后才能开库。\n\n`;
      markdown += `待处理风险：\n\n`;
      unaddressedHigh.forEach(risk => {
        markdown += `- ${this.getRiskTypeDescription(risk.type)}: ${risk.description}\n`;
      });
    } else if (pendingRisks.length > 0) {
      markdown += `### ⚠️ 建议复核后开库\n\n`;
      markdown += `存在 ${pendingRisks.length} 项待复核风险，建议完成复核后再开库。\n\n`;
    } else {
      markdown += `### ✅ 允许开库\n\n`;
      markdown += `所有风险已复核且无未处理的高/严重风险，**允许开库**。\n\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `## 五、审计信息\n\n`;
    markdown += `- 数据生成时间: ${dayjs().toISOString()}\n`;
    markdown += `- 库房总数: ${warehouses.length}\n`;
    markdown += `- 调阅任务数: ${tasks.length}\n`;
    markdown += `- 风险总数: ${risks.length}\n`;
    markdown += `- 复核记录数: ${reviews.length}\n\n`;

    return markdown;
  }

  generateJsonAuditPackage(date = null) {
    const warehouses = store.getAllWarehouses();
    const tasks = date ? store.getTasksByDate(date) : store.getAllTasks();
    const risks = riskService.getAllRisks();
    const reviews = reviewService.getAllReviews();

    const auditPackage = {
      version: '1.0.0',
      generatedAt: dayjs().toISOString(),
      targetDate: date || dayjs().format('YYYY-MM-DD'),
      
      summary: {
        warehouseCount: warehouses.length,
        taskCount: tasks.length,
        riskCount: risks.length,
        reviewCount: reviews.length,
        pendingRisks: risks.filter(r => r.status === 'pending').length,
        confirmedRisks: risks.filter(r => r.reviewDecision === 'confirm').length,
        dismissedRisks: risks.filter(r => r.reviewDecision === 'dismiss').length,
        escalatedRisks: risks.filter(r => r.reviewDecision === 'escalate').length
      },

      warehouses: warehouses.map(w => ({
        warehouseId: w.warehouseId,
        warehouseName: w.warehouseName,
        measurementCount: w.measurements?.length || 0,
        repairCount: w.repairs?.length || 0,
        latestMeasurement: w.measurements?.length > 0 ? 
          w.measurements.sort((a, b) => 
            dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()
          )[0] : null
      })),

      tasks: tasks.map(t => ({
        taskId: t.taskId,
        warehouseId: t.warehouseId,
        date: t.date,
        rackId: t.rackId,
        personnelCount: t.personnel?.length || 0,
        personnel: t.personnel
      })),

      risks: risks.map(r => ({
        riskId: r.riskId,
        type: r.type,
        typeDescription: this.getRiskTypeDescription(r.type),
        severity: r.severity,
        severityDescription: this.getSeverityDescription(r.severity),
        warehouseId: r.warehouseId,
        description: r.description,
        details: r.details,
        status: r.status,
        detectedAt: r.detectedAt,
        reviewedAt: r.reviewedAt,
        reviewDecision: r.reviewDecision,
        reviewDecisionDescription: r.reviewDecision ? 
          this.getDecisionDescription(r.reviewDecision) : null,
        reviewComments: r.reviewComments,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewerName
      })),

      reviews: reviews.map(r => ({
        reviewId: r.reviewId,
        riskId: r.riskId,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewerName,
        decision: r.decision,
        decisionDescription: this.getDecisionDescription(r.decision),
        comments: r.comments,
        timestamp: r.timestamp
      })),

      releaseDecision: this.calculateReleaseDecision(risks)
    };

    return auditPackage;
  }

  calculateReleaseDecision(risks) {
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const highRisks = risks.filter(r => r.severity === 'high');
    
    const unaddressedCritical = criticalRisks.filter(r => 
      r.status === 'pending' || r.reviewDecision === 'confirm'
    );
    const unaddressedHigh = highRisks.filter(r => 
      r.status === 'pending' || r.reviewDecision === 'confirm'
    );
    const pendingRisks = risks.filter(r => r.status === 'pending');

    if (unaddressedCritical.length > 0) {
      return {
        canRelease: false,
        reason: '存在严重风险未处理',
        unaddressedCriticalCount: unaddressedCritical.length,
        unaddressedHighCount: unaddressedHigh.length,
        pendingCount: pendingRisks.length
      };
    }

    if (unaddressedHigh.length > 0) {
      return {
        canRelease: false,
        reason: '存在高风险，需主管审批',
        unaddressedCriticalCount: 0,
        unaddressedHighCount: unaddressedHigh.length,
        pendingCount: pendingRisks.length,
        requiresApproval: true
      };
    }

    if (pendingRisks.length > 0) {
      return {
        canRelease: true,
        reason: '建议复核后开库',
        unaddressedCriticalCount: 0,
        unaddressedHighCount: 0,
        pendingCount: pendingRisks.length,
        warning: true
      };
    }

    return {
      canRelease: true,
      reason: '允许开库',
      unaddressedCriticalCount: 0,
      unaddressedHighCount: 0,
      pendingCount: 0
    };
  }

  async exportMarkdown(date = null) {
    try {
      const markdown = this.generateMarkdownReleaseNote(date);
      const timestamp = dayjs().format('YYYYMMDD_HHmmss');
      const fileName = `开库放行单_${timestamp}.md`;
      const filePath = path.join(this.exportsDir, fileName);
      
      fs.writeFileSync(filePath, markdown, 'utf8');
      
      return {
        success: true,
        fileName,
        filePath,
        content: markdown
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async exportJsonAudit(date = null) {
    try {
      const auditPackage = this.generateJsonAuditPackage(date);
      const timestamp = dayjs().format('YYYYMMDD_HHmmss');
      const fileName = `审计包_${timestamp}.json`;
      const filePath = path.join(this.exportsDir, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(auditPackage, null, 2), 'utf8');
      
      return {
        success: true,
        fileName,
        filePath,
        content: auditPackage
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async exportBoth(date = null) {
    const markdownResult = await this.exportMarkdown(date);
    const jsonResult = await this.exportJsonAudit(date);
    
    return {
      markdown: markdownResult,
      json: jsonResult,
      success: markdownResult.success && jsonResult.success
    };
  }
}

module.exports = new ExportService();
