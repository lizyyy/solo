import { getDb, generateId, now, saveDatabase, executeGet, executeAll } from '../database';
import { Appeal, AppealStatus, LiabilityParty, CompensationStatus } from '../types';
import { BusinessError } from '../utils/response';
import { getOrderById } from './orderService';
import { 
  getCompensationById, 
  updateCompensationStatus,
  getCompensationStatusName 
} from './compensationService';
import { getLiabilityPartyName } from './liabilityService';
import { logOperation } from './idempotentService';

export const getAppealStatusName = (status: AppealStatus): string => {
  const names: Record<AppealStatus, string> = {
    pending: '待审核',
    reviewing: '审核中',
    approved: '申诉通过',
    rejected: '申诉驳回',
  };
  return names[status] || status;
};

export const createAppeal = (
  orderId: string,
  compensationId: string,
  appellantParty: LiabilityParty,
  appellantId: string,
  appealReason: string,
  appealEvidence: string | null
): Appeal => {
  if (!appealReason || !appealReason.trim()) {
    throw new BusinessError(
      '申诉原因不能为空',
      '请填写申诉原因',
      'INVALID_REASON'
    );
  }

  const order = getOrderById(orderId);
  const compensation = getCompensationById(compensationId);

  if (compensation.order_id !== orderId) {
    throw new BusinessError(
      '补偿记录不匹配',
      '该补偿记录不属于这个订单',
      'COMPENSATION_MISMATCH'
    );
  }

  if (compensation.status === 'appealed') {
    throw new BusinessError(
      '已存在申诉',
      '该补偿记录已经申诉过了',
      'APPEAL_ALREADY_EXISTS'
    );
  }

  if (compensation.status === 'rolled_back') {
    throw new BusinessError(
      '已回滚',
      '该补偿记录已经回滚，不能再申诉',
      'ALREADY_ROLLED_BACK'
    );
  }

  const db = getDb();

  const appeal: Appeal = {
    id: generateId(),
    order_id: orderId,
    compensation_id: compensationId,
    appellant_party: appellantParty,
    appellant_id: appellantId,
    appeal_reason: appealReason,
    appeal_evidence: appealEvidence,
    status: 'pending',
    reviewer_id: null,
    review_result: null,
    created_at: now(),
    reviewed_at: null,
  };

  db.run(`
    INSERT INTO appeals (
      id, order_id, compensation_id, appellant_party, appellant_id,
      appeal_reason, appeal_evidence, status, reviewer_id, review_result,
      created_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    appeal.id,
    appeal.order_id,
    appeal.compensation_id,
    appeal.appellant_party,
    appeal.appellant_id,
    appeal.appeal_reason,
    appeal.appeal_evidence,
    appeal.status,
    appeal.reviewer_id,
    appeal.review_result,
    appeal.created_at,
    appeal.reviewed_at,
  ]);

  updateCompensationStatus(compensationId, 'appealed', appellantId, appellantParty);

  logOperation(
    orderId,
    appellantId,
    appellantParty,
    'create_appeal',
    `提交申诉: ${appealReason}`,
    null,
    {
      appellantParty,
      appealReason,
      compensationId,
    }
  );

  saveDatabase();
  return appeal;
};

export const getAppeals = (orderId: string): Appeal[] => {
  return executeAll<Appeal>(
    `SELECT * FROM appeals WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId]
  );
};

export const getAppealById = (appealId: string): Appeal => {
  const appeal = executeGet<Appeal>(
    'SELECT * FROM appeals WHERE id = ?',
    [appealId]
  );

  if (!appeal) {
    throw new BusinessError(
      '申诉记录不存在',
      '找不到该申诉记录',
      'APPEAL_NOT_FOUND'
    );
  }

  return appeal;
};

export const reviewAppeal = (
  appealId: string,
  reviewerId: string,
  reviewerRole: string,
  approved: boolean,
  reviewResult: string
): Appeal => {
  if (!reviewResult || !reviewResult.trim()) {
    throw new BusinessError(
      '审核结果不能为空',
      '请填写审核结果说明',
      'INVALID_RESULT'
    );
  }

  const db = getDb();
  const appeal = getAppealById(appealId);

  if (appeal.status !== 'pending' && appeal.status !== 'reviewing') {
    throw new BusinessError(
      '无法审核',
      `当前状态「${getAppealStatusName(appeal.status)}」不能审核`,
      'INVALID_STATUS'
    );
  }

  const newStatus: AppealStatus = approved ? 'approved' : 'rejected';

  db.run(`
    UPDATE appeals 
    SET status = ?, reviewer_id = ?, review_result = ?, reviewed_at = ?
    WHERE id = ?
  `, [
    newStatus,
    reviewerId,
    reviewResult,
    now(),
    appealId,
  ]);

  if (approved) {
    const compensation = getCompensationById(appeal.compensation_id);
    
    if (compensation.status === 'executed' || compensation.status === 'appealed') {
      db.run(`
        UPDATE compensations 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `, ['rolled_back', now(), appeal.compensation_id]);
      
      logOperation(
        appeal.order_id,
        reviewerId,
        reviewerRole,
        'rollback_compensation',
        `申诉通过，回滚补偿: ${compensation.compensation_type} ¥${compensation.amount}`,
        { status: compensation.status },
        { status: 'rolled_back' }
      );
    }
  }

  logOperation(
    appeal.order_id,
    reviewerId,
    reviewerRole,
    'review_appeal',
    `${approved ? '通过' : '驳回'}申诉: ${reviewResult}`,
    { status: appeal.status },
    { status: newStatus, reviewResult }
  );

  saveDatabase();
  return getAppealById(appealId);
};

export const startReview = (
  appealId: string,
  reviewerId: string,
  reviewerRole: string
): Appeal => {
  const db = getDb();
  const appeal = getAppealById(appealId);

  if (appeal.status !== 'pending') {
    throw new BusinessError(
      '无法开始审核',
      `当前状态「${getAppealStatusName(appeal.status)}」不能开始审核`,
      'INVALID_STATUS'
    );
  }

  db.run(`
    UPDATE appeals 
    SET status = ?, reviewer_id = ?
    WHERE id = ?
  `, ['reviewing', reviewerId, appealId]);

  logOperation(
    appeal.order_id,
    reviewerId,
    reviewerRole,
    'start_review',
    '开始审核申诉',
    { status: appeal.status },
    { status: 'reviewing' }
  );

  saveDatabase();
  return getAppealById(appealId);
};

export const manualRollback = (
  compensationId: string,
  operatorId: string,
  operatorRole: string,
  reason: string
): void => {
  const compensation = getCompensationById(compensationId);

  if (compensation.status === 'rolled_back') {
    throw new BusinessError(
      '已回滚',
      '该补偿已经回滚过了',
      'ALREADY_ROLLED_BACK'
    );
  }

  if (compensation.status !== 'executed' && compensation.status !== 'approved') {
    throw new BusinessError(
      '无法回滚',
      `当前状态「${getCompensationStatusName(compensation.status)}」不能回滚`,
      'INVALID_STATUS'
    );
  }

  const db = getDb();
  const newRemark = `${compensation.remark || ''} | 人工回滚原因: ${reason}`;
  db.run(`
    UPDATE compensations 
    SET status = ?, remark = ?, updated_at = ?
    WHERE id = ?
  `, ['rolled_back', newRemark, now(), compensationId]);

  logOperation(
    compensation.order_id,
    operatorId,
    operatorRole,
    'manual_rollback',
    `人工回滚补偿，原因: ${reason}`,
    { status: compensation.status },
    { status: 'rolled_back', reason }
  );

  saveDatabase();
};
