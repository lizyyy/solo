const db = require('../utils/database');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

class ExportService {
  static async exportReportToCSV(reportId) {
    const report = db.prepare('SELECT * FROM acceptance_reports WHERE id = ?').get(reportId);
    if (!report) {
      throw new Error('报告不存在');
    }

    const task = db.prepare('SELECT * FROM cleaning_tasks WHERE id = ?').get(report.task_id);
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(task.property_id);
    
    const checkItems = db.prepare(`
      SELECT tci.*, ci.name, ci.category, ci.description
      FROM task_check_items tci
      JOIN check_items ci ON tci.check_item_id = ci.id
      WHERE tci.task_id = ?
      ORDER BY ci.sort_order, ci.name
    `).all(report.task_id);

    const photos = db.prepare('SELECT * FROM photo_evidence WHERE task_id = ?').all(report.task_id);

    const reportData = {
      reportNumber: report.report_number,
      inspectorName: report.inspector_name,
      inspectedAt: report.inspected_at,
      propertyName: property.name,
      propertyAddress: property.address,
      taskDate: task.task_date,
      cleanerName: task.cleaner_name,
      reworkCount: task.rework_count,
      totalItems: report.total_items,
      passedItems: report.passed_items,
      failedItems: report.failed_items,
      overallResult: report.overall_result
    };

    const checkItemData = checkItems.map(item => ({
      category: item.category,
      name: item.name,
      description: item.description,
      isPassed: item.is_passed ? '是' : '否',
      checkedBy: item.checked_by || '',
      checkedAt: item.checked_at || '',
      notes: item.notes || ''
    }));

    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const filename = `验收报告_${report.report_number}_${Date.now()}.csv`;
    const filePath = path.join(exportsDir, filename);

    const fields = ['字段', '值'];
    const reportRows = Object.entries(reportData).map(([key, value]) => ({
      '字段': key,
      '值': value
    }));

    const reportParser = new Parser({ fields });
    const reportCSV = reportParser.parse(reportRows);

    const checkItemFields = ['类别', '检查项', '描述', '是否通过', '检查人', '检查时间', '备注'];
    const checkItemParser = new Parser({ fields: checkItemFields });
    const checkItemCSV = checkItemParser.parse(checkItemData);

    const fullCSV = `=== 验收报告概要 ===\n${reportCSV}\n\n=== 检查项详情 ===\n${checkItemCSV}`;

    fs.writeFileSync(filePath, fullCSV, 'utf8');

    db.prepare(`
      UPDATE acceptance_reports 
      SET export_path = ?, exported_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(filePath, reportId);

    return { filePath, filename, reportId };
  }

  static async exportComplaintsToCSV(filters = {}) {
    let query = `
      SELECT cr.*, p.name as property_name, ct.task_date, ct.cleaner_name
      FROM complaint_records cr
      LEFT JOIN properties p ON cr.property_id = p.id
      LEFT JOIN cleaning_tasks ct ON cr.task_id = ct.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.propertyId) {
      query += ' AND cr.property_id = ?';
      params.push(filters.propertyId);
    }
    if (filters.status) {
      query += ' AND cr.status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      query += ' AND cr.complaint_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND cr.complaint_date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY cr.complaint_date DESC';

    const complaints = db.prepare(query).all(...params);

    const exportData = complaints.map(c => ({
      id: c.id,
      propertyName: c.property_name || '',
      taskDate: c.task_date || '',
      cleanerName: c.cleaner_name || '',
      complaintDate: c.complaint_date,
      complainant: c.complainant || '',
      category: c.category || '',
      description: c.description,
      relatedCheckItems: c.related_check_items || '',
      status: c.status,
      handledBy: c.handled_by || '',
      handledAt: c.handled_at || '',
      resolution: c.resolution || ''
    }));

    const fields = ['id', 'propertyName', 'taskDate', 'cleanerName', 
                    'complaintDate', 'complainant', 'category', 'description', 
                    'relatedCheckItems', 'status', 'handledBy', 'handledAt', 'resolution'];
    
    const parser = new Parser({ fields });
    const csv = parser.parse(exportData);

    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const filename = `客诉记录_${Date.now()}.csv`;
    const filePath = path.join(exportsDir, filename);

    fs.writeFileSync(filePath, csv, 'utf8');

    return { filePath, filename, count: complaints.length };
  }

  static getReportFile(reportId) {
    const report = db.prepare('SELECT * FROM acceptance_reports WHERE id = ?').get(reportId);
    if (!report || !report.export_path) {
      throw new Error('报告未导出或不存在');
    }

    if (!fs.existsSync(report.export_path)) {
      throw new Error('导出文件不存在');
    }

    return report.export_path;
  }
}

module.exports = ExportService;
