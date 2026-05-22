const db = require('../database');
const Task = require('./Task');
const Material = require('./Material');
const AuditLog = require('./AuditLog');

class ExportReport {
  static generateReportNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `EXPORT-${dateStr}-${random}`;
  }

  static async create(taskId, exporterId) {
    const task = await Task.getById(taskId);
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    const materials = await Material.getByTaskId(taskId);
    
    const validMaterials = materials.filter(m => m.status === 'valid' || m.status === 'stamped');
    
    const totalAmount = validMaterials.reduce((sum, m) => {
      return sum + (parseFloat(m.amount) || 0);
    }, 0);

    const materialsSummary = validMaterials.map(m => ({
      material_id: m.id,
      material_index: m.material_index,
      contract_no: m.contract_no,
      contract_name: m.contract_name,
      party_a: m.party_a,
      party_b: m.party_b,
      sign_date: m.sign_date,
      amount: m.amount,
      page_count: m.page_count,
      is_authorized: m.is_authorized ? true : false
    }));

    const reportNo = this.generateReportNo();

    await db.run(
      `INSERT INTO export_reports (task_id, report_no, exporter_id, total_contracts, total_amount, stamp_type, materials_summary) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        reportNo,
        exporterId,
        validMaterials.length,
        totalAmount,
        task.stamp_type,
        JSON.stringify(materialsSummary)
      ]
    );

    await Task.markAsExported(taskId);

    await AuditLog.create({
      taskId,
      operatorId: exporterId,
      action: 'export_report',
      fieldName: 'status',
      oldValue: task.status,
      newValue: 'exported',
      reason: '导出任务报告'
    });

    return await this.getByTaskId(taskId);
  }

  static async getByTaskId(taskId) {
    const report = await db.get(
      `SELECT er.*, u.username as exporter_name 
       FROM export_reports er 
       LEFT JOIN users u ON er.exporter_id = u.id 
       WHERE er.task_id = ?`,
      [taskId]
    );

    if (!report) return null;

    return {
      ...report,
      materials_summary: JSON.parse(report.materials_summary)
    };
  }

  static async getByReportNo(reportNo) {
    const report = await db.get(
      `SELECT er.*, u.username as exporter_name 
       FROM export_reports er 
       LEFT JOIN users u ON er.exporter_id = u.id 
       WHERE er.report_no = ?`,
      [reportNo]
    );

    if (!report) return null;

    return {
      ...report,
      materials_summary: JSON.parse(report.materials_summary)
    };
  }

  static async getById(id) {
    const report = await db.get(
      `SELECT er.*, u.username as exporter_name 
       FROM export_reports er 
       LEFT JOIN users u ON er.exporter_id = u.id 
       WHERE er.id = ?`,
      [id]
    );

    if (!report) return null;

    return {
      ...report,
      materials_summary: JSON.parse(report.materials_summary)
    };
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];

    if (filters.stamp_type) {
      conditions.push('er.stamp_type = ?');
      params.push(filters.stamp_type);
    }
    if (filters.exporter_id) {
      conditions.push('er.exporter_id = ?');
      params.push(filters.exporter_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const reports = await db.all(
      `SELECT er.*, u.username as exporter_name 
       FROM export_reports er 
       LEFT JOIN users u ON er.exporter_id = u.id 
       ${whereClause} 
       ORDER BY er.exported_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const parsedReports = reports.map(r => ({
      ...r,
      materials_summary: JSON.parse(r.materials_summary)
    }));

    const total = await db.get(
      `SELECT COUNT(*) as count FROM export_reports er ${whereClause}`,
      params
    );

    return {
      reports: parsedReports,
      pagination: {
        page,
        pageSize,
        total: total.count,
        totalPages: Math.ceil(total.count / pageSize)
      }
    };
  }

  static async getFullTrace(reportId) {
    const report = await this.getById(reportId);
    if (!report) return null;

    const task = await Task.getFullTrace(report.task_id);

    return {
      report,
      task
    };
  }
}

module.exports = ExportReport;
