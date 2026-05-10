const db = require('../config/database');
const { 
  generateId, 
  formatCurrency, 
  formatBusinessDate,
  getMealTypeLabel,
  getSettlementStatusLabel,
  getDifferenceReasonLabel,
  getAdjustmentTypeLabel
} = require('../utils/common');
const settlementService = require('./settlementService');

class ReportService {
  generateSettlementReport(cycleId) {
    const detail = settlementService.getSettlementDetail(cycleId);
    if (!detail) {
      return null;
    }
    
    const cycle = detail.cycle;
    const records = detail.records;
    const summary = detail.summary;
    const adjustments = settlementService.listAdjustments(cycleId);
    
    const reportData = {
      cycleInfo: {
        period: `${cycle.cycle_year}年${cycle.cycle_month}月`,
        status: getSettlementStatusLabel(cycle.status),
        startedAt: cycle.started_at,
        completedAt: cycle.completed_at
      },
      summary: {
        plannedCount: summary.plannedCount,
        verifiedCount: summary.verifiedCount,
        differenceCount: summary.differenceCount,
        plannedAmount: summary.plannedAmount,
        subsidyAmount: summary.subsidyAmount,
        actualAmount: summary.actualAmount,
        differenceAmount: summary.differenceAmount
      },
      dailySummary: this._groupByDate(records),
      mealTypeSummary: this._groupByMealType(records),
      differenceSummary: this._groupByDifferenceReason(records),
      adjustments: adjustments,
      details: records
    };
    
    const reportId = generateId();
    db.prepare(`
      INSERT INTO settlement_reports (id, settlement_cycle_id, report_type, report_content)
      VALUES (?, ?, ?, ?)
    `).run(reportId, cycleId, 'monthly', JSON.stringify(reportData));
    
    return {
      id: reportId,
      report: reportData,
      formattedText: this._formatAsText(reportData)
    };
  }

  _groupByDate(records) {
    const groups = {};
    records.forEach(r => {
      if (!groups[r.plan_date]) {
        groups[r.plan_date] = {
          date: r.plan_date,
          plannedCount: 0,
          verifiedCount: 0,
          plannedAmount: 0,
          subsidyAmount: 0,
          actualAmount: 0,
          differenceAmount: 0
        };
      }
      groups[r.plan_date].plannedCount += r.planned_count;
      groups[r.plan_date].verifiedCount += r.verified_count;
      groups[r.plan_date].plannedAmount += r.planned_amount;
      groups[r.plan_date].subsidyAmount += r.subsidy_amount;
      groups[r.plan_date].actualAmount += r.actual_amount;
      groups[r.plan_date].differenceAmount += r.difference_amount;
    });
    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }

  _groupByMealType(records) {
    const groups = {};
    records.forEach(r => {
      if (!groups[r.meal_type]) {
        groups[r.meal_type] = {
          mealType: r.meal_type,
          mealTypeLabel: getMealTypeLabel(r.meal_type),
          plannedCount: 0,
          verifiedCount: 0,
          plannedAmount: 0,
          subsidyAmount: 0,
          actualAmount: 0,
          differenceAmount: 0
        };
      }
      groups[r.meal_type].plannedCount += r.planned_count;
      groups[r.meal_type].verifiedCount += r.verified_count;
      groups[r.meal_type].plannedAmount += r.planned_amount;
      groups[r.meal_type].subsidyAmount += r.subsidy_amount;
      groups[r.meal_type].actualAmount += r.actual_amount;
      groups[r.meal_type].differenceAmount += r.difference_amount;
    });
    return Object.values(groups);
  }

  _groupByDifferenceReason(records) {
    const groups = {};
    records.filter(r => r.difference_amount !== 0).forEach(r => {
      const code = r.difference_reason_code || 'OTHER';
      if (!groups[code]) {
        groups[code] = {
          reasonCode: code,
          reasonLabel: getDifferenceReasonLabel(code),
          count: 0,
          totalAmount: 0
        };
      }
      groups[code].count++;
      groups[code].totalAmount += r.difference_amount;
    });
    return Object.values(groups);
  }

