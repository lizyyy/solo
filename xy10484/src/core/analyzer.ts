import crypto from 'crypto';
import {
  DataStore,
  Abnormal,
  Issue,
  AbnormalType,
  IssueType,
  Order,
  SignRecord,
  RefuseRecord,
  ClaimRecord,
} from '../types';

function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function toDate(dateStr: string): Date {
  return new Date(dateStr);
}

function compareDates(a: string, b: string): number {
  return toDate(a).getTime() - toDate(b).getTime();
}

function isDateBefore(a: string, b: string): boolean {
  return compareDates(a, b) < 0;
}

function findOrdersByTrackingNo(store: DataStore, trackingNo: string): Order[] {
  return store.orders.filter((o) => o.trackingNo === trackingNo);
}

function findSignRecordsByTrackingNo(store: DataStore, trackingNo: string): SignRecord[] {
  return store.signRecords.filter((s) => s.trackingNo === trackingNo);
}

function findRefuseRecordsByTrackingNo(store: DataStore, trackingNo: string): RefuseRecord[] {
  return store.refuseRecords.filter((r) => r.trackingNo === trackingNo);
}

function findClaimRecordsByTrackingNo(store: DataStore, trackingNo: string): ClaimRecord[] {
  return store.claimRecords.filter((c) => c.trackingNo === trackingNo);
}

function checkClosedWithoutSign(store: DataStore, existingAbnormalIds: Set<string>): Abnormal[] {
  const abnormals: Abnormal[] = [];
  const closedOrders = store.orders.filter((o) => o.status === 'closed' || o.status === 'delivered');
  
  for (const order of closedOrders) {
    const signRecords = findSignRecordsByTrackingNo(store, order.trackingNo);
    const hasValidSign = signRecords.some((s) => s.status === 'success');
    
    if (!hasValidSign) {
      const abnormalId = `closed-${order.trackingNo}`;
      if (!existingAbnormalIds.has(abnormalId)) {
        existingAbnormalIds.add(abnormalId);
        abnormals.push({
          id: abnormalId,
          type: 'closed_without_sign',
          trackingNo: order.trackingNo,
          orderNo: order.orderNo,
          description: `订单 ${order.orderNo} 已结案但未找到有效签收记录`,
          detectedAt: new Date().toISOString(),
          reviewed: false,
          matchedData: {
            order,
            signRecords,
          },
        });
      }
    }
  }
  
  return abnormals;
}

function checkSignWithoutProof(store: DataStore, existingAbnormalIds: Set<string>): Abnormal[] {
  const abnormals: Abnormal[] = [];
  const successSigns = store.signRecords.filter((s) => s.status === 'success');
  
  for (const sign of successSigns) {
    if (!sign.hasPhoto) {
      const abnormalId = `proof-${sign.trackingNo}-${sign.signedAt}`;
      if (!existingAbnormalIds.has(abnormalId)) {
        existingAbnormalIds.add(abnormalId);
        const orders = findOrdersByTrackingNo(store, sign.trackingNo);
        abnormals.push({
          id: abnormalId,
          type: 'sign_without_proof',
          trackingNo: sign.trackingNo,
          orderNo: orders[0]?.orderNo || '',
          description: `运单 ${sign.trackingNo} 已签收但缺少签收照片凭证`,
          detectedAt: new Date().toISOString(),
          reviewed: false,
          matchedData: {
            order: orders[0],
            signRecords: [sign],
          },
        });
      }
    }
  }
  
  return abnormals;
}

function checkDeliveredAfterRefuse(store: DataStore, existingAbnormalIds: Set<string>): Abnormal[] {
  const abnormals: Abnormal[] = [];
  
  for (const trackingNo of new Set(store.refuseRecords.map((r) => r.trackingNo))) {
    const refuses = findRefuseRecordsByTrackingNo(store, trackingNo);
    const signs = findSignRecordsByTrackingNo(store, trackingNo);
    const successSigns = signs.filter((s) => s.status === 'success');
    
    for (const refuse of refuses) {
      for (const sign of successSigns) {
        if (isDateBefore(refuse.refusedAt, sign.signedAt)) {
          const abnormalId = `refuse-${trackingNo}-${refuse.refusedAt}-${sign.signedAt}`;
          if (!existingAbnormalIds.has(abnormalId)) {
            existingAbnormalIds.add(abnormalId);
            const orders = findOrdersByTrackingNo(store, trackingNo);
            abnormals.push({
              id: abnormalId,
              type: 'delivered_after_refuse',
              trackingNo,
              orderNo: orders[0]?.orderNo || '',
              description: `运单 ${trackingNo} 在拒收(${refuse.refusedAt})后又被签收(${sign.signedAt})`,
              detectedAt: new Date().toISOString(),
              reviewed: false,
              matchedData: {
                order: orders[0],
                refuseRecords: refuses,
                signRecords: signs,
              },
            });
          }
        }
      }
    }
  }
  
  return abnormals;
}

