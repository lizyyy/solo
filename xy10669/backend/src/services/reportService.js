const { runQuery, runInsert, runUpdate } = require('../database');
const ExcelJS = require('exceljs');

async function generateReport(appointmentId, archivedBy) {
  const appointment = (await runQuery('SELECT * FROM appointments WHERE id = ?', [appointmentId]))[0];
  if (!appointment) throw new Error('预约不存在');

  const packageItems = await runQuery(
    `SELECT i.* FROM package_items pi
     JOIN items i ON pi.item_id = i.id
     WHERE pi.package_id = ?`,
    [appointment.package_id]
  );

  const addons = await runQuery(
    `SELECT ao.*, i.name, i.price as item_price 
     FROM addon_orders ao
     JOIN items i ON ao.item_id = i.id
     WHERE ao.appointment_id = ? AND ao.status = 'confirmed'`,
    [appointmentId]
  );

  const waivers = await runQuery(
    `SELECT w.*, i.name 
     FROM waivers w
     JOIN items i ON w.item_id = i.id
     WHERE w.appointment_id = ? AND w.status = 'approved'`,
    [appointmentId]
  );

  const waivedItemIds = waivers.map(w => w.item_id);
  const finalItems = [
    ...packageItems.filter(item => !waivedItemIds.includes(item.id)),
    ...addons.map(a => ({ id: a.item_id, name: a.name, price: a.item_price }))
  ];

  const packageInfo = (await runQuery('SELECT * FROM packages WHERE id = ?', [appointment.package_id]))[0];
  const addonTotal = addons.reduce((sum, a) => sum + a.price, 0);
  const totalPrice = packageInfo.price + addonTotal;

  const reportNumber = `RPT-${Date.now()}-${appointmentId}`;

  const reportId = await runInsert(
    `INSERT INTO reports (appointment_id, report_number, final_items, waived_items, addon_items, total_price, status, archived_by, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, 'archived', ?, CURRENT_TIMESTAMP)`,
    [
      appointmentId,
      reportNumber,
      JSON.stringify(finalItems),
      JSON.stringify(waivers),
      JSON.stringify(addons),
      totalPrice,
      archivedBy
    ]
  );

  return { reportId, reportNumber, finalItems, waivers, addons, totalPrice };
}

async function getReports(filters = {}) {
  let sql = `SELECT r.*, a.user_name, a.appointment_date, p.name as package_name
             FROM reports r
             JOIN appointments a ON r.appointment_id = a.id
             JOIN packages p ON a.package_id = p.id
             WHERE 1=1`;
  const params = [];

  if (filters.handledBy) {
    sql += ` AND r.archived_by = ?`;
    params.push(filters.handledBy);
  }
  if (filters.startDate) {
    sql += ` AND r.archived_at >= ?`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ` AND r.archived_at <= ?`;
    params.push(filters.endDate);
  }

  sql += ` ORDER BY r.archived_at DESC`;
  return await runQuery(sql, params);
}

async function exportReportToExcel(reportIds) {
  const reports = await runQuery(
    `SELECT r.*, a.user_name, a.user_phone, a.appointment_date, a.appointment_time,
            p.name as package_name, p.price as package_price
     FROM reports r
     JOIN appointments a ON r.appointment_id = a.id
     JOIN packages p ON a.package_id = p.id
     WHERE r.id IN (${reportIds.join(',')})`
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('体检报告归档');

  worksheet.columns = [
    { header: '报告编号', key: 'report_number', width: 20 },
    { header: '用户姓名', key: 'user_name', width: 12 },
    { header: '联系电话', key: 'user_phone', width: 15 },
    { header: '体检套餐', key: 'package_name', width: 20 },
    { header: '预约日期', key: 'appointment_date', width: 12 },
    { header: '预约时间', key: 'appointment_time', width: 10 },
    { header: '总金额', key: 'total_price', width: 10 },
    { header: '归档人', key: 'archived_by', width: 12 },
    { header: '归档时间', key: 'archived_at', width: 20 }
  ];

  for (const report of reports) {
    worksheet.addRow({
      report_number: report.report_number,
      user_name: report.user_name,
      user_phone: report.user_phone,
      package_name: report.package_name,
      appointment_date: report.appointment_date,
      appointment_time: report.appointment_time,
      total_price: report.total_price,
      archived_by: report.archived_by,
      archived_at: report.archived_at
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function getStats() {
  const stats = {};
  
  stats.packages = (await runQuery('SELECT COUNT(*) as count FROM packages'))[0].count;
  stats.items = (await runQuery('SELECT COUNT(*) as count FROM items'))[0].count;
  stats.appointments = (await runQuery('SELECT COUNT(*) as count FROM appointments'))[0].count;
  stats.reports = (await runQuery('SELECT COUNT(*) as count FROM reports'))[0].count;
  stats.waivers = (await runQuery('SELECT COUNT(*) as count FROM waivers'))[0].count;
  stats.addons = (await runQuery('SELECT COUNT(*) as count FROM addon_orders'))[0].count;

  const today = new Date().toISOString().split('T')[0];
  stats.todayAppointments = (await runQuery(
    'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ?',
    [today]
  ))[0].count;

  return stats;
}

module.exports = {
  generateReport,
  getReports,
  exportReportToExcel,
  getStats
};
