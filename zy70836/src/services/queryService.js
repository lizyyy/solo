const { allAsync, getAsync } = require('../database');
const { Parser } = require('json2csv');

const queryHistory = async (filters = {}) => {
  let sql = `
    SELECT 
      brr.*,
      v.plate_no,
      v.brand,
      v.model,
      b.batch_no,
      b.batch_name
    FROM borrow_return_records brr
    LEFT JOIN vehicles v ON brr.vehicle_id = v.id
    LEFT JOIN batches b ON brr.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.test_route) {
    sql += ' AND brr.test_route LIKE ?';
    params.push(`%${filters.test_route}%`);
  }
  
  if (filters.sales_consultant) {
    sql += ' AND brr.sales_consultant LIKE ?';
    params.push(`%${filters.sales_consultant}%`);
  }
  
  if (filters.min_mileage) {
    sql += ' AND (brr.end_mileage - brr.start_mileage) >= ?';
    params.push(filters.min_mileage);
  }
  
  if (filters.max_mileage) {
    sql += ' AND (brr.end_mileage - brr.start_mileage) <= ?';
    params.push(filters.max_mileage);
  }
  
  if (filters.start_date) {
    sql += ' AND brr.borrow_time >= ?';
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    sql += ' AND brr.borrow_time <= ?';
    params.push(filters.end_date);
  }
  
  sql += ' ORDER BY brr.borrow_time DESC';
  
  const records = await allAsync(sql, params);
  
  return {
    total: records.length,
    records: records
  };
};

const getMileageTracking = async (vin) => {
  const vehicle = await getAsync('SELECT * FROM vehicles WHERE vin = ?', [vin]);
  if (!vehicle) throw new Error('车辆不存在');
  
  const tracking = await allAsync(
    `SELECT * FROM mileage_tracking 
     WHERE vin = ? OR vehicle_id = ?
     ORDER BY created_at ASC`,
    [vin, vehicle.id]
  );
  
  const result = {
    vin,
    plate_no: vehicle.plate_no,
    brand: vehicle.brand,
    model: vehicle.model,
    current_mileage: vehicle.current_mileage,
    tracking_records: tracking.map(t => ({
      time: t.created_at,
      mileage: t.mileage,
      mileage_change: t.mileage_change,
      source: t.source,
      record_type: t.record_type,
      operator: t.operator
    }))
  };
  
  let prevMileage = 0;
  result.tracking_records.forEach(t => {
    if (prevMileage > 0 && t.mileage < prevMileage) {
      t.anomaly = `里程异常: 比上一条记录减少${prevMileage - t.mileage}公里`;
    }
    prevMileage = t.mileage;
  });
  
  return result;
};

const getExceptionLogs = async (filters = {}) => {
  let sql = 'SELECT * FROM exception_logs WHERE 1=1';
  const params = [];
  
  if (filters.exception_type) {
    sql += ' AND exception_type = ?';
    params.push(filters.exception_type);
  }
  
  if (filters.handler) {
    sql += ' AND handler LIKE ?';
    params.push(`%${filters.handler}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return await allAsync(sql, params);
};

const getOperationLogs = async (targetType, targetId) => {
  let sql = 'SELECT * FROM operation_logs WHERE 1=1';
  const params = [];
  
  if (targetType) {
    sql += ' AND target_type = ?';
    params.push(targetType);
  }
  
  if (targetId) {
    sql += ' AND target_id = ?';
    params.push(targetId);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return await allAsync(sql, params);
};

const exportToCSV = async (filters = {}) => {
  const result = await queryHistory(filters);
  
  const fields = [
    'batch_no', 'batch_name', 'vin', 'plate_no', 'brand', 'model',
    'sales_consultant', 'test_route', 'customer_name',
    'borrow_time', 'expected_return_time', 'actual_return_time',
    'start_mileage', 'end_mileage', 'mileage_diff',
    'start_fuel_balance', 'end_fuel_balance', 'status', 'remark'
  ];
  
  const data = result.records.map(r => ({
    ...r,
    mileage_diff: r.end_mileage && r.start_mileage ? r.end_mileage - r.start_mileage : null
  }));
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  
  return {
    total: result.total,
    csv
  };
};

const getRecordAuditTrail = async (recordId, recordType) => {
  const operations = await allAsync(
    `SELECT * FROM operation_logs 
     WHERE target_type = ? AND target_id = ?
     ORDER BY created_at ASC`,
    [recordType, recordId]
  );
  
  const exceptions = await allAsync(
    `SELECT * FROM exception_logs 
     WHERE record_type = ? AND record_id = ?
     ORDER BY created_at ASC`,
    [recordType, recordId]
  );
  
  return {
    operations,
    exceptions,
    audit_summary: {
      total_operations: operations.length,
      total_exceptions: exceptions.length,
      status_changes: operations.filter(o => o.operation_type === 'status_change').length
    }
  };
};

module.exports = {
  queryHistory,
  getMileageTracking,
  getExceptionLogs,
  getOperationLogs,
  exportToCSV,
  getRecordAuditTrail
};