const { db } = require('./db');

function buildWhereClause(filters) {
  const conditions = [];
  const params = {};

  if (filters.student_id) {
    conditions.push('pr.student_id = @student_id');
    params.student_id = filters.student_id;
  }
  if (filters.subsidy_month) {
    conditions.push('b.subsidy_month = @subsidy_month');
    params.subsidy_month = filters.subsidy_month;
  }
  if (filters.meal_type) {
    conditions.push('pr.meal_type = @meal_type');
    params.meal_type = filters.meal_type;
  }
  if (filters.meal_date) {
    conditions.push('pr.meal_date = @meal_date');
    params.meal_date = filters.meal_date;
  }
  if (filters.status) {
    conditions.push('pr.status = @status');
    params.status = filters.status;
  }
  if (filters.batch_id) {
    conditions.push('pr.batch_id = @batch_id');
    params.batch_id = filters.batch_id;
  }
  if (filters.date_from) {
    conditions.push('pr.meal_date >= @date_from');
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    conditions.push('pr.meal_date <= @date_to');
    params.date_to = filters.date_to;
  }

  return { whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

function queryHistory(filters) {
  const { whereClause, params } = buildWhereClause(filters);

  const sql = `
    SELECT 
      pr.id, pr.student_id, pr.student_name, pr.meal_date, pr.meal_type,
      pr.original_amount, pr.final_amount, pr.status, pr.reject_reason,
      pr.subsidy_type, pr.subsidy_used, pr.refund_applied, pr.operator,
      pr.processed_at, pr.remark,
      b.batch_no, b.subsidy_month,
      cr.check_result as card_check_result, cr.check_reason as card_check_reason
    FROM processed_records pr
    JOIN batches b ON pr.batch_id = b.id
    LEFT JOIN card_records cr ON pr.card_record_id = cr.id
    ${whereClause}
    ORDER BY pr.meal_date DESC, pr.processed_at DESC
  `;

  const rows = db.prepare(sql).all(params);
  return { total: rows.length, records: rows };
}

function queryCardRecords(filters) {
  const conditions = [];
  const params = {};

  if (filters.batch_id) {
    conditions.push('batch_id = @batch_id');
    params.batch_id = filters.batch_id;
  }
  if (filters.student_id) {
    conditions.push('student_id = @student_id');
    params.student_id = filters.student_id;
  }
  if (filters.check_result) {
    conditions.push('check_result = @check_result');
    params.check_result = filters.check_result;
  }
  if (filters.meal_date) {
    conditions.push('meal_date = @meal_date');
    params.meal_date = filters.meal_date;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM card_records ${whereClause} ORDER BY meal_date ASC`).all(params);
  return { total: rows.length, records: rows };
}

function queryOperationLogs(filters) {
  const conditions = [];
  const params = {};

  if (filters.batch_id) {
    conditions.push('batch_id = @batch_id');
    params.batch_id = filters.batch_id;
  }
  if (filters.card_record_id) {
    conditions.push('card_record_id = @card_record_id');
    params.card_record_id = filters.card_record_id;
  }
  if (filters.student_id) {
    conditions.push(`
      card_record_id IN (SELECT id FROM card_records WHERE student_id = @student_id)
      OR refund_record_id IN (SELECT id FROM refund_records WHERE student_id = @student_id)
    `);
    params.student_id = filters.student_id;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM operation_logs ${whereClause} ORDER BY created_at DESC`).all(params);
  return { total: rows.length, records: rows };
}

function queryBatchSummary(batchId) {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) return null;

  const approved = db.prepare(
    "SELECT COUNT(*) as cnt, COALESCE(SUM(final_amount),0) as total FROM processed_records WHERE batch_id = ? AND status = 'approved'"
  ).get(batchId);

  const rejected = db.prepare(
    "SELECT COUNT(*) as cnt, COALESCE(SUM(original_amount),0) as total FROM processed_records WHERE batch_id = ? AND status = 'rejected'"
  ).get(batchId);

  const returned = db.prepare(
    "SELECT COUNT(*) as cnt FROM card_records WHERE batch_id = ? AND check_result = 'returned'"
  ).get(batchId);

  const pending = db.prepare(
    "SELECT COUNT(*) as cnt FROM card_records WHERE batch_id = ? AND check_result = 'pending'"
  ).get(batchId);

  const refunds = db.prepare(
    'SELECT COUNT(*) as cnt, COALESCE(SUM(refund_amount),0) as total FROM refund_records WHERE batch_id = ?'
  ).get(batchId);

  const subsidyUsed = db.prepare(
    "SELECT COALESCE(SUM(subsidy_used),0) as total FROM processed_records WHERE batch_id = ? AND status = 'approved'"
  ).get(batchId).total;

  return {
    batch,
    approved: approved.cnt,
    approvedAmount: approved.total,
    rejected: rejected.cnt,
    rejectedAmount: rejected.total,
    returned: returned.cnt,
    pending: pending.cnt,
    refundCount: refunds.cnt,
    refundAmount: refunds.total,
    subsidyUsed
  };
}

function exportHistory(filters) {
  const { total, records } = queryHistory(filters);

  const headers = [
    '批次号', '补贴月份', '学号', '姓名', '就餐日期', '餐次',
    '原始金额', '最终金额', '状态', '拒绝原因', '补贴类型',
    '补贴使用', '退款金额', '处理人', '处理时间', '备注'
  ];

  const rows = records.map(r => [
    r.batch_no,
    r.subsidy_month,
    r.student_id,
    r.student_name || '',
    r.meal_date,
    r.meal_type,
    r.original_amount.toFixed(2),
    r.final_amount.toFixed(2),
    r.status === 'approved' ? '通过' : r.status === 'rejected' ? '拒绝' : r.status,
    r.reject_reason || '',
    r.subsidy_type || '',
    r.subsidy_used.toFixed(2),
    r.refund_applied.toFixed(2),
    r.operator || '',
    r.processed_at || '',
    r.remark || ''
  ]);

  const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');

  return { total, csv, headers, records };
}

function getStudentDetail(studentId) {
  const subsidy = db.prepare('SELECT * FROM subsidy_lists WHERE student_id = ?').get(studentId);

  const history = db.prepare(`
    SELECT pr.*, b.batch_no, b.subsidy_month
    FROM processed_records pr
    JOIN batches b ON pr.batch_id = b.id
    WHERE pr.student_id = ?
    ORDER BY pr.meal_date DESC
  `).all(studentId);

  const cards = db.prepare(`
    SELECT cr.*, b.batch_no
    FROM card_records cr
    JOIN batches b ON cr.batch_id = b.id
    WHERE cr.student_id = ?
    ORDER BY cr.meal_date DESC
  `).all(studentId);

  const refunds = db.prepare(`
    SELECT rr.*, b.batch_no
    FROM refund_records rr
    JOIN batches b ON rr.batch_id = b.id
    WHERE rr.student_id = ?
    ORDER BY rr.refund_date DESC
  `).all(studentId);

  const logs = db.prepare(`
    SELECT * FROM operation_logs 
    WHERE card_record_id IN (SELECT id FROM card_records WHERE student_id = ?)
       OR refund_record_id IN (SELECT id FROM refund_records WHERE student_id = ?)
       OR batch_id IN (SELECT DISTINCT batch_id FROM card_records WHERE student_id = ?)
    ORDER BY created_at DESC
  `).all(studentId, studentId, studentId);

  return {
    subsidy,
    history,
    cards,
    refunds,
    operation_logs: logs
  };
}

module.exports = {
  queryHistory,
  queryCardRecords,
  queryOperationLogs,
  queryBatchSummary,
  exportHistory,
  getStudentDetail
};
