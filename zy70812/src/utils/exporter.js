const { Parser } = require('json2csv');
const db = require('../models/database');

function exportRecordsToCSV(records, fields = null) {
  const defaultFields = [
    'record_no', 'batch_no', 'vessel_name', 'vessel_imo', 'draft',
    'berth_no', 'arrival_date', 'departure_date', 'planned_berth_time',
    'handling_type', 'cargo_quantity', 'agent_confirmed', 'agent_confirmed_by',
    'berth_locked', 'berth_locked_by', 'loading_plan_confirmed',
    'loading_plan_confirmed_by', 'status', 'special_case_type',
    'special_case_reason', 'special_case_handled_by', 'created_by', 'created_at'
  ];
  
  const json2csvParser = new Parser({ fields: fields || defaultFields });
  return json2csvParser.parse(records);
}

function getRecordsForExport(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        sr.*,
        b.batch_no,
        v.vessel_name,
        v.vessel_imo,
        v.draft,
        be.berth_no
      FROM scheduling_records sr
      LEFT JOIN batches b ON sr.batch_id = b.id
      LEFT JOIN vessels v ON sr.vessel_id = v.id
      LEFT JOIN berths be ON sr.berth_id = be.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.batch_id) {
      query += ' AND sr.batch_id = ?';
      params.push(filters.batch_id);
    }

    if (filters.status) {
      query += ' AND sr.status = ?';
      params.push(filters.status);
    }

    if (filters.agent_confirmed !== undefined) {
      query += ' AND sr.agent_confirmed = ?';
      params.push(filters.agent_confirmed === 'true' ? 1 : 0);
    }

    if (filters.berth_locked !== undefined) {
      query += ' AND sr.berth_locked = ?';
      params.push(filters.berth_locked === 'true' ? 1 : 0);
    }

    if (filters.loading_plan_confirmed !== undefined) {
      query += ' AND sr.loading_plan_confirmed = ?';
      params.push(filters.loading_plan_confirmed === 'true' ? 1 : 0);
    }

    if (filters.vessel_name) {
      query += ' AND v.vessel_name LIKE ?';
      params.push(`%${filters.vessel_name}%`);
    }

    if (filters.start_date) {
      query += ' AND sr.arrival_date >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND sr.arrival_date <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY sr.created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function exportRecords(filters = {}) {
  const records = await getRecordsForExport(filters);
  const csv = exportRecordsToCSV(records);
  return {
    count: records.length,
    csv,
    records
  };
}

module.exports = {
  exportRecords,
  exportRecordsToCSV,
  getRecordsForExport
};
