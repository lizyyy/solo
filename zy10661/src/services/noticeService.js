const { run, get, all, generateId, now } = require('../db');
const { HISTORY_ACTIONS, logHistory } = require('./historyService');
const { detectConflicts, recordConflict } = require('./conflictService');

const NOTICE_STATUS = {
  PENDING: 'PENDING',
  NOTIFIED: 'NOTIFIED',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
  REJECTED: 'REJECTED',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
};

const FLOW_TYPES = {
  NORMAL: 'NORMAL',
  REJECT: 'REJECT',
  MANUAL: 'MANUAL'
};

const CHANNELS = ['SMS', 'EMAIL', 'APP', 'WECHAT'];

function createNotice(data) {
  const id = generateId();
  const flowType = data.flow_type || FLOW_TYPES.NORMAL;
  
  run(`
    INSERT INTO notice_records (
      id, claim_id, channel, deadline, status,
      flow_type, operator_id, operator_name, remark,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.claim_id,
    data.channel,
    data.deadline,
    NOTICE_STATUS.PENDING,
    flowType,
    data.operator_id || null,
    data.operator_name || null,
    data.remark || null,
    now(),
    now()
  ]);

  if (data.materials && data.materials.length > 0) {
    data.materials.forEach(m => {
      run(`
        INSERT INTO material_items (
          id, claim_id, material_code, material_name,
          quantity, status, reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId(),
        data.claim_id,
        m.material_code,
        m.material_name,
        m.quantity || 1,
        NOTICE_STATUS.PENDING,
        m.reason || null,
        now(),
        now()
      ]);
    });
  }

  logHistory({
    claim_id: data.claim_id,
    notice_id: id,
    action: HISTORY_ACTIONS.NOTICE_CREATED,
    to_status: NOTICE_STATUS.PENDING,
    operator_id: data.operator_id,
    operator_name: data.operator_name,
    remark: `创建${getFlowTypeName(flowType)}通知`,
    flow_type: flowType
  });

  return getNoticeById(id);
}

function getFlowTypeName(flowType) {
  const names = {
    [FLOW_TYPES.NORMAL]: '正常流程',
    [FLOW_TYPES.REJECT]: '驳回流程',
    [FLOW_TYPES.MANUAL]: '人工复核流程'
  };
  return names[flowType] || flowType;
}

function updateNoticeStatus(id, status, operatorId, operatorName, remark) {
  const notice = getNoticeById(id);
  if (!notice) throw new Error('通知不存在');

  const oldStatus = notice.status;
  
  run(`
    UPDATE notice_records
    SET status = ?, updated_at = ?, operator_id = ?, operator_name = ?
    WHERE id = ?
  `, [status, now(), operatorId, operatorName, id]);

  if (status === NOTICE_STATUS.NOTIFIED) {
    run(`
      UPDATE material_items
      SET status = ?, updated_at = ?
      WHERE claim_id = ? AND status = ?
    `, [NOTICE_STATUS.NOTIFIED, now(), notice.claim_id, NOTICE_STATUS.PENDING]);
  }

  logHistory({
    claim_id: notice.claim_id,
    notice_id: id,
    action: HISTORY_ACTIONS.STATUS_CHANGED,
    from_status: oldStatus,
    to_status: status,
    operator_id: operatorId,
    operator_name: operatorName,
    remark: remark || `状态变更为 ${status}`,
    flow_type: notice.flow_type
  });

  const conflicts = detectConflicts(id);
  conflicts.forEach(c => recordConflict(c));

  return getNoticeById(id);
}

function sendReminder(id, operatorId, operatorName) {
  const notice = getNoticeById(id);
  if (!notice) throw new Error('通知不存在');

  logHistory({
    claim_id: notice.claim_id,
    notice_id: id,
    action: HISTORY_ACTIONS.REMINDER_SENT,
    operator_id: operatorId,
    operator_name: operatorName,
    remark: `通过 ${notice.channel} 发送催办通知`,
    flow_type: notice.flow_type
  });

  const conflicts = detectConflicts(id);
  conflicts.forEach(c => recordConflict(c));

  return getNoticeById(id);
}

function completeMaterials(claimId, materialIds, operatorId, operatorName) {
  materialIds.forEach(id => {
    run(`
      UPDATE material_items
      SET status = ?, updated_at = ?
      WHERE id = ? AND claim_id = ?
    `, [NOTICE_STATUS.COMPLETED, now(), id, claimId]);
    
    logHistory({
      claim_id: claimId,
      material_id: id,
      action: HISTORY_ACTIONS.MATERIAL_UPDATED,
      to_status: NOTICE_STATUS.COMPLETED,
      operator_id: operatorId,
      operator_name: operatorName,
      remark: '材料已补齐'
    });
  });

  const pendingMaterials = all(`
    SELECT COUNT(*) as count FROM material_items
    WHERE claim_id = ? AND status != ?
  `, [claimId, NOTICE_STATUS.COMPLETED]);

  if (pendingMaterials[0].count === 0) {
    const notice = get(`
      SELECT * FROM notice_records WHERE claim_id = ? ORDER BY created_at DESC LIMIT 1
    `, [claimId]);
    if (notice) {
      updateNoticeStatus(notice.id, NOTICE_STATUS.COMPLETED, operatorId, operatorName, '所有材料已补齐');
    }
  }

  return getMaterialsByClaimId(claimId);
}

