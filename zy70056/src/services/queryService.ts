import { allQuery } from '../db';
import { snakeToCamelAll, parseDetails } from '../utils';
import {
  getHitRecordById,
  getFreezeById,
  getHitRecordsByAccount,
  getFreezesByAccount,
  getFreezeByHitRecordId
} from './hitAndFreezeService';
import {
  getReviewRecordsByHit,
  getLastReviewRecord,
  getApprovalRecordsByFreeze,
  getLastApprovalRecord,
  getApprovalRecordsByHit
} from './reviewService';
import { getAuditLogsByEntity } from '../utils';
import type { HitStatus, FreezeStatus } from '../types';

export const getHitDetail = async (hitId: string) => {
  const hitRecord = await getHitRecordById(hitId);
  if (!hitRecord) throw new Error('命中记录不存在');

  const freeze = await getFreezeByHitRecordId(hitId);
  const reviewRecords = await getReviewRecordsByHit(hitId);
  const approvalRecords = await getApprovalRecordsByHit(hitId);
  const hitAuditLogs = await getAuditLogsByEntity('hit_record', hitId);

  const freezeAuditLogs = freeze 
    ? await getAuditLogsByEntity('account_freeze', freeze.id) 
    : [];

  const previousReview = reviewRecords.length > 1 
    ? reviewRecords[1] 
    : null;

  const previousApproval = approvalRecords.length > 1 
    ? approvalRecords[1] 
    : null;

  const currentBlock = hitRecord.currentBlock;
  
  let statusDescription = '';
  switch (hitRecord.status) {
    case 'pending_review':
      statusDescription = '等待人工复核 - 交易刚命中名单，账户已冻结，需要人工确认命中是否有效';
      break;
    case 'review_approved':
      statusDescription = '复核通过，可申请解冻 - 人工确认命中有效，可以发起解冻申请';
      break;
    case 'review_rejected':
      statusDescription = '复核被驳回 - 上一次复核不通过，需要重新处理后再次提交复核';
      break;
    case 'pending_unfreeze':
      statusDescription = '等待解冻审批 - 已提交解冻申请，等待审批通过';
      break;
    case 'unfreeze_approved':
      statusDescription = '解冻审批通过 - 账户已解除冻结，流程完成';
      break;
    case 'unfreeze_rejected':
      statusDescription = '解冻申请被驳回 - 上一次解冻申请不通过，可以重新申请';
      break;
    case 'closed':
      statusDescription = '已关闭 - 该命中记录已完结';
      break;
  }

  return {
    hitRecord,
    freeze,
    statusDescription,
    currentBlock: currentBlock === 'none' ? '无卡点' : `当前卡点: ${currentBlock}`,
    hasBlock: currentBlock !== 'none',
    blockInfo: {
      name: currentBlock,
      description: getBlockDescription(currentBlock, hitRecord.status)
    },
    reviewRecords,
    lastReview: reviewRecords[0] || null,
    previousReview,
    approvalRecords,
    lastApproval: approvalRecords[0] || null,
    previousApproval,
    auditLogs: [...hitAuditLogs, ...freezeAuditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  };
};

const getBlockDescription = (block: string, status: HitStatus): string => {
  switch (block) {
    case 'review':
      if (status === 'review_rejected') {
        return '在人工复核环节被驳回，需要查看上次复核意见并重新处理';
      }
      return '卡在人工复核环节，尚未处理';
    case 'unfreeze':
      if (status === 'unfreeze_rejected') {
        return '在解冻审批环节被驳回，需要查看上次审批意见并重新申请';
      }
      return '卡在解冻审批环节，等待审批';
    default:
      return '无当前卡点';
  }
};

export const getAccountSummary = async (accountId: string) => {
  const hitRecords = await getHitRecordsByAccount(accountId);
  const freezes = await getFreezesByAccount(accountId);
  
  const activeFreeze = freezes.find(f => f.status === 'frozen') || null;
  
  const pendingReview = hitRecords.filter(h => h.status === 'pending_review').length;
  const reviewRejected = hitRecords.filter(h => h.status === 'review_rejected').length;
  const pendingUnfreeze = hitRecords.filter(h => h.status === 'pending_unfreeze').length;
  const unfreezeRejected = hitRecords.filter(h => h.status === 'unfreeze_rejected').length;
  const approved = hitRecords.filter(h => 
    h.status === 'review_approved' || h.status === 'unfreeze_approved'
  ).length;
  const closed = hitRecords.filter(h => h.status === 'closed').length;

  const hitCount = hitRecords.length;
  const freezeCount = freezes.length;
  const unfrozenCount = freezes.filter(f => f.status === 'unfrozen').length;

  const blockedInReview = pendingReview + reviewRejected;
  const blockedInUnfreeze = pendingUnfreeze + unfreezeRejected;
  const totalBlocked = blockedInReview + blockedInUnfreeze;

  let currentStatus = '';
  if (activeFreeze) {
    if (blockedInReview > 0) {
      currentStatus = `账户已冻结，有 ${blockedInReview} 条记录卡在复核环节`;
    } else if (blockedInUnfreeze > 0) {
      currentStatus = `账户已冻结，有 ${blockedInUnfreeze} 条记录卡在解冻审批环节`;
    } else {
      currentStatus = '账户已冻结';
    }
  } else {
    currentStatus = '账户当前无活跃冻结';
  }

  return {
    accountId,
    currentStatus,
    isFrozen: !!activeFreeze,
    activeFreeze,
    hitRecords,
    freezes,
    summary: {
      totalHits: hitCount,
      totalFreezes: freezeCount,
      unfrozenCount,
      pendingReview,
      reviewRejected,
      approved,
      pendingUnfreeze,
      unfreezeRejected,
      closed,
      totalBlocked,
      blockedInReview,
      blockedInUnfreeze
    }
  };
};

export const getDashboardSummary = async () => {
  const allHits = await allQuery(
    `SELECT status, COUNT(*) as cnt FROM hit_records GROUP BY status`
  );
  
  const allFreezes = await allQuery(
    `SELECT status, COUNT(*) as cnt FROM account_freezes GROUP BY status`
  );

  const statusCount: Record<string, number> = {
    pending_review: 0,
    review_approved: 0,
    review_rejected: 0,
    pending_unfreeze: 0,
    unfreeze_approved: 0,
    unfreeze_rejected: 0,
    closed: 0
  };

  allHits.forEach(row => {
    statusCount[row.status] = row.cnt;
  });

  const freezeCount: Record<string, number> = {
    frozen: 0,
    unfrozen: 0
  };

  allFreezes.forEach(row => {
    freezeCount[row.status] = row.cnt;
  });

  const pendingWork = statusCount.pending_review + statusCount.review_rejected + 
                      statusCount.pending_unfreeze + statusCount.unfreeze_rejected;

  const needsReview = statusCount.pending_review + statusCount.review_rejected;
  const needsApproval = statusCount.pending_unfreeze + statusCount.unfreeze_rejected;

  return {
    totalHits: Object.values(statusCount).reduce((a, b) => a + b, 0),
    totalFreezes: Object.values(freezeCount).reduce((a, b) => a + b, 0),
    currentlyFrozen: freezeCount.frozen,
    unfrozen: freezeCount.unfrozen,
    pendingWork,
    needsReview,
    needsApproval,
    byStatus: {
      waitingReview: statusCount.pending_review,
      reviewApproved: statusCount.review_approved,
      reviewRejected: statusCount.review_rejected,
      waitingUnfreezeApproval: statusCount.pending_unfreeze,
      unfreezeApproved: statusCount.unfreeze_approved,
      unfreezeRejected: statusCount.unfreeze_rejected,
      closed: statusCount.closed
    }
  };
};

export const getFreezeDetail = async (freezeId: string) => {
  const freeze = await getFreezeById(freezeId);
  if (!freeze) throw new Error('冻结记录不存在');

  const hitRecord = await getHitRecordById(freeze.hitRecordId);
  const approvalRecords = await getApprovalRecordsByFreeze(freezeId);
  const freezeAuditLogs = await getAuditLogsByEntity('account_freeze', freezeId);
  const hitAuditLogs = await getAuditLogsByEntity('hit_record', freeze.hitRecordId);

  const previousApproval = approvalRecords.length > 1 
    ? approvalRecords[1] 
    : null;

  return {
    freeze,
    hitRecord,
    approvalRecords,
    lastApproval: approvalRecords[0] || null,
    previousApproval,
    auditLogs: [...freezeAuditLogs, ...hitAuditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  };
};
