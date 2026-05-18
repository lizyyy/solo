const crypto = require('crypto');
const {
  RECORD_STATUSES,
  canTransition,
  checkDuplicateTicket,
  checkPointsConsistency,
  runQuery,
  getQuery,
  allQuery
} = require('../database/db');

function generateId(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

async function createPointRecord(recordData) {
  const {
    ticket_no,
    member_id,
    cinema_id,
    movie_name,
    show_time,
    seat_no,
    ticket_amount,
    points_earned,
    submit_source,
    operator
  } = recordData;

  const duplicates = await checkDuplicateTicket(ticket_no);
  if (duplicates) {
    return {
      success: false,
      error: 'DUPLICATE_TICKET',
      message: '该票根已存在积分补录记录',
      duplicates: duplicates
    };
  }

  const record_id = generateId('REC');
  
  await runQuery(`
    INSERT INTO point_records (
      record_id, ticket_no, member_id, cinema_id, movie_name, show_time,
      seat_no, ticket_amount, points_earned, status, submit_source, operator
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record_id, ticket_no, member_id, cinema_id, movie_name, show_time,
    seat_no, ticket_amount, points_earned, RECORD_STATUSES.NORMAL,
    submit_source, operator
  ]);

  await logOperation(record_id, operator, 'CREATE', null, RECORD_STATUSES.NORMAL, '创建积分补录记录');

  const record = await getPointRecord(record_id);
  return {
    success: true,
    data: record
  };
}

async function updateStatus(record_id, new_status, operator, note = '') {
  const record = await getPointRecord(record_id);
  if (!record) {
    return {
      success: false,
      error: 'RECORD_NOT_FOUND',
      message: '记录不存在'
    };
  }

  if (!canTransition(record.status, new_status)) {
    return {
      success: false,
      error: 'INVALID_TRANSITION',
      message: `不允许从 ${record.status} 状态转换到 ${new_status} 状态`,
      allowedTransitions: STATUS_TRANSITIONS[record.status]
    };
  }

  const old_status = record.status;
  let updateFields = [];
  let params = [];

  if (new_status === RECORD_STATUSES.REJECTED) {
    updateFields.push('reject_reason = ?');
    params.push(note);
  }

  if (new_status === RECORD_STATUSES.SUPPLEMENTED) {
    updateFields.push('supplement_note = ?');
    params.push(note);
  }

  if (new_status === RECORD_STATUSES.COMPLETED) {
    updateFields.push('audit_time = CURRENT_TIMESTAMP');
    updateFields.push('auditor = ?');
    params.push(operator);
  }

  updateFields.push('status = ?');
  params.push(new_status);
  params.push(record_id);

  await runQuery(`
    UPDATE point_records 
    SET ${updateFields.join(', ')}
    WHERE record_id = ?
  `, params);

  if (new_status === RECORD_STATUSES.COMPLETED) {
    await createPointFlow(record, operator);
  }

  await logOperation(
    record_id, 
    operator, 
    'STATUS_CHANGE', 
    old_status, 
    new_status, 
    note || `状态从 ${old_status} 变更为 ${new_status}`
  );

  const updatedRecord = await getPointRecord(record_id);
  return {
    success: true,
    data: updatedRecord
  };
}

async function createPointFlow(record, operator) {
  const flow_id = generateId('FLOW');
  
  await runQuery(`
    INSERT INTO point_flows (
      flow_id, record_id, member_id, points_change, flow_type, operator, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    flow_id, record.record_id, record.member_id, record.points_earned,
    'EARN', operator, `观影积分补录: ${record.movie_name}`
  ]);

  await runQuery(`
    UPDATE members 
    SET total_points = total_points + ? 
    WHERE member_id = ?
  `, [record.points_earned, record.member_id]);
}

async function getPointRecord(record_id) {
  return await getQuery(`
    SELECT pr.*, m.member_name, m.phone, m.member_level, c.cinema_name, c.city
    FROM point_records pr
    JOIN members m ON pr.member_id = m.member_id
    JOIN cinemas c ON pr.cinema_id = c.cinema_id
    WHERE pr.record_id = ?
  `, [record_id]);
}

async function getAllPointRecords(filters = {}) {
  let query = `
    SELECT pr.*, m.member_name, m.phone, m.member_level, c.cinema_name, c.city
    FROM point_records pr
    JOIN members m ON pr.member_id = m.member_id
    JOIN cinemas c ON pr.cinema_id = c.cinema_id
    WHERE 1=1
  `;
  let params = [];

  if (filters.status) {
    query += ` AND pr.status = ?`;
    params.push(filters.status);
  }

  if (filters.member_id) {
    query += ` AND pr.member_id = ?`;
    params.push(filters.member_id);
  }

  if (filters.cinema_id) {
    query += ` AND pr.cinema_id = ?`;
    params.push(filters.cinema_id);
  }

  query += ` ORDER BY pr.submit_time DESC`;

  return await allQuery(query, params);
}

async function getPointFlows(record_id) {
  return await allQuery(`
    SELECT * FROM point_flows 
    WHERE record_id = ? 
    ORDER BY flow_time DESC
  `, [record_id]);
}

async function getOperationLogs(record_id) {
  return await allQuery(`
    SELECT * FROM operation_logs 
    WHERE record_id = ? 
    ORDER BY operation_time DESC
  `, [record_id]);
}

async function logOperation(record_id, operator, operation, old_status, new_status, remark) {
  const log_id = generateId('LOG');
  await runQuery(`
    INSERT INTO operation_logs (
      log_id, record_id, operator, operation, old_status, new_status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [log_id, record_id, operator, operation, old_status, new_status, remark]);
}

async function verifyPointsConsistency(record_id) {
  const record = await getPointRecord(record_id);
  if (!record) {
    return { success: false, error: 'RECORD_NOT_FOUND' };
  }

  const isConsistent = await checkPointsConsistency(
    record.member_id, 
    record_id, 
    record.points_earned
  );

  return {
    success: true,
    record_id,
    points_earned: record.points_earned,
    is_consistent: isConsistent
  };
}

const STATUS_TRANSITIONS = {
  [RECORD_STATUSES.NORMAL]: ['rejected', 'completed'],
  [RECORD_STATUSES.REJECTED]: ['supplemented'],
  [RECORD_STATUSES.SUPPLEMENTED]: ['rejected', 'completed'],
  [RECORD_STATUSES.COMPLETED]: []
};

module.exports = {
  createPointRecord,
  updateStatus,
  getPointRecord,
  getAllPointRecords,
  getPointFlows,
  getOperationLogs,
  verifyPointsConsistency,
  RECORD_STATUSES,
  STATUS_TRANSITIONS
};