  _formatAsText(report) {
    let text = '';
    
    text += '='.repeat(60) + '\n';
    text += `团餐结算差异报表 - ${report.cycleInfo.period}\n`;
    text += '='.repeat(60) + '\n\n';
    
    text += `结算状态: ${report.cycleInfo.status}\n`;
    if (report.cycleInfo.startedAt) {
      text += `开始时间: ${report.cycleInfo.startedAt}\n`;
    }
    if (report.cycleInfo.completedAt) {
      text += `完成时间: ${report.cycleInfo.completedAt}\n`;
    }
    text += '\n';
    
    text += '【一、汇总数据】\n';
    text += '-'.repeat(50) + '\n';
    text += `订餐份数: ${report.summary.plannedCount} 份\n`;
    text += `取餐份数: ${report.summary.verifiedCount} 份\n`;
    text += `差异份数: ${report.summary.differenceCount} 份\n`;
    text += '\n';
    text += `订餐金额: ${formatCurrency(report.summary.plannedAmount)}\n`;
    text += `补贴金额: ${formatCurrency(report.summary.subsidyAmount)}\n`;
    text += `实际金额: ${formatCurrency(report.summary.actualAmount)}\n`;
    text += `差异金额: ${formatCurrency(report.summary.differenceAmount)}\n`;
    text += '\n';
    
    text += '【二、按日汇总】\n';
    text += '-'.repeat(50) + '\n';
    report.dailySummary.forEach(d => {
      text += `${formatBusinessDate(d.date)}:\n`;
      text += `  订餐 ${d.plannedCount} 份 / 取餐 ${d.verifiedCount} 份 / 差异 ${d.differenceAmount > 0 ? '+' : ''}${formatCurrency(d.differenceAmount)}\n`;
    });
    text += '\n';
    
    text += '【三、按餐别汇总】\n';
    text += '-'.repeat(50) + '\n';
    report.mealTypeSummary.forEach(m => {
      text += `${m.mealTypeLabel}:\n`;
      text += `  订餐 ${m.plannedCount} 份 / 取餐 ${m.verifiedCount} 份 / 差异 ${formatCurrency(m.differenceAmount)}\n`;
      text += `  订餐金额 ${formatCurrency(m.plannedAmount)} / 实际金额 ${formatCurrency(m.actualAmount)}\n`;
    });
    text += '\n';
    
    if (report.differenceSummary.length > 0) {
      text += '【四、差异原因分析】\n';
      text += '-'.repeat(50) + '\n';
      report.differenceSummary.forEach(d => {
        text += `${d.reasonLabel}: ${d.count} 笔，合计 ${formatCurrency(d.totalAmount)}\n`;
      });
      text += '\n';
    }
    
    if (report.adjustments.length > 0) {
      text += '【五、调整记录】\n';
      text += '-'.repeat(50) + '\n';
      report.adjustments.forEach(a => {
        text += `${getAdjustmentTypeLabel(a.adjustment_type)}: ${formatCurrency(a.amount)}\n`;
        text += `  原因: ${a.reason}\n`;
        text += `  操作人: ${a.operator_name || '-'}\n`;
        text += `  状态: ${a.status}\n`;
      });
      text += '\n';
    }
    
    text += '【六、明细数据】\n';
    text += '-'.repeat(50) + '\n';
    text += `日期\t\t餐别\t订餐\t取餐\t订餐金额\t实际金额\t差异\t差异原因\n`;
    report.details.forEach(d => {
      text += `${d.plan_date}\t${getMealTypeLabel(d.meal_type)}\t${d.planned_count}\t${d.verified_count}\t${formatCurrency(d.planned_amount)}\t${formatCurrency(d.actual_amount)}\t${formatCurrency(d.difference_amount)}\t${d.difference_reason || '-'}\n`;
    });
    
    text += '\n' + '='.repeat(60) + '\n';
    text += '数据核对说明：\n';
    text += `  订餐金额 = 订餐份数 × 单价\n`;
    text += `  实际金额 = 取餐份数 × 单价\n`;
    text += `  差异金额 = 订餐金额 - 实际金额\n`;
    text += '='.repeat(60) + '\n';
    
    return text;
  }

  listReports(cycleId) {
    return db.prepare(`
      SELECT id, report_type, generated_at
      FROM settlement_reports
      WHERE settlement_cycle_id = ?
      ORDER BY generated_at DESC
    `).all(cycleId);
  }

  getReport(reportId) {
    const report = db.prepare(`
      SELECT * FROM settlement_reports WHERE id = ?
    `).get(reportId);
    
    if (report && report.report_content) {
      const content = JSON.parse(report.report_content);
      return {
        ...report,
        report: content,
        formattedText: this._formatAsText(content)
      };
    }
    return report;
  }
}

module.exports = new ReportService();
