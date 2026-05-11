const { getDb } = require('../db');
const { formatDate } = require('../utils');

const exportToCSV = (data, columns) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      let val = row[c.key];
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );
  return [header, ...rows].join('\n');
};

const exportVouchers = (filters = {}) => {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (filters.driver_id) {
    conditions.push('v.driver_id = ?');
    params.push(filters.driver_id);
  }
  if (filters.terminal_id) {
    conditions.push('v.terminal_id = ?');
    params.push(filters.terminal_id);
  }
  if (filters.status) {
    conditions.push('v.status = ?');
    params.push(filters.status);
  }
  if (filters.from_time) {
    conditions.push('v.created_at >= ?');
    params.push(filters.from_time);
  }
  if (filters.to_time) {
    conditions.push('v.created_at <= ?');
    params.push(filters.to_time);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      v.voucher_id,
      v.driver_id,
      d.name as driver_name,
      d.phone as driver_phone,
      v.terminal_id,
      t.name as terminal_name,
      v.car_type,
      v.status,
      v.queue_position,
      v.no_show_count,
      v.created_at,
      v.updated_at
    FROM vouchers v
    JOIN drivers d ON v.driver_id = d.driver_id
    JOIN terminals t ON v.terminal_id = t.terminal_id
    ${where}
    ORDER BY v.created_at DESC
  `;

  const stmt = db.prepare(sql);
  stmt.bind(params);
  const data = [];
  while (stmt.step()) {
    data.push(stmt.getAsObject());
  }

  const formatted = data.map(row => ({
    ...row,
    created_at: formatDate(row.created_at),
    updated_at: formatDate(row.updated_at)
  }));

  const columns = [
    { key: 'voucher_id', label: '排队券ID' },
    { key: 'driver_id', label: '司机ID' },
    { key: 'driver_name', label: '司机姓名' },
    { key: 'driver_phone', label: '司机电话' },
    { key: 'terminal_name', label: '航站楼' },
    { key: 'car_type', label: '车型' },
    { key: 'status', label: '状态' },
    { key: 'queue_position', label: '排队位置' },
    { key: 'no_show_count', label: '爽约次数' },
    { key: 'created_at', label: '创建时间' },
    { key: 'updated_at', label: '更新时间' }
  ];

  return exportToCSV(formatted, columns);
};

const exportQueueForTerminal = (terminalId, carType) => {
  const db = getDb();

  const sql = `
    SELECT 
      q.position,
      q.voucher_id,
      v.driver_id,
      d.name as driver_name,
      v.car_type,
      v.status,
      q.entered_at
    FROM terminal_queues q
    JOIN vouchers v ON q.voucher_id = v.voucher_id
    JOIN drivers d ON v.driver_id = d.driver_id
    WHERE q.terminal_id = ? AND q.car_type = ? AND q.exited_at IS NULL
    ORDER BY q.position ASC
  `;

  const stmt = db.prepare(sql);
  stmt.bind([terminalId, carType]);
  const data = [];
  while (stmt.step()) {
    data.push(stmt.getAsObject());
  }

  const formatted = data.map(row => ({
    ...row,
    entered_at: formatDate(row.entered_at)
  }));

  const columns = [
    { key: 'position', label: '位置' },
    { key: 'voucher_id', label: '排队券ID' },
    { key: 'driver_id', label: '司机ID' },
    { key: 'driver_name', label: '司机姓名' },
    { key: 'car_type', label: '车型' },
    { key: 'status', label: '状态' },
    { key: 'entered_at', label: '入队时间' }
  ];

  return exportToCSV(formatted, columns);
};

module.exports = {
  exportVouchers,
  exportQueueForTerminal
};
