const ExcelJS = require('exceljs');
const { allQuery } = require('../database/db');

const generateReport = async (filters = {}) => {
  let sql = `
    SELECT 
      q.queue_number,
      q.customer_name,
      q.phone,
      q.party_size,
      tt.name as table_type,
      q.status,
      t.table_number,
      q.checkin_time,
      q.call_time,
      q.seating_time,
      q.completed_time,
      q.cancelled_time,
      ol.operator,
      ol.operation_time
    FROM queue_numbers q
    LEFT JOIN table_types tt ON q.table_type_id = tt.id
    LEFT JOIN tables t ON q.assigned_table_id = t.id
    LEFT JOIN operation_logs ol ON ol.target_table = 'queue_numbers' AND ol.target_id = q.id AND ol.operation_type = 'UPDATE'
    WHERE 1=1
  `;
  const params = [];

  if (filters.startDate) {
    sql += ' AND DATE(q.created_at) >= DATE(?)';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sql += ' AND DATE(q.created_at) <= DATE(?)';
    params.push(filters.endDate);
  }
  if (filters.status) {
    sql += ' AND q.status = ?';
    params.push(filters.status);
  }
  if (filters.operator) {
    sql += ' AND ol.operator = ?';
    params.push(filters.operator);
  }

  sql += ' ORDER BY q.created_at DESC';
  return await allQuery(sql, params);
};

const exportToExcel = async (filters = {}) => {
  const data = await generateReport(filters);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('排号报表');

  worksheet.columns = [
    { header: '排号', key: 'queue_number', width: 12 },
    { header: '顾客姓名', key: 'customer_name', width: 15 },
    { header: '联系电话', key: 'phone', width: 15 },
    { header: '用餐人数', key: 'party_size', width: 10 },
    { header: '桌台类型', key: 'table_type', width: 12 },
    { header: '状态', key: 'status', width: 10 },
    { header: '桌台号', key: 'table_number', width: 10 },
    { header: '取号时间', key: 'checkin_time', width: 20 },
    { header: '呼叫时间', key: 'call_time', width: 20 },
    { header: '入座时间', key: 'seating_time', width: 20 },
    { header: '完成时间', key: 'completed_time', width: 20 },
    { header: '取消时间', key: 'cancelled_time', width: 20 },
    { header: '操作人', key: 'operator', width: 12 },
    { header: '操作时间', key: 'operation_time', width: 20 }
  ];

  worksheet.addRows(data);

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  return workbook;
};

const getTurnoverSuggestions = async () => {
  const sql = `
    SELECT 
      t.id,
      t.table_number,
      tt.name as table_type,
      q.customer_name,
      q.seating_time,
      (STRFTIME('%s', 'now') - STRFTIME('%s', q.seating_time)) / 60 as seating_minutes
    FROM tables t
    LEFT JOIN queue_numbers q ON t.current_queue_id = q.id
    LEFT JOIN table_types tt ON t.type_id = tt.id
    WHERE t.status = 'occupied'
    ORDER BY seating_minutes DESC
  `;
  return await allQuery(sql);
};

module.exports = {
  generateReport,
  exportToExcel,
  getTurnoverSuggestions
};
