import {
  FactRecord,
  OrderCalendar,
  CleaningMessage,
  MaintenanceNote,
  ApprovalEmail,
  SupplierStatement
} from '../types';
import {
  getFactRecordsByDateRange, getSupplierStatements, upsertFactRecord, generateFactId, getFactRecord } from '../database';

export interface ReconciliationResult {
  periodStart: string;
  periodEnd: string;
  totalFactRecords: number;
  matchedRecords: number;
  mismatchedRecords: number;
  pendingRecords: number;
  mismatchDetails: MismatchDetail[];
  supplierMatches: SupplierMatch[];
  totalVerifiedAmount: number;
  totalBilledAmount: number;
  discrepancy: number;
}

export interface MismatchDetail {
  factId: string;
  roomId: string;
  date: string;
  reasons: string[];
  orderInfo?: OrderCalendar;
  cleaningInfo?: CleaningMessage;
  maintenanceCount: number;
  approvalCount: number;
}

export interface SupplierMatch {
  statementId: string;
  supplierName: string;
  matchedItems: number;
  mismatchedItems: number;
  matchedAmount: number;
  mismatchedAmount: number;
}

export async function performReconciliation(
  periodStart: string,
  periodEnd: string
): Promise<ReconciliationResult> {
  console.log(`[Reconciliation] Starting reconciliation for ${periodStart} to ${periodEnd}`);

  const factRecords = await getFactRecordsByDateRange(periodStart, periodEnd);
  const supplierStatements = await getSupplierStatements();

  const mismatchDetails: MismatchDetail[] = [];
  let matchedCount = 0;
  let mismatchedCount = 0;
  let pendingCount = 0;
  let totalVerifiedAmount = 0;

  for (const fact of factRecords) {
    const result = analyzeFactRecord(fact);
    
    if (result.status === 'matched') {
      matchedCount++;
      totalVerifiedAmount += result.verifiedAmount || 0;
      await upsertFactRecord(
        fact.factId,
        fact.roomId,
        fact.date,
        {
          reconciliationStatus: 'matched',
          mismatchReasons: [],
          verifiedAmount: result.verifiedAmount
        },
        'reconciliation_service'
      );
    } else if (result.status === 'mismatch') {
      mismatchedCount++;
      mismatchDetails.push({
        factId: fact.factId,
        roomId: fact.roomId,
        date: fact.date,
        reasons: result.reasons,
        orderInfo: fact.orderInfo,
        cleaningInfo: fact.cleaningInfo,
        maintenanceCount: fact.maintenanceInfo?.length || 0,
        approvalCount: fact.approvalInfo?.length || 0
      });
      await upsertFactRecord(
        fact.factId,
        fact.roomId,
        fact.date,
        {
          reconciliationStatus: 'mismatch',
          mismatchReasons: result.reasons,
          verifiedAmount: result.verifiedAmount
        },
        'reconciliation_service'
      );
    } else {
      pendingCount++;
    }
  }

  const supplierMatches = await matchSupplierStatements(
    supplierStatements,
    factRecords,
    periodStart,
    periodEnd
  );

  const totalBilledAmount = supplierMatches.reduce(
    (sum, m) => sum + m.matchedAmount + m.mismatchedAmount,
    0
  );

  return {
    periodStart,
    periodEnd,
    totalFactRecords: factRecords.length,
    matchedRecords: matchedCount,
    mismatchedRecords: mismatchedCount,
    pendingRecords: pendingCount,
    mismatchDetails,
    supplierMatches,
    totalVerifiedAmount,
    totalBilledAmount,
    discrepancy: totalVerifiedAmount - totalBilledAmount
  };
}

interface FactAnalysis {
  status: 'matched' | 'mismatch' | 'pending';
  reasons: string[];
  verifiedAmount?: number;
}

