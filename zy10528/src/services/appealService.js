const moment = require('moment');
const { runQuery, getQuery, allQuery } = require('../database');

const APPEAL_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  TEMP_RESTORED: 'TEMP_RESTORED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED'
};

const generateAppealNo = () => {
  const date = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AP${date}${random}`;
};

const createAppeal = async (db, data) => {
  const appealNo = generateAppealNo();
  const { employee_id, employee_name, data_scope, revoke_reason, appeal_material } = data;
  
  try {
    const result = await runQuery(db, `
      INSERT INTO appeals (appeal_no, employee_id, employee_name, data_scope, revoke_reason, appeal_material)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [appealNo, employee_id, employee_name, data_scope, revoke_reason, appeal_material]);

    await recordStatusHistory(db, {
      appeal_id: result.lastID,
      appeal_no: appealNo,
      from_status: null,
      to_status: APPEAL_STATUS.PENDING,
      action_type: 'CREATE',
      operator_id: data.operator_id,
      operator_name: data.operator_name,
      remark: '创建申诉',
      basis: JSON.stringify(data)
    });

    return { appeal_id: result.lastID, appeal_no: appealNo };
  } catch (error) {
    await recordException(db, {
      operation_type: 'CREATE_APPEAL',
      original_input: JSON.stringify(data),
      error_message: error.message,
      processing_basis: '申诉创建规则校验失败',
      final_conclusion: '申诉创建失败'
    });
    throw error;
  }
};

const getAppealById = async (db, id) => {
  return await getQuery(db, 'SELECT * FROM appeals WHERE id = ?', [id]);
};

const getAppealByNo = async (db, appealNo) => {
  return await getQuery(db, 'SELECT * FROM appeals WHERE appeal_no = ?', [appealNo]);
};

const queryAppeals = async (db, params = {}) => {
  let sql = 'SELECT * FROM appeals WHERE 1=1';
  const queryParams = [];

  if (params.employee_id) {
    sql += ' AND employee_id = ?';
    queryParams.push(params.employee_id);
  }
  if (params.current_status) {
    sql += ' AND current_status = ?';
    queryParams.push(params.current_status);
  }
  if (params.start_time) {
    sql += ' AND created_at >= ?';
    queryParams.push(params.start_time);
  }
  if (params.end_time) {
    sql += ' AND created_at <= ?';
    queryParams.push(params.end_time);
  }

  sql += ' ORDER BY created_at DESC';

  if (params.limit) {
    sql += ' LIMIT ?';
    queryParams.push(params.limit);
  }

  return await allQuery(db, sql, queryParams);
};

const updateStatus = async (db, appealId, toStatus, data = {}) => {
  const appeal = await getAppealById(db, appealId);
  if (!appeal) {
    throw new Error('申诉记录不存在');
  }

  const fromStatus = appeal.current_status;

  await runQuery(db, `
    UPDATE appeals 
    SET current_status = ?, handler_id = ?, handler_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [toStatus, data.handler_id, data.handler_name, appealId]);

  await recordStatusHistory(db, {
    appeal_id: appealId,
    appeal_no: appeal.appeal_no,
    from_status: fromStatus,
    to_status: toStatus,
    action_type: 'STATUS_UPDATE',
    operator_id: data.operator_id,
    operator_name: data.operator_name,
    remark: data.remark,
    basis: data.basis
  });

  return { success: true, from_status: fromStatus, to_status: toStatus };
};

const createTempRestore = async (db, appealId, data) => {
  const appeal = await getAppealById(db, appealId);
  if (!appeal) {
    throw new Error('申诉记录不存在');
  }

  try {
    const result = await runQuery(db, `
      INSERT INTO temp_restore (appeal_id, appeal_no, employee_id, data_scope, start_time, end_time, operator_id, operator_name, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [appealId, appeal.appeal_no, appeal.employee_id, appeal.data_scope, 
         data.start_time, data.end_time, data.operator_id, data.operator_name, data.remark]);

    await runQuery(db, `
      UPDATE appeals SET temp_restore_id = ?, current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [result.lastID, APPEAL_STATUS.TEMP_RESTORED, appealId]);

    await recordStatusHistory(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      from_status: appeal.current_status,
      to_status: APPEAL_STATUS.TEMP_RESTORED,
      action_type: 'TEMP_RESTORE',
      operator_id: data.operator_id,
      operator_name: data.operator_name,
      remark: `临时恢复权限: ${moment(data.start_time).format('YYYY-MM-DD HH:mm')} 至 ${moment(data.end_time).format('YYYY-MM-DD HH:mm')}`,
      basis: JSON.stringify(data)
    });

    return { temp_restore_id: result.lastID, appeal_id: appealId };
  } catch (error) {
    await recordException(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      operation_type: 'TEMP_RESTORE',
      original_input: JSON.stringify(data),
      error_message: error.message,
      processing_basis: '临时恢复权限校验失败',
      final_conclusion: '临时恢复失败'
    });
    throw error;
  }
};

const processConclusion = async (db, appealId, conclusion, data) => {
  const appeal = await getAppealById(db, appealId);
  if (!appeal) {
    throw new Error('申诉记录不存在');
  }

  const finalStatus = conclusion === 'APPROVED' ? APPEAL_STATUS.APPROVED : 
                     conclusion === 'REJECTED' ? APPEAL_STATUS.REJECTED : APPEAL_STATUS.CLOSED;

  try {
    await runQuery(db, `
      UPDATE appeals 
      SET conclusion = ?, current_status = ?, handler_id = ?, handler_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [data.conclusion_text, finalStatus, data.handler_id, data.handler_name, appealId]);

    await recordStatusHistory(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      from_status: appeal.current_status,
      to_status: finalStatus,
      action_type: 'CONCLUSION',
      operator_id: data.handler_id,
      operator_name: data.handler_name,
      remark: data.conclusion_text,
      basis: JSON.stringify(data)
    });

    return { success: true, final_status: finalStatus, conclusion: data.conclusion_text };
  } catch (error) {
    await recordException(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      operation_type: 'PROCESS_CONCLUSION',
      original_input: JSON.stringify({ conclusion, ...data }),
      error_message: error.message,
      processing_basis: '申诉结论处理失败',
      final_conclusion: '结论处理失败'
    });
    throw error;
  }
};

