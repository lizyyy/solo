const { Parser } = require('json2csv');
const { getAll } = require('../database');

async function exportExceptionRecords(params = {}) {
  let sql = `SELECT 
    er.exception_no,
    o.order_no,
    r.rider_no,
    r.name as rider_name,
    et.name as exception_type,
    et.category as exception_category,
    er.description,
    er.status,
    er.reported_time,
    er.created_at
  FROM exception_records er
  LEFT JOIN orders o ON er.order_id = o.id
  LEFT JOIN riders r ON er.rider_id = r.id
  LEFT JOIN exception_types et ON er.exception_type_id = et.id
  WHERE 1=1`;
  
  const values = [];
  
  if (params.status) {
    sql += ` AND er.status = ?`;
    values.push(params.status);
  }
  if (params.startTime) {
    sql += ` AND er.reported_time >= ?`;
    values.push(params.startTime);
  }
  if (params.endTime) {
    sql += ` AND er.reported_time <= ?`;
    values.push(params.endTime);
  }
  
  sql += ` ORDER BY er.reported_time DESC`;
  
  const records = await getAll(sql, values);
  
  const fields = [
    'exception_no',
    'order_no',
    'rider_no',
    'rider_name',
    'exception_type',
    'exception_category',
    'description',
    'status',
    'reported_time',
    'created_at'
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(records);
  
  return {
    csv,
    count: records.length,
    data: records
  };
}

async function exportArbitrationResults(params = {}) {
  let sql = `SELECT 
    ar.arbitration_no,
    er.exception_no,
    ar.arbitrator,
    ar.arbitration_time,
    ar.result,
    ar.conclusion,
    ar.penalty_type,
    ar.penalty_amount,
    ar.appeal_deadline
  FROM arbitration_results ar
  LEFT JOIN exception_records er ON ar.exception_record_id = er.id
  WHERE 1=1`;
  
  const values = [];
  
  if (params.startTime) {
    sql += ` AND ar.arbitration_time >= ?`;
    values.push(params.startTime);
  }
  if (params.endTime) {
    sql += ` AND ar.arbitration_time <= ?`;
    values.push(params.endTime);
  }
  
  sql += ` ORDER BY ar.arbitration_time DESC`;
  
  const records = await getAll(sql, values);
  
  const fields = [
    'arbitration_no',
    'exception_no',
    'arbitrator',
    'arbitration_time',
    'result',
    'conclusion',
    'penalty_type',
    'penalty_amount',
    'appeal_deadline'
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(records);
  
  return {
    csv,
    count: records.length,
    data: records
  };
}

module.exports = {
  exportExceptionRecords,
  exportArbitrationResults
};