function analyzeFactRecord(fact: FactRecord): FactAnalysis {
  const reasons: string[] = [];
  let verifiedAmount = 0;

  if (!fact.orderInfo && !fact.cleaningInfo) {
    return { status: 'pending', reasons: [] };
  }

  if (fact.cleaningInfo) {
    verifiedAmount += calculateCleaningCost(fact.cleaningInfo);
  }

  if (fact.maintenanceInfo) {
    for (const maint of fact.maintenanceInfo) {
      if (maint.status === 'resolved' && fact.approvalInfo) {
        const relatedApproval = fact.approvalInfo.find(
          a => a.requestType === 'maintenance' && a.status === 'approved'
        );
        if (relatedApproval && relatedApproval.amount) {
          verifiedAmount += relatedApproval.amount;
        }
      }
    }
  }

  if (fact.orderInfo && fact.cleaningInfo) {
    const order = fact.orderInfo;
    const cleaning = fact.cleaningInfo;

    const checkIn = new Date(order.checkInDate);
    const checkOut = new Date(order.checkOutDate);
    const cleaningDate = new Date(cleaning.scheduledDate);

    if (cleaningDate >= checkIn && cleaningDate < checkOut) {
      if (order.isContinuousStay && !order.linenChangeRequired) {
        if (cleaning.cleaningType === 'linen_change') {
          reasons.push('连住客人未要求换布草，但安排了换布草保洁');
        }
      }
    }

    if (order.isContinuousStay && order.nights > 1) {
      const expectedCleaningType = cleaningDate.getTime() === checkOut.getTime() - 86400000 
        ? 'checkout' 
        : 'daily';
      if (cleaning.cleaningType !== expectedCleaningType && 
          !(order.linenChangeRequired && cleaning.cleaningType === 'linen_change')) {
        reasons.push(`保洁类型不匹配：预期${expectedCleaningType}，实际${cleaning.cleaningType}`);
      }
    }
  }

  if (fact.cleaningInfo && fact.cleaningInfo.status !== 'completed') {
    reasons.push('保洁任务未完成');
  }

  return {
    status: reasons.length === 0 ? 'matched' : 'mismatch',
    reasons,
    verifiedAmount
  };
}

function calculateCleaningCost(cleaning: CleaningMessage): number {
  const pricing: Record<string, number> = {
    'daily': 50,
    'checkout': 80,
    'linen_change': 30,
    'deep_clean': 120
  };
  return pricing[cleaning.cleaningType] || 50;
}

async function matchSupplierStatements(
  statements: SupplierStatement[],
  factRecords: FactRecord[],
  periodStart: string,
  periodEnd: string
): Promise<SupplierMatch[]> {
  const matches: SupplierMatch[] = [];

  for (const statement of statements) {
    if (statement.periodStart > periodEnd || statement.periodEnd < periodStart) {
      continue;
    }

    let matchedItems = 0;
    let mismatchedItems = 0;
    let matchedAmount = 0;
    let mismatchedAmount = 0;

    for (const item of statement.items) {
      if (!item.date || !item.roomId) {
        mismatchedItems++;
        mismatchedAmount += item.subtotal || 0;
        continue;
      }

      const factId = generateFactId(item.roomId, item.date);
      const fact = factRecords.find(f => f.factId === factId);

      if (fact && fact.verifiedAmount !== undefined) {
        if (Math.abs(fact.verifiedAmount - (item.subtotal || 0)) <= 0.01) {
          matchedItems++;
          matchedAmount += item.subtotal || 0;
        } else {
          mismatchedItems++;
          mismatchedAmount += item.subtotal || 0;
        }
      } else {
        mismatchedItems++;
        mismatchedAmount += item.subtotal || 0;
      }
    }

    matches.push({
      statementId: statement.statementId,
      supplierName: statement.supplierName,
      matchedItems,
      mismatchedItems,
      matchedAmount,
      mismatchedAmount
    });
  }

  return matches;
}

export async function reprocessFactRecord(factId: string): Promise<FactRecord | null> {
  const fact = await getFactRecord(factId);
  if (!fact) {
    return null;
  }

  const analysis = analyzeFactRecord(fact);

  return await upsertFactRecord(
    factId,
    fact.roomId,
    fact.date,
    {
      reconciliationStatus: analysis.status,
      mismatchReasons: analysis.reasons,
      verifiedAmount: analysis.verifiedAmount
    },
    'manual_reprocess'
  );
}

export function getReconciliationSummary(result: ReconciliationResult): string {
  const lines = [];
  lines.push(`=== 对账报告: ${result.periodStart} 至 ${result.periodEnd}`);
  lines.push(`事实记录总数: ${result.totalFactRecords}`);
  lines.push(`  - 已匹配: ${result.matchedRecords} (${((result.matchedRecords / result.totalFactRecords * 100).toFixed(1)}%)`);
  lines.push(`  - 不匹配: ${result.mismatchedRecords}`);
  lines.push(`  - 待处理: ${result.pendingRecords}`);
  lines.push(`验证总金额: ¥${result.totalVerifiedAmount.toFixed(2)}`);
  lines.push(`账单总金额: ¥${result.totalBilledAmount.toFixed(2)}`);
  lines.push(`差额: ¥${result.discrepancy.toFixed(2)}`);
  
  if (result.mismatchDetails.length > 0) {
    lines.push('\n不匹配明细:');
    for (const detail of result.mismatchDetails.slice(0, 5)) {
      lines.push(`  ${detail.date} 房间${detail.roomId}: ${detail.reasons.join(', ')}`);
    }
    if (result.mismatchDetails.length > 5) {
      lines.push(`  ... 还有 ${result.mismatchDetails.length - 5} 条不匹配记录`);
    }
  }

  return lines.join('\n');
}
