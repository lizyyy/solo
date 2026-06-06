import { db } from '../db';
import { SelfCheckResult, TicketType, DataSource } from '../types';
import { getLatestRevenueSplit } from './revenueService';

export function runAllChecks(batchId: number): SelfCheckResult[] {
  return [
    checkDuplicateImports(batchId),
    checkMixedTicketTypes(batchId),
    checkRecalculationConsistency(batchId),
    checkExportConsistency(batchId)
  ];
}

export function checkDuplicateImports(batchId: number): SelfCheckResult {
  const duplicates = db.prepare(`
    SELECT source, ticket_number, attendee_name, COUNT(*) as cnt
    FROM ticket_records
    WHERE batch_id = ?
    GROUP BY source, ticket_number, attendee_name
    HAVING cnt > 1
  `).all(batchId) as any[];

  if (duplicates.length > 0) {
    return {
      checkType: 'duplicate_imports',
      passed: false,
      message: `发现 ${duplicates.length} 条重复导入记录`,
      details: duplicates
    };
  }

  return {
    checkType: 'duplicate_imports',
    passed: true,
    message: '无重复导入记录'
  };
}

export function checkMixedTicketTypes(batchId: number): SelfCheckResult {
  const batch = db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId) as any;
  
  if (!batch) {
    return {
      checkType: 'mixed_tickets',
      passed: false,
      message: '批次不存在'
    };
  }

  const hasMixed = batch.has_mixed_tickets === 1;
  
  if (hasMixed) {
    const compCount = db.prepare(`
      SELECT SUM(quantity) as cnt FROM ticket_records 
      WHERE batch_id = ? AND ticket_type = ?
    `).get(batchId, TicketType.COMP) as any;
    
    const paidCount = db.prepare(`
      SELECT SUM(quantity) as cnt FROM ticket_records 
      WHERE batch_id = ? AND ticket_type = ?
    `).get(batchId, TicketType.PAID) as any;

    return {
      checkType: 'mixed_tickets',
      passed: false,
      message: `批次存在赠票和售票混合，需录音师复核：赠票 ${compCount?.cnt || 0} 张，售票 ${paidCount?.cnt || 0} 张`,
      details: { compCount: compCount?.cnt || 0, paidCount: paidCount?.cnt || 0 }
    };
  }

  return {
    checkType: 'mixed_tickets',
    passed: true,
    message: '批次票务类型一致，无混合'
  };
}

export function checkRecalculationConsistency(batchId: number): SelfCheckResult {
  const results = db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC
  `).all(batchId) as any[];

  if (results.length < 2) {
    return {
      checkType: 'recalculation_consistency',
      passed: true,
      message: '版本不足，跳过重算一致性检查'
    };
  }

  const latest = results[0];
  const previous = results[1];

  const fields = ['total_tickets', 'total_paid_tickets', 'total_comp_tickets', 'total_revenue'];
  const differences: string[] = [];

  for (const field of fields) {
    if (Math.abs(latest[field] - previous[field]) > 0.01) {
      differences.push(`${field}: ${previous[field]} -> ${latest[field]}`);
    }
  }

  if (differences.length > 0) {
    return {
      checkType: 'recalculation_consistency',
      passed: false,
      message: `补录后重算发现数据变动：${differences.join('; ')}`,
      details: differences
    };
  }

  return {
    checkType: 'recalculation_consistency',
    passed: true,
    message: '重算结果一致'
  };
}

export function checkExportConsistency(batchId: number): SelfCheckResult {
  const latestSplit = getLatestRevenueSplit(batchId);
  
  if (!latestSplit) {
    return {
      checkType: 'export_consistency',
      passed: false,
      message: '尚无分成计算结果'
    };
  }

  const apiRecords = db.prepare(`
    SELECT ticket_type, SUM(quantity) as qty, SUM(price * quantity) as revenue
    FROM ticket_records 
    WHERE batch_id = ?
    GROUP BY ticket_type
  `).all(batchId) as any[];

  let apiPaidQty = 0;
  let apiCompQty = 0;
  let apiRevenue = 0;

  for (const record of apiRecords) {
    if (record.ticket_type === TicketType.PAID) {
      apiPaidQty = record.qty;
      apiRevenue = record.revenue;
    } else if (record.ticket_type === TicketType.COMP) {
      apiCompQty = record.qty;
    }
  }

  const issues: string[] = [];
  
  if (apiPaidQty !== latestSplit.totalPaidTickets) {
    issues.push(`售票数量不一致：接口 ${apiPaidQty} / 结果 ${latestSplit.totalPaidTickets}`);
  }
  if (apiCompQty !== latestSplit.totalCompTickets) {
    issues.push(`赠票数量不一致：接口 ${apiCompQty} / 结果 ${latestSplit.totalCompTickets}`);
  }
  if (Math.abs(apiRevenue - latestSplit.totalRevenue) > 0.01) {
    issues.push(`总金额不一致：接口 ${apiRevenue} / 结果 ${latestSplit.totalRevenue}`);
  }

  if (issues.length > 0) {
    return {
      checkType: 'export_consistency',
      passed: false,
      message: `导出一致性检查失败：${issues.join('; ')}`,
      details: issues
    };
  }

  return {
    checkType: 'export_consistency',
    passed: true,
    message: '接口、页面、导出数据一致'
  };
}
