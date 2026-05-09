import type { HitStatus, ReviewDecision, ReviewRecord, ApprovalRecord } from '../types';
import { runQuery, getQuery, allQuery } from '../db';
import { generateId, now, auditLog, snakeToCamel, snakeToCamelAll } from '../utils';
import { 
  getHitRecordById, 
  getFreezeByHitRecordId, 
  updateHitRecordStatus,
  getFreezeById
} from './hitAndFreezeService';

export const getReviewRecordsByHit = async (hitId: string): Promise<ReviewRecord[]> => {
  const rows = await allQuery(
    `SELECT * FROM review_records WHERE hit_record_id = ? ORDER BY created_at DESC`,
    [hitId]
  );
  return snakeToCamelAll(rows) as ReviewRecord[];
};

export const getLastReviewRecord = async (hitId: string): Promise<ReviewRecord | null> => {
  const row = await getQuery(
    `SELECT * FROM review_records WHERE hit_record_id = ? ORDER BY created_at DESC LIMIT 1`,
    [hitId]
  );
  return row ? (snakeToCamel(row) as ReviewRecord) : null;
};

export const getApprovalRecordsByFreeze = async (freezeId: string): Promise<ApprovalRecord[]> => {
  const rows = await allQuery(
    `SELECT * FROM approval_records WHERE account_freeze_id = ? ORDER BY created_at DESC`,
    [freezeId]
  );
  return snakeToCamelAll(rows) as ApprovalRecord[];
};

export const getLastApprovalRecord = async (freezeId: string): Promise<ApprovalRecord | null> => {
  const row = await getQuery(
    `SELECT * FROM approval_records WHERE account_freeze_id = ? ORDER BY created_at DESC LIMIT 1`,
    [freezeId]
  );
  return row ? (snakeToCamel(row) as ApprovalRecord) : null;
};

export const getApprovalRecordsByHit = async (hitId: string): Promise<ApprovalRecord[]> => {
  const rows = await allQuery(
    `SELECT * FROM approval_records WHERE hit_record_id = ? ORDER BY created_at DESC`,
    [hitId]
  );
  return snakeToCamelAll(rows) as ApprovalRecord[];
};

