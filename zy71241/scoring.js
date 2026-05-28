// ==========================================
// 3D打印农场调度 - 评分系统与报告生成
// ==========================================

(function() {

let IssueType, ReviewStatus, OrderStatus, SchedulingReport;

if (typeof module !== 'undefined' && module.exports) {
  const models = require('./models');
  ({ IssueType, ReviewStatus, OrderStatus, SchedulingReport } = models);
} else {
  ({ IssueType, ReviewStatus, OrderStatus, SchedulingReport } = window);
}

// 评分配置
const ScoringConfig = {
  baseScore: 100,
  
  onTimeCompletion: 30,
  materialEfficiency: 20,
  noQualityIssues: 20,
  printerUtilization: 15,
  properSetup: 15,
  
  deadlineMissPenalty: 15,
  materialMismatchPenalty: 10,
  nozzleClogPenalty: 8,
  materialRunoutPenalty: 10,
  unsuitableNozzlePenalty: 8,
  printerIdlePenalty: 5,
  
  maxPenaltyPerIssue: 20
};

// 评分引擎类
class ScoringEngine {
  constructor(engine) {
    this.engine = engine;
    this.replayHistory = [];
    this.currentReplayIndex = -1;
  }

  // ========== 评分计算 ==========

  calculateScore() {
    const report = new SchedulingReport();
    const breakdown = {};
    let totalScore = 0;
    let maxPossible = 0;

    maxPossible += ScoringConfig.onTimeCompletion;
    breakdown.onTimeCompletion = this.calculateOnTimeScore();
    totalScore += breakdown.onTimeCompletion;

    maxPossible += ScoringConfig.materialEfficiency;
    breakdown.materialEfficiency = this.calculateMaterialScore();
    totalScore += breakdown.materialEfficiency;

    maxPossible += ScoringConfig.noQualityIssues;
    breakdown.noQualityIssues = this.calculateQualityScore();
    totalScore += breakdown.noQualityIssues;

    maxPossible += ScoringConfig.printerUtilization;
    breakdown.printerUtilization = this.calculateUtilizationScore();
    totalScore += breakdown.printerUtilization;

    maxPossible += ScoringConfig.properSetup;
    breakdown.properSetup = this.calculateSetupScore();
    totalScore += breakdown.properSetup;

    const penalties = this.calculatePenalties();
    breakdown.penalties = penalties;
    totalScore = Math.max(0, totalScore - penalties.total);

    report.totalOrders = this.engine.orders.size;
    report.completedOrders = this.getCompletedOrderCount();
    report.failedOrders = this.getFailedOrderCount();
    report.pendingOrders = this.getPendingOrderCount();
    report.issues = this.engine.issues;
    report.materialUsage = this.calculateMaterialUsage();
    report.printerUtilization = this.calculatePrinterUtilization();
    report.scoreBreakdown = breakdown;
    report.totalScore = Math.round(totalScore);
    report.maxScore = maxPossible;
    report.pendingReviewItems = this.collectPendingReviewItems();
    report.lessonsLearned = this.generateLessonsLearned();

    return report;
  }

  calculateOnTimeScore() {
    const completedOrders = Array.from(this.engine.orders.values())
      .filter(o => o.status === OrderStatus.COMPLETED);
    
    if (completedOrders.length === 0) return 0;

    const onTimeCount = completedOrders.filter(o => !o.isOverdue(this.engine.currentTime)).length;
    const ratio = onTimeCount / completedOrders.length;
    
    return Math.round(ScoringConfig.onTimeCompletion * ratio);
  }

  calculateMaterialScore() {
    const materials = Array.from(this.engine.materials.values());
    if (materials.length === 0) return ScoringConfig.materialEfficiency;

    let totalEfficiency = 0;
    materials.forEach(m => {
      if (m.totalLength > 0) {
        const efficiency = m.remainingLength / m.totalLength;
        totalEfficiency += efficiency;
      }
    });

    const avgEfficiency = totalEfficiency / materials.length;
    return Math.round(ScoringConfig.materialEfficiency * avgEfficiency);
  }

  calculateQualityScore() {
    const issues = this.engine.issues.filter(i => i.severity === 'error');
    const issueCount = issues.length;
    const orderCount = this.engine.orders.size;

    if (orderCount === 0) return ScoringConfig.noQualityIssues;

    const issuesPerOrder = issueCount / orderCount;
    const score = Math.max(0, ScoringConfig.noQualityIssues - (issuesPerOrder * 10));
    
    return Math.round(score);
  }

  calculateUtilizationScore() {
    const printers = Array.from(this.engine.printers.values());
    if (printers.length === 0) return 0;

    let totalUtilization = 0;
    printers.forEach(p => {
      if (p.currentTask) {
        totalUtilization += 1;
      }
    });

    const utilizationRate = totalUtilization / printers.length;
    return Math.round(ScoringConfig.printerUtilization * utilizationRate);
  }

  calculateSetupScore() {
    const printers = Array.from(this.engine.printers.values());
    if (printers.length === 0) return ScoringConfig.properSetup;

    let correctSetups = 0;
    printers.forEach(p => {
      if (p.currentMaterial && p.currentNozzle) {
        correctSetups++;
      }
    });

    const setupRate = correctSetups / printers.length;
    return Math.round(ScoringConfig.properSetup * setupRate);
  }

  calculatePenalties() {
    const penalties = {
      deadlineMiss: 0,
      materialMismatch: 0,
      nozzleClog: 0,
      materialRunout: 0,
      unsuitableNozzle: 0,
      total: 0
    };

    this.engine.issues.forEach(issue => {
      let penalty = 0;
      
      switch (issue.type) {
        case IssueType.DEADLINE_MISS:
          penalty = ScoringConfig.deadlineMissPenalty;
          penalties.deadlineMiss += penalty;
          break;
        case IssueType.MATERIAL_MISMATCH:
          penalty = ScoringConfig.materialMismatchPenalty;
          penalties.materialMismatch += penalty;
          break;
        case IssueType.NOZZLE_CLOG:
          penalty = ScoringConfig.nozzleClogPenalty;
          penalties.nozzleClog += penalty;
          break;
        case IssueType.INSUFFICIENT_MATERIAL:
          penalty = ScoringConfig.materialRunoutPenalty;
          penalties.materialRunout += penalty;
          break;
        case IssueType.UNSUITABLE_NOZZLE:
          penalty = ScoringConfig.unsuitableNozzlePenalty;
          penalties.unsuitableNozzle += penalty;
          break;
      }

      penalties.total += Math.min(penalty, ScoringConfig.maxPenaltyPerIssue);
    });

    return penalties;
  }

  // ========== 统计方法 ==========

  getCompletedOrderCount() {
    return Array.from(this.engine.orders.values())
      .filter(o => o.status === OrderStatus.COMPLETED).length;
  }

  getFailedOrderCount() {
    return Array.from(this.engine.orders.values())
      .filter(o => o.status === OrderStatus.FAILED).length;
  }

  getPendingOrderCount() {
    return Array.from(this.engine.orders.values())
      .filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.PAUSED).length;
  }

  calculateMaterialUsage() {
    const usage = {};
    this.engine.materials.forEach(m => {
      usage[m.id] = {
        type: m.materialType,
        color: m.color,
        total: m.totalLength,
        used: m.totalLength - m.remainingLength,
        remaining: m.remainingLength,
        percentage: m.getRemainingPercentage()
      };
    });
    return usage;
  }

  calculatePrinterUtilization() {
    const utilization = {};
    this.engine.printers.forEach(p => {
      utilization[p.id] = {
        name: p.name,
        status: p.getStatus(),
        currentTask: p.currentTask,
        totalPrintHours: p.totalPrintHours,
        failureCount: p.failureCount,
        hasMaterial: p.currentMaterial !== null,
        hasNozzle: p.currentNozzle !== null
      };
    });
    return utilization;
  }

  // ========== 待复核项目收集 ==========

  collectPendingReviewItems() {
    const items = [];
    
    this.engine.orders.forEach(order => {
      if (order.reviewStatus === ReviewStatus.PENDING_REVIEW) {
        items.push({
          type: 'order',
          id: order.id,
          name: order.name,
          status: order.status,
          notes: order.reviewNotes,
          issues: order.issues.map(i => ({
            type: i.getTypeName(),
            reason: i.reason,
            severity: i.severity
          }))
        });
      }
    });

    this.engine.faultEvents
      .filter(f => !f.resolved)
      .forEach(fault => {
        items.push({
          type: 'fault',
          id: fault.id,
          faultType: fault.getTypeName(),
          severity: fault.getSeverity(),
          printerId: fault.printerId,
          timestamp: fault.timestamp,
          affectedOrders: fault.affectedOrders,
          details: fault.details
        });
      });

    this.engine.nozzles.forEach(nozzle => {
      if (nozzle.needsReplacement()) {
        items.push({
          type: 'nozzle_maintenance',
          id: nozzle.id,
          size: nozzle.size,
          wearPercentage: nozzle.getWearPercentage(),
          clogCount: nozzle.clogCount,
          reason: nozzle.getWearPercentage() >= 90 ? '磨损严重' : '堵塞次数过多'
        });
      }
    });

    this.engine.issues
      .filter(i => !i.resolved && i.severity === 'error')
      .forEach(issue => {
        const hasPendingOrder = issue.affectedObjects.orderId &&
          this.engine.orders.get(issue.affectedObjects.orderId)?.reviewStatus === ReviewStatus.PENDING_REVIEW;
        
        if (!hasPendingOrder) {
          items.push({
            type: 'unresolved_issue',
            issueType: issue.getTypeName(),
            affectedObjects: issue.affectedObjects,
            reason: issue.reason,
            timestamp: issue.timestamp
          });
        }
      });

    return items;
  }

  // ========== 经验教训生成 ==========

  generateLessonsLearned() {
    const lessons = [];
    const issues = this.engine.issues;

    const deadlineMisses = issues.filter(i => i.type === IssueType.DEADLINE_MISS).length;
    if (deadlineMisses > 0) {
      lessons.push({
        category: '时间管理',
        severity: deadlineMisses > 2 ? 'high' : 'medium',
        lesson: `共有 ${deadlineMisses} 次交期超时。建议：1) 提前评估打印时间，2) 优先安排紧急订单，3) 预留缓冲时间应对意外故障。`,
        count: deadlineMisses
      });
    }

    const materialMismatches = issues.filter(i => i.type === IssueType.MATERIAL_MISMATCH).length;
    if (materialMismatches > 0) {
      lessons.push({
        category: '材料管理',
        severity: 'high',
        lesson: `发生 ${materialMismatches} 次材料错配。建议：在安装材料前仔细核对订单要求，使用标签系统区分不同材料类型。`,
        count: materialMismatches
      });
    }

    const nozzleClogs = issues.filter(i => i.type === IssueType.NOZZLE_CLOG).length;
    if (nozzleClogs > 0) {
      lessons.push({
        category: '设备维护',
        severity: 'medium',
        lesson: `发生 ${nozzleClogs} 次喷嘴堵塞。建议：1) 定期清洁喷嘴，2) 监控喷嘴磨损度(超过90%需更换)，3) 使用高质量耗材减少堵塞风险。`,
        count: nozzleClogs
      });
    }

    const materialRunouts = issues.filter(i => i.type === IssueType.INSUFFICIENT_MATERIAL).length;
    if (materialRunouts > 0) {
      lessons.push({
        category: '库存管理',
        severity: 'medium',
        lesson: `发生 ${materialRunouts} 次材料用尽。建议：在开始打印前检查材料剩余量，建立库存预警机制，剩余低于20%时提前准备替换材料。`,
        count: materialRunouts
      });
    }

    const pendingReview = this.collectPendingReviewItems().length;
    if (pendingReview > 0) {
      lessons.push({
        category: '质量管理',
        severity: 'low',
        lesson: `有 ${pendingReview} 项待复核记录。请及时处理这些项目，确保问题得到妥善解决，避免影响后续生产。`,
        count: pendingReview
      });
    }

    if (lessons.length === 0) {
      lessons.push({
        category: '整体表现',
        severity: 'low',
        lesson: '本次调度表现良好，没有发生严重问题。继续保持良好的调度习惯，定期检查设备状态和材料库存。',
        count: 0
      });
    }

    return lessons;
  }

  // ========== 回放功能 ==========

  recordState() {
    const state = {
      timestamp: new Date(this.engine.currentTime),
      orders: Array.from(this.engine.orders.values()).map(o => ({
        id: o.id,
        name: o.name,
        status: o.status,
        issues: o.issues.length,
        progress: this.engine.scheduledTasks.get(o.id)?.progress || 0
      })),
      printers: Array.from(this.engine.printers.values()).map(p => ({
        id: p.id,
        name: p.name,
        status: p.getStatus(),
        currentTask: p.currentTask
      })),
      issues: this.engine.issues.map(i => ({
        type: i.getTypeName(),
        severity: i.severity,
        reason: i.reason
      }))
    };
    this.replayHistory.push(state);
    this.currentReplayIndex = this.replayHistory.length - 1;
    return state;
  }

  getReplayState(index) {
    if (index < 0 || index >= this.replayHistory.length) return null;
    this.currentReplayIndex = index;
    return this.replayHistory[index];
  }

  getReplayTimeline() {
    return this.replayHistory.map((state, index) => ({
      index,
      timestamp: state.timestamp,
      orderCount: state.orders.length,
      issueCount: state.issues.length,
      activeTasks: state.printers.filter(p => p.currentTask).length
    }));
  }

  resetReplay() {
    this.replayHistory = [];
    this.currentReplayIndex = -1;
  }
}

// 报告导出器
class ReportExporter {
  static exportToJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  static exportToText(report) {
    let text = '='.repeat(60) + '\n';
    text += '3D打印农场调度报告\n';
    text += `生成时间: ${report.generatedAt.toLocaleString()}\n`;
    text += '='.repeat(60) + '\n\n';

    text += '【订单概览】\n';
    text += `- 总订单数: ${report.totalOrders}\n`;
    text += `- 已完成: ${report.completedOrders}\n`;
    text += `- 失败/暂停: ${report.failedOrders}\n`;
    text += `- 待处理: ${report.pendingOrders}\n\n`;

    text += '【评分详情】\n';
    text += `- 总分: ${report.totalScore} / ${report.maxScore}\n`;
    text += `\n各项得分:\n`;
    const breakdown = report.scoreBreakdown;
    text += `  - 准时交付: ${breakdown.onTimeCompletion} / ${ScoringConfig.onTimeCompletion}\n`;
    text += `  - 材料利用: ${breakdown.materialEfficiency} / ${ScoringConfig.materialEfficiency}\n`;
    text += `  - 质量控制: ${breakdown.noQualityIssues} / ${ScoringConfig.noQualityIssues}\n`;
    text += `  - 设备利用率: ${breakdown.printerUtilization} / ${ScoringConfig.printerUtilization}\n`;
    text += `  - 正确配置: ${breakdown.properSetup} / ${ScoringConfig.properSetup}\n`;
    
    if (breakdown.penalties && breakdown.penalties.total > 0) {
      text += `\n扣分项:\n`;
      if (breakdown.penalties.deadlineMiss > 0) text += `  - 交期超时: -${breakdown.penalties.deadlineMiss}\n`;
      if (breakdown.penalties.materialMismatch > 0) text += `  - 材料错配: -${breakdown.penalties.materialMismatch}\n`;
      if (breakdown.penalties.nozzleClog > 0) text += `  - 喷嘴堵塞: -${breakdown.penalties.nozzleClog}\n`;
      if (breakdown.penalties.materialRunout > 0) text += `  - 材料用尽: -${breakdown.penalties.materialRunout}\n`;
      if (breakdown.penalties.unsuitableNozzle > 0) text += `  - 喷嘴不适: -${breakdown.penalties.unsuitableNozzle}\n`;
      text += `  - 总计扣分: -${breakdown.penalties.total}\n`;
    }
    text += '\n';

    if (report.issues.length > 0) {
      text += '【问题记录】\n';
      report.issues.forEach((issue, idx) => {
        text += `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.getTypeName()}\n`;
        text += `   时间: ${issue.timestamp.toLocaleString()}\n`;
        text += `   影响对象: ${JSON.stringify(issue.affectedObjects)}\n`;
        text += `   原因: ${issue.reason}\n\n`;
      });
    }

    if (report.pendingReviewItems.length > 0) {
      text += '【待复核项目】\n';
      report.pendingReviewItems.forEach((item, idx) => {
        text += `${idx + 1}. 类型: ${item.type}\n`;
        if (item.id) text += `   ID: ${item.id}\n`;
        if (item.name) text += `   名称: ${item.name}\n`;
        if (item.notes && item.notes.length > 0) {
          text += `   备注:\n`;
          item.notes.forEach(note => text += `     - ${note}\n`);
        }
        if (item.issues && item.issues.length > 0) {
          text += `   相关问题:\n`;
          item.issues.forEach(i => text += `     - [${i.severity}] ${i.type}: ${i.reason}\n`);
        }
        text += '\n';
      });
    }

    if (report.lessonsLearned.length > 0) {
      text += '【经验教训】\n';
      report.lessonsLearned.forEach((lesson, idx) => {
        text += `${idx + 1}. [${lesson.category}] ${lesson.lesson}\n\n`;
      });
    }

    return text;
  }

  static exportToCSV(report) {
    let csv = '类别,项目,数值\n';
    
    csv += `订单,总订单数,${report.totalOrders}\n`;
    csv += `订单,已完成,${report.completedOrders}\n`;
    csv += `订单,失败暂停,${report.failedOrders}\n`;
    csv += `订单,待处理,${report.pendingOrders}\n`;
    csv += `评分,总分,${report.totalScore}\n`;
    csv += `评分,满分,${report.maxScore}\n`;
    
    Object.entries(report.scoreBreakdown).forEach(([key, value]) => {
      if (typeof value === 'number') {
        csv += `评分明细,${key},${value}\n`;
      }
    });

    Object.entries(report.materialUsage).forEach(([id, usage]) => {
      csv += `材料使用,${id}[${usage.type}-${usage.color}],${usage.used}\n`;
    });

    Object.entries(report.printerUtilization).forEach(([id, util]) => {
      csv += `打印机,${id}[${util.name}],${util.totalPrintHours.toFixed(1)}\n`;
    });

    return csv;
  }

  static exportToHTML(report) {
    const scorePercent = Math.round((report.totalScore / report.maxScore) * 100);
    const scoreColor = scorePercent >= 80 ? '#22c55e' : scorePercent >= 60 ? '#eab308' : '#ef4444';

    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>3D打印农场调度报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    h1 { color: #1e293b; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    .section { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { color: #334155; margin-top: 0; }
    .score-card { text-align: center; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }
    .score-number { font-size: 48px; font-weight: bold; }
    .score-label { font-size: 18px; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .stat-card { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .stat-label { color: #64748b; font-size: 14px; }
    .issue { padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid; }
    .issue.error { background: #fef2f2; border-color: #ef4444; }
    .issue.warning { background: #fffbeb; border-color: #f59e0b; }
    .review-item { padding: 12px; margin: 8px 0; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b; }
    .lesson { padding: 12px; margin: 8px 0; background: #ecfdf5; border-radius: 6px; border-left: 4px solid #10b981; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <h1>🎯 3D打印农场调度报告</h1>
  <p style="color: #64748b;">生成时间: ${report.generatedAt.toLocaleString()}</p>
  
  <div class="score-card">
    <div class="score-label">综合评分</div>
    <div class="score-number" style="color: ${scoreColor};">${report.totalScore} / ${report.maxScore}</div>
    <div style="margin-top: 10px; opacity: 0.9;">${scorePercent}% 完成度</div>
  </div>

  <div class="section">
    <h2>📊 订单概览</h2>
    <div class="grid">
      <div class="stat-card">
        <div class="stat-value">${report.totalOrders}</div>
        <div class="stat-label">总订单数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #22c55e;">${report.completedOrders}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #ef4444;">${report.failedOrders}</div>
        <div class="stat-label">失败/暂停</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #f59e0b;">${report.pendingOrders}</div>
        <div class="stat-label">待处理</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📈 评分明细</h2>
    <table>
      <tr><th>项目</th><th>得分</th><th>满分</th><th>说明</th></tr>
      <tr><td>准时交付</td><td>${report.scoreBreakdown.onTimeCompletion}</td><td>${ScoringConfig.onTimeCompletion}</td><td>按截止日期完成订单</td></tr>
      <tr><td>材料利用</td><td>${report.scoreBreakdown.materialEfficiency}</td><td>${ScoringConfig.materialEfficiency}</td><td>材料剩余量比例</td></tr>
      <tr><td>质量控制</td><td>${report.scoreBreakdown.noQualityIssues}</td><td>${ScoringConfig.noQualityIssues}</td><td>无严重质量问题</td></tr>
      <tr><td>设备利用率</td><td>${report.scoreBreakdown.printerUtilization}</td><td>${ScoringConfig.printerUtilization}</td><td>打印机忙碌比例</td></tr>
      <tr><td>正确配置</td><td>${report.scoreBreakdown.properSetup}</td><td>${ScoringConfig.properSetup}</td><td>打印机正确安装材料和喷嘴</td></tr>
      ${report.scoreBreakdown.penalties && report.scoreBreakdown.penalties.total > 0 ? 
        `<tr style="color: #ef4444;"><td>总扣分</td><td>-${report.scoreBreakdown.penalties.total}</td><td>-</td><td>各类问题惩罚</td></tr>` : ''}
    </table>
  </div>

  ${report.issues.length > 0 ? `
  <div class="section">
    <h2>⚠️ 问题记录 (${report.issues.length})</h2>
    ${report.issues.map(issue => `
      <div class="issue ${issue.severity}">
        <strong>${issue.getTypeName()}</strong>
        <span style="float: right; color: #64748b;">${issue.timestamp.toLocaleString()}</span>
        <p style="margin: 5px 0 0 0; color: #334155;">${issue.reason}</p>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">影响: ${JSON.stringify(issue.affectedObjects)}</p>
      </div>
    `).join('')}
  </div>` : ''}

  ${report.pendingReviewItems.length > 0 ? `
  <div class="section">
    <h2>🔍 待复核项目 (${report.pendingReviewItems.length})</h2>
    ${report.pendingReviewItems.map((item, idx) => `
      <div class="review-item">
        <strong>${idx + 1}. ${item.type === 'order' ? '订单' : item.type === 'fault' ? '故障' : item.type === 'nozzle_maintenance' ? '喷嘴维护' : '未解决问题'}</strong>
        ${item.id ? `<span style="margin-left: 10px;">ID: ${item.id}</span>` : ''}
        ${item.name ? `<span style="margin-left: 10px;">名称: ${item.name}</span>` : ''}
        ${item.faultType ? `<span style="margin-left: 10px;">故障: ${item.faultType}</span>` : ''}
        ${item.notes && item.notes.length > 0 ? `
          <p style="margin: 8px 0 0 0;">备注:</p>
          ${item.notes.map(n => `<p style="margin: 2px 0 0 20px; color: #64748b;">• ${n}</p>`).join('')}
        ` : ''}
        ${item.issues && item.issues.length > 0 ? `
          <p style="margin: 8px 0 0 0;">相关问题:</p>
          ${item.issues.map(i => `<p style="margin: 2px 0 0 20px; color: #64748b;">• [${i.severity}] ${i.type}: ${i.reason}</p>`).join('')}
        ` : ''}
      </div>
    `).join('')}
  </div>` : ''}

  ${report.lessonsLearned.length > 0 ? `
  <div class="section">
    <h2>💡 经验教训</h2>
    ${report.lessonsLearned.map(lesson => `
      <div class="lesson">
        <span class="badge badge-${lesson.severity}">${lesson.category}</span>
        <p style="margin: 8px 0 0 0; color: #1f2937;">${lesson.lesson}</p>
      </div>
    `).join('')}
  </div>` : ''}

  <div class="section">
    <h2>🧵 材料使用情况</h2>
    <table>
      <tr><th>材料ID</th><th>类型</th><th>颜色</th><th>已用(mm)</th><th>剩余(mm)</th><th>剩余%</th></tr>
      ${Object.entries(report.materialUsage).map(([id, m]) => `
        <tr>
          <td>${id}</td>
          <td>${m.type}</td>
          <td>${m.color}</td>
          <td>${m.used}</td>
          <td>${m.remaining}</td>
          <td><strong style="color: ${m.percentage > 20 ? '#22c55e' : '#ef4444'};">${m.percentage}%</strong></td>
        </tr>
      `).join('')}
    </table>
  </div>

  <div class="section">
    <h2>🖨️ 打印机使用情况</h2>
    <table>
      <tr><th>打印机ID</th><th>名称</th><th>状态</th><th>总打印时长</th><th>故障次数</th><th>材料</th><th>喷嘴</th></tr>
      ${Object.entries(report.printerUtilization).map(([id, p]) => `
        <tr>
          <td>${id}</td>
          <td>${p.name}</td>
          <td>${p.status}</td>
          <td>${p.totalPrintHours.toFixed(1)}h</td>
          <td>${p.failureCount}</td>
          <td>${p.hasMaterial ? '✓' : '✗'}</td>
          <td>${p.hasNozzle ? '✓' : '✗'}</td>
        </tr>
      `).join('')}
    </table>
  </div>
</body>
</html>`;

    return html;
  }

  static downloadReport(report, format = 'json', filename = null) {
    let content, extension;
    
    switch (format.toLowerCase()) {
      case 'json':
        content = this.exportToJSON(report);
        extension = 'json';
        break;
      case 'text':
      case 'txt':
        content = this.exportToText(report);
        extension = 'txt';
        break;
      case 'csv':
        content = this.exportToCSV(report);
        extension = 'csv';
        break;
      case 'html':
        content = this.exportToHTML(report);
        extension = 'html';
        break;
      default:
        throw new Error(`不支持的格式: ${format}`);
    }

    const actualFilename = filename || `调度报告_${new Date().toISOString().slice(0, 10)}.${extension}`;
    
    if (typeof window !== 'undefined') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = actualFilename;
      a.click();
      URL.revokeObjectURL(url);
    }

    return { filename: actualFilename, content };
  }
}

const _scoringExports = {
  ScoringConfig,
  ScoringEngine,
  ReportExporter
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _scoringExports;
} else {
  Object.assign(window, _scoringExports);
}

})();