function rejectNotice(id, operatorId, operatorName, reason) {
  const notice = getNoticeById(id);
  if (!notice) throw new Error('通知不存在');

  run(`
    UPDATE notice_records
    SET status = ?, flow_type = ?, updated_at = ?, remark = ?
    WHERE id = ?
  `, [NOTICE_STATUS.REJECTED, FLOW_TYPES.REJECT, now(), reason, id]);

  logHistory({
    claim_id: notice.claim_id,
    notice_id: id,
    action: HISTORY_ACTIONS.REJECTED,
    from_status: notice.status,
    to_status: NOTICE_STATUS.REJECTED,
    operator_id: operatorId,
    operator_name: operatorName,
    remark: `驳回原因: ${reason}`,
    flow_type: FLOW_TYPES.REJECT
  });

  return getNoticeById(id);
}

function sendToManualReview(id, operatorId, operatorName, reason) {
  const notice = getNoticeById(id);
  if (!notice) throw new Error('通知不存在');

  run(`
    UPDATE notice_records
    SET status = ?, flow_type = ?, updated_at = ?, remark = ?
    WHERE id = ?
  `, [NOTICE_STATUS.MANUAL_REVIEW, FLOW_TYPES.MANUAL, now(), reason, id]);

  logHistory({
    claim_id: notice.claim_id,
    notice_id: id,
    action: HISTORY_ACTIONS.MANUAL_REVIEW,
    from_status: notice.status,
    to_status: NOTICE_STATUS.MANUAL_REVIEW,
    operator_id: operatorId,
    operator_name: operatorName,
    remark: `转人工复核: ${reason}`,
    flow_type: FLOW_TYPES.MANUAL
  });

  return getNoticeById(id);
}

function getNoticeById(id) {
  return get('SELECT * FROM notice_records WHERE id = ?', [id]);
}

function getMaterialsByClaimId(claimId) {
  return all('SELECT * FROM material_items WHERE claim_id = ? ORDER BY created_at', [claimId]);
}

function listNotices(params = {}) {
  let sql = `
    SELECT 
      nr.*,
      c.claim_no,
      c.customer_name,
      c.customer_phone,
      (SELECT COUNT(*) FROM material_items mi WHERE mi.claim_id = nr.claim_id) as total_materials,
      (SELECT COUNT(*) FROM material_items mi WHERE mi.claim_id = nr.claim_id AND mi.status = 'COMPLETED') as completed_materials
    FROM notice_records nr
    LEFT JOIN claims c ON nr.claim_id = c.id
  `;
  
  const conditions = [];
  const values = [];

  if (params.status) {
    conditions.push('nr.status = ?');
    values.push(params.status);
  }
  if (params.flow_type) {
    conditions.push('nr.flow_type = ?');
    values.push(params.flow_type);
  }
  if (params.claim_no) {
    conditions.push('c.claim_no LIKE ?');
    values.push(`%${params.claim_no}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY nr.created_at DESC';

  return all(sql, values);
}

function getNoticeDetail(id) {
  const notice = getNoticeById(id);
  if (!notice) return null;

  const claim = get('SELECT * FROM claims WHERE id = ?', [notice.claim_id]);
  const materials = getMaterialsByClaimId(notice.claim_id);
  
  return {
    ...notice,
    claim,
    materials
  };
}

function checkAndUpdateOverdue() {
  const nowStr = now();
  const overdueNotices = all(`
    SELECT * FROM notice_records
    WHERE status IN ('PENDING', 'NOTIFIED') AND deadline < ?
  `, [nowStr]);

  overdueNotices.forEach(notice => {
    if (notice.status !== NOTICE_STATUS.OVERDUE) {
      updateNoticeStatus(
        notice.id,
        NOTICE_STATUS.OVERDUE,
        'system',
        '系统',
        '已超期自动更新状态'
      );
    }
  });

  return overdueNotices.length;
}

module.exports = {
  NOTICE_STATUS,
  FLOW_TYPES,
  CHANNELS,
  createNotice,
  updateNoticeStatus,
  sendReminder,
  completeMaterials,
  rejectNotice,
  sendToManualReview,
  getNoticeById,
  getNoticeDetail,
  listNotices,
  getMaterialsByClaimId,
  checkAndUpdateOverdue
};