export const reviewHit = async (
  hitId: string,
  decision: ReviewDecision,
  reviewer: string,
  comment: string
): Promise<{ hitRecord: any; review: ReviewRecord }> => {
  const hitRecord = await getHitRecordById(hitId);
  if (!hitRecord) throw new Error('命中记录不存在');
  
  if (hitRecord.status === 'closed') throw new Error('该命中记录已关闭，无法再次复核');
  if (hitRecord.status === 'review_approved') throw new Error('该命中记录已复核通过，等待解冻审批');

  const reviewId = generateId();
  const createdAt = now();
  const previousStatus = hitRecord.status as HitStatus;

  await runQuery(
    `INSERT INTO review_records 
     (id, hit_record_id, decision, reviewer, comment, previous_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reviewId, hitId, decision, reviewer, comment, previousStatus, createdAt]
  );

  let newStatus: HitStatus;
  let currentBlock: string;
  
  if (decision === 'approved') {
    newStatus = 'review_approved';
    currentBlock = 'unfreeze';
  } else {
    newStatus = 'review_rejected';
    currentBlock = 'review';
  }

  await updateHitRecordStatus(hitId, newStatus, currentBlock);

  await auditLog(
    'hit_reviewed',
    'hit_record',
    hitId,
    reviewer,
    {
      decision,
      comment,
      previousStatus,
      newStatus,
      note: decision === 'approved' 
        ? '复核通过，可申请解冻' 
        : '复核驳回，需要重新处理'
    }
  );

  const updatedHit = await getHitRecordById(hitId);
  const review = await getReviewRecordById(reviewId);

  return { hitRecord: updatedHit, review };
};

export const getReviewRecordById = async (id: string): Promise<ReviewRecord> => {
  const row = await getQuery(`SELECT * FROM review_records WHERE id = ?`, [id]);
  return snakeToCamel(row) as ReviewRecord;
};

export const requestUnfreeze = async (
  freezeId: string,
  requestedBy: string,
  unfreezeReason: string
): Promise<{ freeze: any; hitRecord: any }> => {
  const freeze = await getFreezeById(freezeId);
  if (!freeze) throw new Error('冻结记录不存在');
  if (freeze.status === 'unfrozen') throw new Error('该账户已解冻');

  const hitRecord = await getHitRecordById(freeze.hitRecordId);
  if (!hitRecord) throw new Error('关联的命中记录不存在');

  if (hitRecord.status === 'pending_review') {
    throw new Error('该冻结尚未完成人工复核，不能申请解冻');
  }
  
  if (hitRecord.status === 'review_rejected') {
    throw new Error('复核被驳回，需要先重新复核通过才能申请解冻');
  }

  const requestedAt = now();

  await runQuery(
    `UPDATE account_freezes 
     SET unfreeze_requested_by = ?, unfreeze_requested_at = ?, unfreeze_reason = ?, updated_at = ?
     WHERE id = ?`,
    [requestedBy, requestedAt, unfreezeReason, requestedAt, freezeId]
  );

  await updateHitRecordStatus(freeze.hitRecordId, 'pending_unfreeze', 'unfreeze');

  await auditLog(
    'unfreeze_requested',
    'account_freeze',
    freezeId,
    requestedBy,
    {
      freezeId,
      hitRecordId: freeze.hitRecordId,
      accountId: freeze.accountId,
      unfreezeReason,
      note: '已提交解冻申请，等待审批'
    }
  );

  const updatedFreeze = await getFreezeById(freezeId);
  const updatedHit = await getHitRecordById(freeze.hitRecordId);

  return { freeze: updatedFreeze, hitRecord: updatedHit };
};

export const approveUnfreeze = async (
  freezeId: string,
  approver: string,
  comment: string
): Promise<{ freeze: any; approval: ApprovalRecord; hitRecord: any }> => {
  const freeze = await getFreezeById(freezeId);
  if (!freeze) throw new Error('冻结记录不存在');
  if (freeze.status === 'unfrozen') throw new Error('该账户已解冻');
  if (!freeze.unfreezeRequestedAt) throw new Error('尚未提交解冻申请');

  const approvalId = generateId();
  const createdAt = now();

  await runQuery(
    `INSERT INTO approval_records 
     (id, account_freeze_id, hit_record_id, decision, approver, comment, created_at)
     VALUES (?, ?, ?, 'approved', ?, ?, ?)`,
    [approvalId, freezeId, freeze.hitRecordId, approver, comment, createdAt]
  );

  await runQuery(
    `UPDATE account_freezes 
     SET status = 'unfrozen', unfrozen_by = ?, unfrozen_at = ?, updated_at = ?
     WHERE id = ?`,
    [approver, createdAt, createdAt, freezeId]
  );

  await updateHitRecordStatus(freeze.hitRecordId, 'unfreeze_approved', 'none');

  await auditLog(
    'unfreeze_approved',
    'account_freeze',
    freezeId,
    approver,
    {
      freezeId,
      hitRecordId: freeze.hitRecordId,
      accountId: freeze.accountId,
      comment,
      note: '解冻审批通过，账户已解除冻结'
    }
  );

  await auditLog(
    'freeze_lifted',
    'account_freeze',
    freezeId,
    approver,
    {
      accountId: freeze.accountId,
      note: '账户冻结已解除'
    }
  );

  const updatedFreeze = await getFreezeById(freezeId);
  const approval = await getApprovalRecordById(approvalId);
  const updatedHit = await getHitRecordById(freeze.hitRecordId);

  return { freeze: updatedFreeze, approval, hitRecord: updatedHit };
};

export const rejectUnfreeze = async (
  freezeId: string,
  approver: string,
  comment: string
): Promise<{ freeze: any; approval: ApprovalRecord; hitRecord: any }> => {
  const freeze = await getFreezeById(freezeId);
  if (!freeze) throw new Error('冻结记录不存在');
  if (freeze.status === 'unfrozen') throw new Error('该账户已解冻');
  if (!freeze.unfreezeRequestedAt) throw new Error('尚未提交解冻申请');

  const approvalId = generateId();
  const createdAt = now();

  await runQuery(
    `INSERT INTO approval_records 
     (id, account_freeze_id, hit_record_id, decision, approver, comment, created_at)
     VALUES (?, ?, ?, 'rejected', ?, ?, ?)`,
    [approvalId, freezeId, freeze.hitRecordId, approver, comment, createdAt]
  );

  await updateHitRecordStatus(freeze.hitRecordId, 'unfreeze_rejected', 'unfreeze');

  await auditLog(
    'unfreeze_rejected',
    'account_freeze',
    freezeId,
    approver,
    {
      freezeId,
      hitRecordId: freeze.hitRecordId,
      accountId: freeze.accountId,
      comment,
      note: '解冻申请被驳回，账户保持冻结'
    }
  );

  const updatedFreeze = await getFreezeById(freezeId);
  const approval = await getApprovalRecordById(approvalId);
  const updatedHit = await getHitRecordById(freeze.hitRecordId);

  return { freeze: updatedFreeze, approval, hitRecord: updatedHit };
};

export const getApprovalRecordById = async (id: string): Promise<ApprovalRecord> => {
  const row = await getQuery(`SELECT * FROM approval_records WHERE id = ?`, [id]);
  return snakeToCamel(row) as ApprovalRecord;
};

export const closeHitRecord = async (
  hitId: string,
  actor: string
): Promise<any> => {
  const hitRecord = await getHitRecordById(hitId);
  if (!hitRecord) throw new Error('命中记录不存在');
  
  if (hitRecord.status === 'closed') throw new Error('该命中记录已关闭');

  await updateHitRecordStatus(hitId, 'closed', 'none');

  await auditLog(
    'hit_reviewed',
    'hit_record',
    hitId,
    actor,
    {
      previousStatus: hitRecord.status,
      newStatus: 'closed',
      note: '命中记录已关闭'
    }
  );

  return getHitRecordById(hitId);
};
