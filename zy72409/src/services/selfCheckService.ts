import { db } from '../db';
import { SelfCheckResult, TicketType, DataSource } from '../types';
import { getLatestRevenueSplit } from './revenueService';
import { getCanonicalTickets } from './conflictService';

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
    SELECT source, import_version, ticket_number, attendee_name, COUNT(*) as cnt
    FROM ticket_records
    WHERE batch_id = ?
    GROUP BY source, import_version, ticket_number, attendee_name
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

  const versionCounts = db.prepare(`
    SELECT source, COUNT(DISTINCT import_version) as versions
    FROM ticket_records WHERE batch_id = ? GROUP BY source
  `).all(batchId) as any[];

  const reimported = versionCounts.filter(v => v.versions > 1);

  return {
    checkType: 'duplicate_imports',
    passed: true,
    message: reimported.length > 0
      ? `无同一版本内重复；检测到重传历史：${reimported.map(r => `${r.source} 有 v${r.versions}`).join('; ')}`
      : '无重复导入记录',
    details: reimported.length > 0 ? { historicalVersions: reimported } : undefined
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

  const canonicalTickets = getCanonicalTickets(batchId);
  let compCount = 0;
  let paidCount = 0;
  let sourceLabel = 'canonical_tickets';

  if (canonicalTickets.length > 0) {
    compCount = canonicalTickets.filter(t => t.ticketType === TicketType.COMP).reduce((s, t) => s + t.quantity, 0);
    paidCount = canonicalTickets.filter(t => t.ticketType === TicketType.PAID).reduce((s, t) => s + t.quantity, 0);
  } else {
    sourceLabel = 'ticket_records(latest import_version)';
    const compRow = db.prepare(`
      SELECT SUM(tr.quantity) as cnt FROM ticket_records tr
      INNER JOIN (
        SELECT source, MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? GROUP BY source
      ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
      WHERE tr.batch_id = ? AND tr.ticket_type = ?
    `).get(batchId, batchId, TicketType.COMP) as any;
    const paidRow = db.prepare(`
      SELECT SUM(tr.quantity) as cnt FROM ticket_records tr
      INNER JOIN (
        SELECT source, MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? GROUP BY source
      ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
      WHERE tr.batch_id = ? AND tr.ticket_type = ?
    `).get(batchId, batchId, TicketType.PAID) as any;
    compCount = compRow?.cnt || 0;
    paidCount = paidRow?.cnt || 0;
  }

  const hasMixed = compCount > 0 && paidCount > 0;
  
  if (hasMixed) {
    return {
      checkType: 'mixed_tickets',
      passed: false,
      message: `[${sourceLabel}] 批次存在赠票和售票混合，需录音师复核：赠票 ${compCount} 张，售票 ${paidCount} 张`,
      details: { compCount, paidCount, source: sourceLabel, needsAudioEngineerReview: true }
    };
  }

  return {
    checkType: 'mixed_tickets',
    passed: true,
    message: `[${sourceLabel}] 批次票务类型一致，无混合`
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

  const fields = ['total_tickets', 'total_paid_tickets', 'total_comp_tickets', 'total_revenue', 'authoritative_source'];
  const differences: string[] = [];

  for (const field of fields) {
    const l = String(latest[field] ?? '');
    const p = String(previous[field] ?? '');
    if (l !== p) {
      differences.push(`${field}: ${p} -> ${l}`);
    }
  }

  if (differences.length > 0) {
    return {
      checkType: 'recalculation_consistency',
      passed: false,
      message: `补录后重算发现数据变动（${differences.length} 项）：${differences.join('; ')}`,
      details: { previousVersion: previous.version, latestVersion: latest.version, differences }
    };
  }

  return {
    checkType: 'recalculation_consistency',
    passed: true,
    message: `重算结果一致（v${previous.version} -> v${latest.version}），口径: ${latest.authoritative_source || '未设置'}`
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

  const canonicalTickets = getCanonicalTickets(batchId);
  const batch = db.prepare('SELECT authoritative_source FROM show_batches WHERE id = ?').get(batchId) as any;

  let apiPaidQty = 0;
  let apiCompQty = 0;
  let apiRevenue = 0;
  let sourceLabel = '';

  if (canonicalTickets.length > 0) {
    sourceLabel = `canonical_tickets (authoritative_source=${batch?.authoritative_source || 'N/A'})`;
    for (const t of canonicalTickets) {
      if (t.ticketType === TicketType.PAID) {
        apiPaidQty += t.quantity;
        apiRevenue += t.price * t.quantity;
      } else if (t.ticketType === TicketType.COMP) {
        apiCompQty += t.quantity;
      }
    }
  } else {
    sourceLabel = 'ticket_records (pre-canonical)';
    const apiRecords = db.prepare(`
      SELECT tr.ticket_type, SUM(tr.quantity) as qty, SUM(tr.price * tr.quantity) as revenue
      FROM ticket_records tr
      INNER JOIN (
        SELECT source, MAX(import_version) as max_v FROM ticket_records WHERE batch_id = ? GROUP BY source
      ) latest ON tr.source = latest.source AND tr.import_version = latest.max_v
      WHERE tr.batch_id = ?
      GROUP BY tr.ticket_type
    `).all(batchId, batchId) as any[];

    for (const record of apiRecords) {
      if (record.ticket_type === TicketType.PAID) {
        apiPaidQty = record.qty;
        apiRevenue = record.revenue;
      } else if (record.ticket_type === TicketType.COMP) {
        apiCompQty = record.qty;
      }
    }
  }

  const issues: string[] = [];
  
  if (apiPaidQty !== latestSplit.totalPaidTickets) {
    issues.push(`售票数量不一致：${sourceLabel}=${apiPaidQty} / revenue_split_results=${latestSplit.totalPaidTickets}`);
  }
  if (apiCompQty !== latestSplit.totalCompTickets) {
    issues.push(`赠票数量不一致：${sourceLabel}=${apiCompQty} / revenue_split_results=${latestSplit.totalCompTickets}`);
  }
  if (Math.abs(apiRevenue - latestSplit.totalRevenue) > 0.01) {
    issues.push(`总金额不一致：${sourceLabel}=${apiRevenue} / revenue_split_results=${latestSplit.totalRevenue}`);
  }

  if (issues.length > 0) {
    return {
      checkType: 'export_consistency',
      passed: false,
      message: `导出一致性检查失败：${issues.join('; ')}`,
      details: { source: sourceLabel, issues, apiValues: { paid: apiPaidQty, comp: apiCompQty, revenue: apiRevenue } }
    };
  }

  return {
    checkType: 'export_consistency',
    passed: true,
    message: `[${sourceLabel}] 接口、页面、导出数据一致，同一条记录可追踪`,
    details: { source: sourceLabel, authoritativeSource: batch?.authoritative_source }
  };
}
