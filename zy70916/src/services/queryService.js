const { run, get, all } = require('../models/database');
const { Parser } = require('json2csv');

async function queryTrackRecords(filters = {}) {
  let query = `
    SELECT 
      tr.*,
      so.order_no,
      so.address,
      so.district,
      so.scheduled_date,
      so.distance_km,
      ep.name as elderly_name,
      n.name as nurse_name,
      n.qualifications as nurse_qualifications,
      n.skills as nurse_skills,
      b.name as batch_name,
      b.batch_no
    FROM track_records tr
    LEFT JOIN service_orders so ON tr.service_order_id = so.id
    LEFT JOIN elderly_profiles ep ON tr.elderly_id = ep.elderly_id
    LEFT JOIN nurses n ON tr.nurse_id = n.nurse_id
    LEFT JOIN batches b ON tr.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.nurse_qualifications) {
    query += ' AND n.qualifications LIKE ?';
    params.push(`%${filters.nurse_qualifications}%`);
  }

  if (filters.service_type) {
    query += ' AND tr.service_type = ?';
    params.push(filters.service_type);
  }

  if (filters.service_items) {
    query += ' AND so.service_items LIKE ?';
    params.push(`%${filters.service_items}%`);
  }

  if (filters.route_keyword) {
    query += ' AND (so.address LIKE ? OR so.district LIKE ? OR tr.route_info LIKE ?)';
    const keyword = `%${filters.route_keyword}%`;
    params.push(keyword, keyword, keyword);
  }

  if (filters.nurse_id) {
    query += ' AND tr.nurse_id = ?';
    params.push(filters.nurse_id);
  }

  if (filters.elderly_id) {
    query += ' AND tr.elderly_id = ?';
    params.push(filters.elderly_id);
  }

  if (filters.batch_id) {
    query += ' AND tr.batch_id = ?';
    params.push(filters.batch_id);
  }

  if (filters.status) {
    query += ' AND tr.status = ?';
    params.push(filters.status);
  }

  if (filters.action) {
    query += ' AND tr.action = ?';
    params.push(filters.action);
  }

  if (filters.start_date) {
    query += ' AND tr.handled_at >= ?';
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    query += ' AND tr.handled_at <= ?';
    params.push(filters.end_date);
  }

  query += ' ORDER BY tr.handled_at DESC';

  const records = await all(query, params);
  return records.map(record => ({
    ...record,
    route_source: parseRouteSource(record)
  }));
}

function parseRouteSource(record) {
  const sources = [];
  if (record.address) {
    sources.push({ type: '服务地址', value: record.address });
  }
  if (record.district) {
    sources.push({ type: '服务区域', value: record.district });
  }
  if (record.distance_km) {
    sources.push({ type: '路程距离', value: `${record.distance_km}公里` });
  }
  if (record.route_info) {
    try {
      const route = JSON.parse(record.route_info);
      if (route.distance_km) {
        sources.push({ type: '系统计算距离', value: `${route.distance_km}公里` });
      }
    } catch (e) {}
  }
  return sources;
}

async function getTrackRecordById(id) {
  return await get(`
    SELECT 
      tr.*,
      so.order_no,
      so.address,
      so.district,
      so.service_items,
      so.scheduled_date,
      so.skill_match_status,
      so.cancel_reason,
      ep.name as elderly_name,
      ep.phone as elderly_phone,
      ep.health_status,
      n.name as nurse_name,
      n.qualifications as nurse_qualifications,
      n.skills as nurse_skills,
      n.district as nurse_district,
      b.name as batch_name,
      b.batch_no
    FROM track_records tr
    LEFT JOIN service_orders so ON tr.service_order_id = so.id
    LEFT JOIN elderly_profiles ep ON tr.elderly_id = ep.elderly_id
    LEFT JOIN nurses n ON tr.nurse_id = n.nurse_id
    LEFT JOIN batches b ON tr.batch_id = b.id
    WHERE tr.id = ?
  `, [id]);
}

async function getOrderTrackHistory(orderId) {
  return await all(`
    SELECT 
      tr.*,
      n.name as nurse_name
    FROM track_records tr
    LEFT JOIN nurses n ON tr.nurse_id = n.nurse_id
    WHERE tr.service_order_id = ?
    ORDER BY tr.handled_at ASC
  `, [orderId]);
}

function exportToCsv(records) {
  const fields = [
    { label: '记录编号', value: 'record_no' },
    { label: '服务单号', value: 'order_no' },
    { label: '批次', value: 'batch_name' },
    { label: '老人姓名', value: 'elderly_name' },
    { label: '护士姓名', value: 'nurse_name' },
    { label: '护士资质', value: 'nurse_qualifications' },
    { label: '服务类型', value: 'service_type' },
    { label: '状态', value: 'status' },
    { label: '操作', value: 'action' },
    { label: '原因', value: 'reason' },
    { label: '处理人', value: 'handled_by' },
    { label: '处理时间', value: 'handled_at' },
    { label: '服务地址', value: 'address' },
    { label: '服务区域', value: 'district' },
    { label: '路程来源', value: (r) => r.route_source?.map(s => `${s.type}:${s.value}`).join(' | ') }
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(records);
}

async function getStatistics() {
  return {
    byStatus: await all(`SELECT status, COUNT(*) as count FROM track_records GROUP BY status`),
    byAction: await all(`SELECT action, COUNT(*) as count FROM track_records GROUP BY action`),
    byNurse: await all(`
      SELECT nurse_id, nurse_name, COUNT(*) as count 
      FROM (
        SELECT tr.nurse_id, n.name as nurse_name 
        FROM track_records tr 
        LEFT JOIN nurses n ON tr.nurse_id = n.nurse_id 
        WHERE tr.nurse_id IS NOT NULL
      ) 
      GROUP BY nurse_id
    `),
    monthly: await all(`
      SELECT strftime('%Y-%m', handled_at) as month, COUNT(*) as count 
      FROM track_records 
      GROUP BY month 
      ORDER BY month DESC 
      LIMIT 12
    `)
  };
}

module.exports = {
  queryTrackRecords,
  getTrackRecordById,
  getOrderTrackHistory,
  exportToCsv,
  getStatistics
};
