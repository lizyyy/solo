const db = require('../database/db');
const moment = require('moment');

class ValidationService {
  async checkDuplicateDeduction(report) {
    const duplicates = [];
    
    const existingRecords = await db.all(`
      SELECT * FROM loss_reports 
      WHERE vegetable_code = ? 
        AND batch_no = ? 
        AND status IN ('pending', 'approved')
        AND id != ?
    `, [report.vegetable_code, report.batch_no, report.id || 0]);

    for (const existing of existingRecords) {
      const hasOverlap = this.checkDateOverlap(report, existing);
      if (hasOverlap) {
        duplicates.push({
          report_no: existing.report_no,
          report_date: existing.report_date,
          loss_type: existing.loss_type,
          loss_quantity: existing.loss_quantity,
          loss_weight: existing.loss_weight
        });
      }
    }

    return {
      hasDuplicate: duplicates.length > 0,
      duplicates: duplicates
    };
  }

  checkDateOverlap(report1, report2) {
    const date1 = moment(report1.report_date);
    const date2 = moment(report2.report_date);
    const diffDays = Math.abs(date1.diff(date2, 'days'));
    return diffDays <= 3;
  }

  async checkConsistency(report) {
    const issues = [];
    const requiredDocs = [];

    if (report.loss_type === 'transport_loss') {
      if (!report.delivery_order_no) {
        issues.push('运输损耗缺少配送单号');
        requiredDocs.push('需要提供配送单复印件');
      }
      if (!report.discovery_time) {
        issues.push('运输损耗缺少发现时间');
      }
      if (!report.discovery_location) {
        issues.push('运输损耗缺少发现地点');
      }
      if (!report.related_docs || !report.related_docs.includes('照片')) {
        requiredDocs.push('需要提供损耗现场照片');
      }
    }

    if (report.loss_type === 'store_loss') {
      if (!report.handler_name) {
        issues.push('门店报损缺少处理人信息');
      }
      if (!report.related_docs || !report.related_docs.includes('盘点')) {
        requiredDocs.push('需要提供门店盘点表');
      }
    }

    if (report.loss_quantity <= 0) {
      issues.push('损耗数量必须大于0');
    }
    if (report.loss_weight <= 0) {
      issues.push('损耗重量必须大于0');
    }

    if (report.loss_quantity > 100 || report.loss_weight > 50) {
      requiredDocs.push('损耗数量较大，需要提供主管签字确认单');
      requiredDocs.push('需要提供第三方检测报告（如适用）');
    }

    return {
      isConsistent: issues.length === 0,
      issues: issues,
      nextStepRequired: requiredDocs.length > 0 ? requiredDocs.join('；') : null
    };
  }

  async validateReport(report) {
    const duplicateCheck = await this.checkDuplicateDeduction(report);
    const consistencyCheck = await this.checkConsistency(report);

    const warnings = [];
    const errors = [];
    const nextSteps = [];

    if (duplicateCheck.hasDuplicate) {
      warnings.push(`检测到同一批次蔬菜可能存在重复报损，涉及报单号：${duplicateCheck.duplicates.map(d => d.report_no).join(', ')}`);
      nextSteps.push('请核对重复报损记录，确认是否为同一损耗的重复申报');
    }

    if (!consistencyCheck.isConsistent) {
      errors.push(...consistencyCheck.issues);
    }

    if (consistencyCheck.nextStepRequired) {
      nextSteps.push(consistencyCheck.nextStepRequired);
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      nextStepRequired: nextSteps.length > 0 ? nextSteps.join('；') : null,
      duplicateDetails: duplicateCheck.duplicates
    };
  }
}

module.exports = new ValidationService();
