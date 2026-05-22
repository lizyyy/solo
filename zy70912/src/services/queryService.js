const { allQuery, getQuery } = require('../models/database');
const { Parser } = require('json2csv');

async function searchClaims(filters = {}, page = 1, pageSize = 50) {
  const conditions = [];
  const params = [];

  if (filters.baggage_tag_no) {
    conditions.push('c.baggage_tag_no LIKE ?');
    params.push(`%${filters.baggage_tag_no}%`);
  }
  if (filters.responsible_segment) {
    conditions.push('c.responsible_segment = ?');
    params.push(filters.responsible_segment);
  }
  if (filters.compensation_level) {
    conditions.push('c.compensation_level = ?');
    params.push(filters.compensation_level);
  }
  if (filters.status) {
    conditions.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.batch_id) {
    conditions.push('c.batch_id = ?');
    params.push(filters.batch_id);
  }
  if (filters.is_overdue !== undefined) {
    conditions.push('c.is_overdue = ?');
    params.push(filters.is_overdue ? 1 : 0);
  }
  if (filters.needs_manual_review !== undefined) {
    conditions.push('c.needs_manual_review = ?');
    params.push(filters.needs_manual_review ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countSql = `SELECT COUNT(*) as total FROM claims c ${whereClause}`;
  const countResult = await getQuery(countSql, params);

  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT c.*, b.batch_no, b.name as batch_name
    FROM claims c 
    LEFT JOIN batches b ON c.batch_id = b.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const data = await allQuery(dataSql, [...params, pageSize, offset]);

  return {
    total: countResult.total,
    page,
    pageSize,
    data
  };
}

async function getClaimDetail(claimId) {
  const claim = await getQuery(`
    SELECT c.*, b.batch_no, b.name as batch_name
    FROM claims c 
    LEFT JOIN batches b ON c.batch_id = b.id
    WHERE c.id = ?
  `, [claimId]);

  if (!claim) return null;

  const flights = await allQuery(
    'SELECT * FROM flight_data WHERE claim_id = ? ORDER BY segment_order',
    [claimId]
  );

  const photos = await allQuery(
    'SELECT * FROM photo_index WHERE claim_id = ?',
    [claimId]
  );

  const logs = await allQuery(
    'SELECT * FROM processing_logs WHERE claim_id = ? ORDER BY created_at DESC',
    [claimId]
  );

  return {
    ...claim,
    flights,
    photos,
    logs
  };
}

async function exportClaims(filters = {}) {
  const result = await searchClaims(filters, 1, 10000);
  const claims = result.data;

  const fields = [
    { label: '批次号', value: 'batch_no' },
    { label: '行李牌号', value: 'baggage_tag_no' },
    { label: '旅客姓名', value: 'passenger_name' },
    { label: '联系电话', value: 'passenger_phone' },
    { label: '航班号', value: 'flight_no' },
    { label: '航班日期', value: 'flight_date' },
    { label: '航线', value: 'route' },
    { label: '申诉类型', value: 'claim_type' },
    { label: '申诉金额', value: 'claim_amount' },
    { label: '赔付等级', value: 'compensation_level' },
    { label: '责任航段', value: 'responsible_segment' },
    { label: '是否超时', value: (row) => row.is_overdue ? '是' : '否' },
    { label: '需人工审核', value: (row) => row.needs_manual_review ? '是' : '否' },
    { label: '审核原因', value: 'review_reason' },
    { label: '状态', value: 'status' },
    { label: '状态原因', value: 'status_reason' },
    { label: '处理人', value: 'handler' },
    { label: '处理时间', value: 'handled_at' },
    { label: '创建时间', value: 'created_at' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(claims);

  return {
    total: claims.length,
    csv,
    data: claims
  };
}

async function getBatches() {
  return allQuery('SELECT * FROM batches ORDER BY created_at DESC');
}

async function getBatchDetail(batchId) {
  const batch = await getQuery('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) return null;

  const stats = await getQuery(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
      SUM(CASE WHEN status IN ('pending', 'pending_review') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN needs_manual_review = 1 THEN 1 ELSE 0 END) as need_review
    FROM claims WHERE batch_id = ?
  `, [batchId]);

  return {
    ...batch,
    stats
  };
}

module.exports = {
  searchClaims,
  getClaimDetail,
  exportClaims,
  getBatches,
  getBatchDetail
};
