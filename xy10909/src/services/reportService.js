const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const moment = require('moment');

class ReportService {
  async generateDailyReport(startDate, endDate, generatedBy = 'system') {
    const reportId = uuidv4();
    const reportNo = `RPT-${moment().format('YYYYMMDDHHmmss')}`;

    const insertStmt = db.prepare(`
      INSERT INTO access_reports (
        id, report_no, report_type, start_date, end_date, generated_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    await insertStmt.run(reportId, reportNo, 'daily', startDate, endDate, generatedBy, 'generating');

    const eventsStmt = db.prepare(`
      SELECT 
        ge.*,
        p.employee_id,
        p.department,
        p.position,
        va.visitor_company,
        va.visit_purpose,
        va.host_name
      FROM gate_events ge
      LEFT JOIN personnel p ON ge.personnel_id = p.id
      LEFT JOIN visitor_applications va ON ge.visitor_application_id = va.id
      WHERE ge.event_time >= ? AND ge.event_time <= ?
      ORDER BY ge.event_time DESC
    `);
    const events = await eventsStmt.all(startDate, endDate);

    const summary = {
      total_events: events.length,
      allowed_count: events.filter(e => e.access_result === 'allowed').length,
      denied_count: events.filter(e => e.access_result === 'denied').length,
      employee_count: events.filter(e => e.person_type === 'employee').length,
      visitor_count: events.filter(e => e.person_type === 'visitor').length,
      blacklist_denials: events.filter(e => e.access_reason && e.access_reason.includes('黑名单')).length
    };

    const fileName = `${reportNo}.csv`;
    const filePath = path.join(__dirname, '../../data/reports', fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'event_no', title: '事件编号' },
        { id: 'event_time', title: '事件时间' },
        { id: 'gate_no', title: '闸机编号' },
        { id: 'direction', title: '通行方向' },
        { id: 'person_type', title: '人员类型' },
        { id: 'name', title: '姓名' },
        { id: 'id_card', title: '身份证号' },
        { id: 'employee_id', title: '工号' },
        { id: 'department', title: '部门' },
        { id: 'visitor_company', title: '访客单位' },
        { id: 'host_name', title: '接待人' },
        { id: 'access_result', title: '通行结果' },
        { id: 'access_reason', title: '通行原因' },
        { id: 'temperature', title: '体温' },
        { id: 'mask_detected', title: '口罩检测' }
      ]
    });

    await csvWriter.writeRecords(events.map(e => ({
      ...e,
      mask_detected: e.mask_detected ? '是' : '否'
    })));

    const updateStmt = db.prepare(`
      UPDATE access_reports 
      SET status = 'completed',
          file_path = ?,
          total_records = ?,
          summary_data = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    await updateStmt.run(filePath, events.length, JSON.stringify(summary), reportId);

    return this.getReportById(reportId);
  }

  async getReportById(id) {
    const stmt = db.prepare('SELECT * FROM access_reports WHERE id = ?');
    return await stmt.get(id);
  }

  async getReports(filters = {}) {
    let sql = 'SELECT * FROM access_reports WHERE 1=1';
    const params = [];

    if (filters.report_type) {
      sql += ' AND report_type = ?';
      params.push(filters.report_type);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 50);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return await stmt.all(...params);
  }

  async getReportWithDetails(reportId) {
    const report = await this.getReportById(reportId);
    if (!report) return null;

    const eventsStmt = db.prepare(`
      SELECT 
        ge.*,
        p.employee_id,
        p.department,
        p.status as personnel_status,
        t.status as training_status,
        t.expiry_date as training_expiry,
        b.reason as blacklist_reason,
        va.status as visitor_status,
        va.scheduled_start as visitor_start,
        va.scheduled_end as visitor_end
      FROM gate_events ge
      LEFT JOIN personnel p ON ge.personnel_id = p.id
      LEFT JOIN training_status t ON ge.personnel_id = t.personnel_id
      LEFT JOIN blacklist b ON ge.personnel_id = b.personnel_id
      LEFT JOIN visitor_applications va ON ge.visitor_application_id = va.id
      WHERE ge.event_time >= ? AND ge.event_time <= ?
      ORDER BY ge.event_time DESC
    `);

    report.events = await eventsStmt.all(report.start_date, report.end_date);
    report.summary_data = JSON.parse(report.summary_data || '{}');

    return report;
  }
}

module.exports = new ReportService();
