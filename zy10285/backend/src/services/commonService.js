const db = require('../db');
const dayjs = require('dayjs');

function getIceSpecs(callback) {
  db.all('SELECT * FROM ice_specs WHERE is_active = 1 ORDER BY created_at DESC', callback);
}

function getDeliverySlots(date, callback) {
  let sql = 'SELECT * FROM delivery_slots WHERE is_active = 1';
  const params = [];
  
  if (date) {
    sql += ' AND date = ?';
    params.push(date);
  }
  
  sql += ' ORDER BY date, start_time';
  
  db.all(sql, params, callback);
}

function getCoolers(status, callback) {
  let sql = 'SELECT c.*, cust.name as customer_name FROM coolers c LEFT JOIN customers cust ON c.customer_id = cust.id WHERE 1=1';
  const params = [];
  
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY c.serial_number';
  
  db.all(sql, params, callback);
}

function returnCooler(coolerId, notes, callback) {
  const now = dayjs().format();
  
  db.run(`
    UPDATE coolers 
    SET status = 'available', customer_id = NULL, assigned_at = NULL, last_returned_at = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `, [now, notes, now, coolerId], callback);
}

function getCapacityAlerts(callback) {
  db.all(`
    SELECT *, 
      (current_load / max_capacity) as utilization_rate
    FROM delivery_slots 
    WHERE is_active = 1
    ORDER BY date, start_time
  `, (err, slots) => {
    if (err) return callback(err);
    callback(null, slots.map(slot => ({
      ...slot,
      alertLevel: slot.current_load > slot.max_capacity ? 'critical' : 
                  slot.current_load > slot.max_capacity * 0.9 ? 'warning' : 'normal'
    })));
  });
}

function exportOrders(filters, callback) {
  let sql = `
    SELECT 
      o.order_no,
      c.name as customer_name,
      c.phone as customer_phone,
      s.name as ice_spec_name,
      s.weight as ice_spec_weight,
      o.quantity,
      o.total_amount,
      sl.date as delivery_date,
      sl.start_time || '-' || sl.end_time as delivery_time,
      o.status,
      o.signed_at,
      o.refund_reason,
      o.refund_at,
      o.created_at
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.status) {
    sql += ' AND o.status = ?';
    params.push(filters.status);
  }
  
  if (filters.start_date) {
    sql += ' AND sl.date >= ?';
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    sql += ' AND sl.date <= ?';
    params.push(filters.end_date);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  db.all(sql, params, callback);
}

module.exports = {
  getIceSpecs,
  getDeliverySlots,
  getCoolers,
  returnCooler,
  getCapacityAlerts,
  exportOrders
};