const manualCorrect = async (db, appealId, data) => {
  const appeal = await getAppealById(db, appealId);
  if (!appeal) {
    throw new Error('申诉记录不存在');
  }

  try {
    const updateFields = [];
    const updateValues = [];

    if (data.employee_name !== undefined) {
      updateFields.push('employee_name = ?');
      updateValues.push(data.employee_name);
    }
    if (data.data_scope !== undefined) {
      updateFields.push('data_scope = ?');
      updateValues.push(data.data_scope);
    }
    if (data.revoke_reason !== undefined) {
      updateFields.push('revoke_reason = ?');
      updateValues.push(data.revoke_reason);
    }
    if (data.appeal_material !== undefined) {
      updateFields.push('appeal_material = ?');
      updateValues.push(data.appeal_material);
    }
    if (data.current_status !== undefined) {
      updateFields.push('current_status = ?');
      updateValues.push(data.current_status);
    }

    if (updateFields.length === 0) {
      throw new Error('没有需要修正的字段');
    }

    updateValues.push(appealId);

    await runQuery(db, `
      UPDATE appeals SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, updateValues);

    await recordStatusHistory(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      from_status: appeal.current_status,
      to_status: data.current_status || appeal.current_status,
      action_type: 'MANUAL_CORRECT',
      operator_id: data.operator_id,
      operator_name: data.operator_name,
      remark: data.remark || '人工修正数据',
      basis: JSON.stringify({ original: appeal, correction: data })
    });

    return { success: true, corrected_fields: updateFields.map(f => f.split(' ')[0]) };
  } catch (error) {
    await recordException(db, {
      appeal_id: appealId,
      appeal_no: appeal.appeal_no,
      operation_type: 'MANUAL_CORRECT',
      original_input: JSON.stringify(data),
      error_message: error.message,
      processing_basis: '人工修正校验失败',
      final_conclusion: '人工修正失败'
    });
    throw error;
  }
};

const recordStatusHistory = async (db, data) => {
  return await runQuery(db, `
    INSERT INTO status_history (appeal_id, appeal_no, from_status, to_status, action_type, operator_id, operator_name, remark, basis)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.appeal_id, data.appeal_no, data.from_status, data.to_status, data.action_type,
      data.operator_id, data.operator_name, data.remark, data.basis]);
};

const getStatusHistory = async (db, appealId) => {
  return await allQuery(db, 'SELECT * FROM status_history WHERE appeal_id = ? ORDER BY created_at DESC', [appealId]);
};

const recordException = async (db, data) => {
  return await runQuery(db, `
    INSERT INTO exception_logs (appeal_id, appeal_no, operation_type, original_input, error_message, processing_basis, final_conclusion, handler_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [data.appeal_id, data.appeal_no, data.operation_type, data.original_input,
      data.error_message, data.processing_basis, data.final_conclusion, data.handler_id]);
};

const getExceptions = async (db, appealId = null) => {
  if (appealId) {
    return await allQuery(db, 'SELECT * FROM exception_logs WHERE appeal_id = ? ORDER BY created_at DESC', [appealId]);
  }
  return await allQuery(db, 'SELECT * FROM exception_logs ORDER BY created_at DESC');
};

const checkExpiredTempRestore = async (db) => {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const expiredRecords = await allQuery(db, `
    SELECT * FROM temp_restore 
    WHERE is_expired = 0 AND end_time < ?
  `, [now]);

  for (const record of expiredRecords) {
    await runQuery(db, 'UPDATE temp_restore SET is_expired = 1 WHERE id = ?', [record.id]);
    
    const appeal = await getAppealById(db, record.appeal_id);
    if (appeal && appeal.current_status === APPEAL_STATUS.TEMP_RESTORED) {
      await runQuery(db, `
        UPDATE appeals SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [APPEAL_STATUS.PROCESSING, record.appeal_id]);

      await recordStatusHistory(db, {
        appeal_id: record.appeal_id,
        appeal_no: record.appeal_no,
        from_status: APPEAL_STATUS.TEMP_RESTORED,
        to_status: APPEAL_STATUS.PROCESSING,
        action_type: 'AUTO_EXPIRE',
        operator_id: 'SYSTEM',
        operator_name: '系统自动处理',
        remark: '临时恢复权限已到期自动失效',
        basis: `到期时间: ${record.end_time}`
      });
    }
  }

  return { expired_count: expiredRecords.length };
};

const getTempRestore = async (db, appealId) => {
  return await allQuery(db, 'SELECT * FROM temp_restore WHERE appeal_id = ? ORDER BY created_at DESC', [appealId]);
};

const resolveException = async (db, exceptionId, data) => {
  return await runQuery(db, `
    UPDATE exception_logs 
    SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP, final_conclusion = ?, handler_id = ?
    WHERE id = ?
  `, [data.final_conclusion, data.handler_id, exceptionId]);
};

module.exports = {
  APPEAL_STATUS,
  createAppeal,
  getAppealById,
  getAppealByNo,
  queryAppeals,
  updateStatus,
  createTempRestore,
  processConclusion,
  manualCorrect,
  getStatusHistory,
  getExceptions,
  getTempRestore,
  checkExpiredTempRestore,
  resolveException,
  recordException
};