function checkDuplicateClaim(store: DataStore, existingAbnormalIds: Set<string>): Abnormal[] {
  const abnormals: Abnormal[] = [];
  const trackingNos = new Set(store.claimRecords.map((c) => c.trackingNo));
  
  for (const trackingNo of trackingNos) {
    const claims = findClaimRecordsByTrackingNo(store, trackingNo).filter(
      (c) => c.status === 'pending' || c.status === 'approved'
    );
    
    if (claims.length >= 2) {
      const abnormalId = `duplicate-${trackingNo}`;
      if (!existingAbnormalIds.has(abnormalId)) {
        existingAbnormalIds.add(abnormalId);
        const orders = findOrdersByTrackingNo(store, trackingNo);
        abnormals.push({
          id: abnormalId,
          type: 'duplicate_claim',
          trackingNo,
          orderNo: orders[0]?.orderNo || '',
          description: `运单 ${trackingNo} 存在 ${claims.length} 条有效赔付申请`,
          detectedAt: new Date().toISOString(),
          reviewed: false,
          matchedData: {
            order: orders[0],
            claimRecords: claims,
          },
        });
      }
    }
  }
  
  return abnormals;
}

function checkMissingTrackingNo(
  records: { trackingNo?: string }[],
  source: string,
  existingIssueIds: Set<string>
): Issue[] {
  const issues: Issue[] = [];
  
  for (const record of records) {
    if (!record.trackingNo || record.trackingNo.trim() === '') {
      const issueId = `missing-${source}-${generateId()}`;
      if (!existingIssueIds.has(issueId)) {
        existingIssueIds.add(issueId);
        issues.push({
          id: issueId,
          type: 'missing_tracking_no',
          description: `${source} 记录缺少运单号`,
          source,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }
  
  return issues;
}

function checkSignBeforeShip(store: DataStore, existingIssueIds: Set<string>): Issue[] {
  const issues: Issue[] = [];
  
  for (const sign of store.signRecords) {
    if (!sign.trackingNo) continue;
    
    const orders = findOrdersByTrackingNo(store, sign.trackingNo);
    for (const order of orders) {
      if (order.shippedAt && sign.signedAt && isDateBefore(sign.signedAt, order.shippedAt)) {
        const issueId = `early-sign-${sign.trackingNo}-${sign.signedAt}`;
        if (!existingIssueIds.has(issueId)) {
          existingIssueIds.add(issueId);
          issues.push({
            id: issueId,
            type: 'sign_before_ship',
            trackingNo: sign.trackingNo,
            description: `运单 ${sign.trackingNo} 签收时间(${sign.signedAt})早于发货时间(${order.shippedAt})`,
            source: '签收记录',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
  
  return issues;
}

function checkClaimExceedsOrder(store: DataStore, existingIssueIds: Set<string>): Issue[] {
  const issues: Issue[] = [];
  
  for (const claim of store.claimRecords) {
    if (!claim.trackingNo) continue;
    
    const orders = findOrdersByTrackingNo(store, claim.trackingNo);
    for (const order of orders) {
      if (claim.amount > order.amount) {
        const issueId = `over-claim-${claim.claimId || claim.trackingNo}`;
        if (!existingIssueIds.has(issueId)) {
          existingIssueIds.add(issueId);
          issues.push({
            id: issueId,
            type: 'claim_exceeds_order',
            trackingNo: claim.trackingNo,
            description: `赔付金额(${claim.amount})超过订单金额(${order.amount})，运单: ${claim.trackingNo}`,
            source: '赔付记录',
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
  
  return issues;
}

export function analyzeAbnormals(store: DataStore): Abnormal[] {
  const existingIds = new Set(store.abnormals.map((a) => a.id));
  const abnormals: Abnormal[] = [];
  
  abnormals.push(...checkClosedWithoutSign(store, existingIds));
  abnormals.push(...checkSignWithoutProof(store, existingIds));
  abnormals.push(...checkDeliveredAfterRefuse(store, existingIds));
  abnormals.push(...checkDuplicateClaim(store, existingIds));
  
  return abnormals;
}

export function analyzeIssues(store: DataStore): Issue[] {
  const existingIds = new Set(store.issues.map((i) => i.id));
  const issues: Issue[] = [];
  
  issues.push(...checkMissingTrackingNo(store.signRecords, '签收记录', existingIds));
  issues.push(...checkMissingTrackingNo(store.refuseRecords, '拒收记录', existingIds));
  issues.push(...checkMissingTrackingNo(store.claimRecords, '赔付记录', existingIds));
  issues.push(...checkSignBeforeShip(store, existingIds));
  issues.push(...checkClaimExceedsOrder(store, existingIds));
  
  return issues;
}

export const ABNORMAL_TYPE_LABELS: Record<AbnormalType, string> = {
  closed_without_sign: '未签收却结案',
  sign_without_proof: '签收无凭证',
  delivered_after_refuse: '拒收后仍派送成功',
  duplicate_claim: '赔付重复申请',
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  missing_tracking_no: '缺少运单号',
  sign_before_ship: '签收时间早于发货',
  claim_exceeds_order: '赔付金额超订单金额',
};
