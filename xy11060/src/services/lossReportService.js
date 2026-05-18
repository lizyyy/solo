const db = require('../database/db');
const validationService = require('./validationService');
const moment = require('moment');

class LossReportService {
  generateReportNo(stationCode) {
    const dateStr = moment().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BS${dateStr}${random}`;
  }

  async createReport(reportData) {
    const reportNo = reportData.report_no || this.generateReportNo(reportData.station_code);
    
    const validation = await validationService.validateReport(reportData);
    
    const sql = `
      INSERT INTO loss_reports (
        report_no, station_code, station_name, report_date, reporter_code, reporter_name,
        vegetable_code, vegetable_name, vegetable_category, batch_no, delivery_order_no,
        purchase_order_no, loss_type, loss_quantity, loss_weight, loss_unit, loss_reason,
        loss_description, discovery_time, discovery_location, handler_name, related_docs,
        status, next_step_required, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const params = [
      reportNo, reportData.station_code, reportData.station_name, reportData.report_date,
      reportData.reporter_code, reportData.reporter_name, reportData.vegetable_code,
      reportData.vegetable_name, reportData.vegetable_category, reportData.batch_no,
      reportData.delivery_order_no, reportData.purchase_order_no, reportData.loss_type,
      reportData.loss_quantity, reportData.loss_weight, reportData.loss_unit, reportData.loss_reason,
      reportData.loss_description, reportData.discovery_time, reportData.discovery_location,
      reportData.handler_name, reportData.related_docs,
      validation.isValid ? 'pending' : 'need_materials',
      validation.nextStepRequired
    ];

    const result = await db.run(sql, params);
    
    return {
      id: result.id,
      report_no: reportNo,
      validation: validation,
      status: validation.isValid ? 'pending' : 'need_materials',
      next_step_required: validation.nextStepRequired
    };
  }

  async batchCreateReports(reportsData) {
    const results = [];
    
    for (const reportData of reportsData) {
      try {
        const result = await this.createReport(reportData);
        results.push({
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          data: reportData
        });
      }
    }

    return {
      total: reportsData.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }

  async getReportById(id) {
    return await db.get('SELECT * FROM loss_reports WHERE id = ?', [id]);
  }

  async getReportByNo(reportNo) {
    return await db.get('SELECT * FROM loss_reports WHERE report_no = ?', [reportNo]);
  }

  async getReports(filters = {}) {
    let sql = 'SELECT * FROM loss_reports WHERE 1=1';
    const params = [];

    if (filters.station_code) {
      sql += ' AND station_code = ?';
      params.push(filters.station_code);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.start_date) {
      sql += ' AND report_date >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND report_date <= ?';
      params.push(filters.end_date);
    }

    if (filters.loss_type) {
      sql += ' AND loss_type = ?';
      params.push(filters.loss_type);
    }

    sql += ' ORDER BY report_date DESC, created_at DESC';

    return await db.all(sql, params);
  }

  async updateReport(id, updateData) {
    const existing = await this.getReportById(id);
    if (!existing) {
      throw new Error('报损记录不存在');
    }

    const updated = { ...existing, ...updateData };
    const validation = await validationService.validateReport(updated);

    const sql = `
      UPDATE loss_reports SET
        station_code = ?, station_name = ?, report_date = ?, reporter_code = ?, reporter_name = ?,
        vegetable_code = ?, vegetable_name = ?, vegetable_category = ?, batch_no = ?, delivery_order_no = ?,
        purchase_order_no = ?, loss_type = ?, loss_quantity = ?, loss_weight = ?, loss_unit = ?, loss_reason = ?,
        loss_description = ?, discovery_time = ?, discovery_location = ?, handler_name = ?, related_docs = ?,
        next_step_required = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const params = [
      updateData.station_code || existing.station_code,
      updateData.station_name || existing.station_name,
      updateData.report_date || existing.report_date,
      updateData.reporter_code || existing.reporter_code,
      updateData.reporter_name || existing.reporter_name,
      updateData.vegetable_code || existing.vegetable_code,
      updateData.vegetable_name || existing.vegetable_name,
      updateData.vegetable_category || existing.vegetable_category,
      updateData.batch_no || existing.batch_no,
      updateData.delivery_order_no || existing.delivery_order_no,
      updateData.purchase_order_no || existing.purchase_order_no,
      updateData.loss_type || existing.loss_type,
      updateData.loss_quantity !== undefined ? updateData.loss_quantity : existing.loss_quantity,
      updateData.loss_weight !== undefined ? updateData.loss_weight : existing.loss_weight,
      updateData.loss_unit || existing.loss_unit,
      updateData.loss_reason || existing.loss_reason,
      updateData.loss_description !== undefined ? updateData.loss_description : existing.loss_description,
      updateData.discovery_time !== undefined ? updateData.discovery_time : existing.discovery_time,
      updateData.discovery_location !== undefined ? updateData.discovery_location : existing.discovery_location,
      updateData.handler_name !== undefined ? updateData.handler_name : existing.handler_name,
      updateData.related_docs !== undefined ? updateData.related_docs : existing.related_docs,
      validation.nextStepRequired,
      id
    ];

    await db.run(sql, params);

    return {
      id: id,
      validation: validation,
      next_step_required: validation.nextStepRequired
    };
  }

  async auditReport(id, auditData) {
    const sql = `
      UPDATE loss_reports SET
        status = ?, auditor_code = ?, auditor_name = ?, audit_time = ?, audit_opinion = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.run(sql, [
      auditData.status, auditData.auditor_code, auditData.auditor_name,
      moment().format('YYYY-MM-DD HH:mm:ss'), auditData.audit_opinion, id
    ]);

    return await this.getReportById(id);
  }

  async exportReports(filters = {}) {
    const reports = await this.getReports(filters);
    
    return reports.map(report => ({
      报损单号: report.report_no,
      配送站编码: report.station_code,
      配送站名称: report.station_name,
      报损日期: report.report_date,
      上报人编码: report.reporter_code,
      上报人姓名: report.reporter_name,
      蔬菜编码: report.vegetable_code,
      蔬菜名称: report.vegetable_name,
      蔬菜品类: report.vegetable_category,
      批次号: report.batch_no,
      配送单号: report.delivery_order_no,
      采购单号: report.purchase_order_no,
      损耗类型: report.loss_type === 'transport_loss' ? '运输损耗' : report.loss_type === 'store_loss' ? '门店报损' : report.loss_type,
      损耗数量: report.loss_quantity,
      损耗重量: report.loss_weight,
      计量单位: report.loss_unit,
      损耗原因: report.loss_reason,
      损耗描述: report.loss_description,
      发现时间: report.discovery_time,
      发现地点: report.discovery_location,
      处理人: report.handler_name,
      相关单据: report.related_docs,
      状态: report.status === 'pending' ? '待审核' : report.status === 'approved' ? '已通过' : report.status === 'rejected' ? '已拒绝' : report.status === 'need_materials' ? '需补充材料' : report.status,
      审核人编码: report.auditor_code,
      审核人姓名: report.auditor_name,
      审核时间: report.audit_time,
      审核意见: report.audit_opinion,
      下一步需补充材料: report.next_step_required
    }));
  }
}

module.exports = new LossReportService();
