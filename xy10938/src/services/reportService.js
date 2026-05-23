const { runQuery, getOne, getAll } = require('../db');
const moment = require('moment');

function generateDailyReport(date = null) {
  const reportDate = date || moment().format('YYYY-MM-DD');

  const queueStats = getOne(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = '已过号' THEN 1 ELSE 0 END) as overnumber
     FROM queue_numbers 
     WHERE DATE(created_at) = ?`,
    [reportDate]
  );

  const timeStats = getOne(
    `SELECT 
      AVG(JULIANDAY(started_at) - JULIANDAY(created_at)) * 24 * 60 as avg_wait,
      AVG(JULIANDAY(completed_at) - JULIANDAY(started_at)) * 24 * 60 as avg_service
     FROM queue_numbers 
     WHERE DATE(created_at) = ? AND status = '已完成'`,
    [reportDate]
  );

  const peakHour = getOne(
    `SELECT strftime('%H', created_at) as hour, COUNT(*) as count
     FROM queue_numbers 
     WHERE DATE(created_at) = ?
     GROUP BY hour
     ORDER BY count DESC
     LIMIT 1`,
    [reportDate]
  );

  const existing = getOne(`SELECT id FROM queue_reports WHERE report_date = ?`, [reportDate]);

  if (existing) {
    runQuery(
      `UPDATE queue_reports SET 
        total_queue = ?, completed_count = ?, overnumber_count = ?,
        avg_wait_time = ?, avg_service_time = ?, peak_hour = ?
       WHERE report_date = ?`,
      [
        queueStats?.total || 0,
        queueStats?.completed || 0,
        queueStats?.overnumber || 0,
        timeStats?.avg_wait || 0,
        timeStats?.avg_service || 0,
        peakHour?.hour || null,
        reportDate
      ]
    );
  } else {
    runQuery(
      `INSERT INTO queue_reports 
        (report_date, total_queue, completed_count, overnumber_count, avg_wait_time, avg_service_time, peak_hour)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reportDate,
        queueStats?.total || 0,
        queueStats?.completed || 0,
        queueStats?.overnumber || 0,
        timeStats?.avg_wait || 0,
        timeStats?.avg_service || 0,
        peakHour?.hour || null
      ]
    );
  }

  return getOne(`SELECT * FROM queue_reports WHERE report_date = ?`, [reportDate]);
}

function getReportList(startDate = null, endDate = null) {
  let sql = `SELECT * FROM queue_reports`;
  const params = [];

  if (startDate && endDate) {
    sql += ` WHERE report_date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  sql += ` ORDER BY report_date DESC`;

  return getAll(sql, params);
}

function exportReportToCSV(date = null) {
  const reportDate = date || moment().format('YYYY-MM-DD');
  const report = generateDailyReport(reportDate);

  const queueDetails = getAll(
    `SELECT queue_no, service_type, status, position, created_at, started_at, completed_at
     FROM queue_numbers WHERE DATE(created_at) = ? ORDER BY position ASC`,
    [reportDate]
  );

  let csv = '洗车会员排队日报\n';
  csv += `日期,${reportDate}\n`;
  csv += `总排队数,${report.total_queue}\n`;
  csv += `已完成数,${report.completed_count}\n`;
  csv += `过号数,${report.overnumber_count}\n`;
  csv += `平均等待时间(分钟),${report.avg_wait_time.toFixed(2)}\n`;
  csv += `平均服务时间(分钟),${report.avg_service_time.toFixed(2)}\n`;
  csv += `高峰时段,${report.peak_hour || '-'}\n`;
  csv += '\n排队明细\n';
  csv += '排队号,服务类型,状态,位置,创建时间,开始服务时间,完成时间\n';

  queueDetails.forEach(q => {
    csv += `${q.queue_no},${q.service_type},${q.status},${q.position},${q.created_at || '-'},${q.started_at || '-'},${q.completed_at || '-'}\n`;
  });

  return {
    csv,
    report,
    filename: `queue_report_${reportDate}.csv`
  };
}

function getOvernumberRecords() {
  return getAll(
    `SELECT o.*, q.queue_no, q.service_type, m.name as member_name
     FROM overnumber_records o
     LEFT JOIN queue_numbers q ON o.queue_id = q.id
     LEFT JOIN members m ON q.member_id = m.id
     ORDER BY o.created_at DESC`
  );
}

function getExceptionLogs(limit = 50) {
  return getAll(
    `SELECT * FROM exception_logs ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

module.exports = {
  generateDailyReport,
  getReportList,
  exportReportToCSV,
  getOvernumberRecords,
  getExceptionLogs
};
