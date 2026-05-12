import { getDb } from './database';
import { 
  TagScan, 
  TagPrintRecord, 
  CheckResult, 
  CheckIssue,
  CheckStatus,
  StatusHistory
} from './types';
import { runCheckRules, RuleResult } from './rules';
import { v4 as uuidv4 } from 'uuid';

export interface CheckOptions {
  storeId?: string;
  sku?: string;
  checkTime?: string;
}

export interface CheckSummary {
  total: number;
  pass: number;
  mustReprint: number;
  canContinue: number;
  needsManualCheck: number;
  manuallyApproved: number;
  manuallyRejected: number;
}

function nowISO(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function getUncheckedScans(options: CheckOptions): TagScan[] {
  const db = getDb();
  
  let sql = `
    SELECT DISTINCT ts.* 
    FROM tag_scans ts
    LEFT JOIN check_results cr ON ts.id = cr.scan_id
    WHERE cr.id IS NULL
  `;
  
  const params: any[] = [];
  
  if (options.storeId) {
    sql += ' AND ts.store_id = ?';
    params.push(options.storeId);
  }
  
  if (options.sku) {
    sql += ' AND ts.sku = ?';
    params.push(options.sku);
  }
  
  return db.prepare(sql).all(...params) as TagScan[];
}

function getPrintRecordsForStoreSku(storeId: string, sku: string): TagPrintRecord[] {
  const db = getDb();
  
  return db.prepare(`
    SELECT * FROM tag_print_records 
    WHERE store_id = ? AND sku = ?
    ORDER BY printed_at DESC
  `).all(storeId, sku) as TagPrintRecord[];
}

function saveCheckResult(
  scan: TagScan,
  ruleResult: RuleResult,
  checkTime: string
): CheckResult {
  const db = getDb();
  
  const existing = db.prepare(`
    SELECT * FROM check_results WHERE scan_id = ?
  `).get(scan.id) as CheckResult | undefined;
  
  if (existing) {
    return existing;
  }
  
  const resultId = uuidv4();
  const checkResult: CheckResult = {
    id: resultId,
    scan_id: scan.id,
    store_id: scan.store_id,
    sku: scan.sku,
    status: ruleResult.status,
    system_price: ruleResult.systemPrice,
    store_price: ruleResult.storePrice,
    printed_price: scan.scanned_price,
    scanned_price: scan.scanned_price,
    effective_promotion_id: ruleResult.effectivePromotionId,
    check_time: checkTime
  };
  
  db.prepare(`
    INSERT INTO check_results 
    (id, scan_id, store_id, sku, status, system_price, store_price, printed_price, scanned_price, effective_promotion_id, check_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    resultId,
    scan.id,
    scan.store_id,
    scan.sku,
    ruleResult.status,
    ruleResult.systemPrice,
    ruleResult.storePrice,
    scan.scanned_price,
    scan.scanned_price,
    ruleResult.effectivePromotionId,
    checkTime
  );
  
  const insertIssue = db.prepare(`
    INSERT INTO check_issues (id, check_result_id, issue_type, issue_code, issue_message, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const issue of ruleResult.issues) {
    const issueId = uuidv4();
    insertIssue.run(
      issueId,
      resultId,
      issue.issue_type,
      issue.issue_code,
      issue.issue_message,
      issue.severity
    );
  }
  
  const historyId = uuidv4();
  db.prepare(`
    INSERT INTO status_history (id, check_result_id, from_status, to_status, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    historyId,
    resultId,
    null,
    ruleResult.status,
    'Initial check completed',
    'system'
  );
  
  return checkResult;
}

export function runCheck(options: CheckOptions = {}): { 
  results: CheckResult[]; 
  summary: CheckSummary;
  checkTime: string;
} {
  const checkTime = options.checkTime || nowISO();
  const scans = getUncheckedScans(options);
  const results: CheckResult[] = [];
  
  for (const scan of scans) {
    const printRecords = getPrintRecordsForStoreSku(scan.store_id, scan.sku);
    
    const ruleResult = runCheckRules({
      scan,
      storeId: scan.store_id,
      sku: scan.sku,
      checkTime,
      allPrintRecords: printRecords
    });
    
    const checkResult = saveCheckResult(scan, ruleResult, checkTime);
    results.push(checkResult);
  }
  
  const summary = getCheckSummary(options);
  
  return { results, summary, checkTime };
}

export function getCheckSummary(options: CheckOptions = {}): CheckSummary {
  const db = getDb();
  
  let sql = 'SELECT status, COUNT(*) as cnt FROM check_results WHERE 1=1';
  const params: any[] = [];
  
  if (options.storeId) {
    sql += ' AND store_id = ?';
    params.push(options.storeId);
  }
  
  if (options.sku) {
    sql += ' AND sku = ?';
    params.push(options.sku);
  }
  
  sql += ' GROUP BY status';
  
  const rows = db.prepare(sql).all(...params) as { status: CheckStatus; cnt: number }[];
  
  const summary: CheckSummary = {
    total: 0,
    pass: 0,
    mustReprint: 0,
    canContinue: 0,
    needsManualCheck: 0,
    manuallyApproved: 0,
    manuallyRejected: 0
  };
  
  for (const row of rows) {
    summary.total += row.cnt;
    switch (row.status) {
      case 'PASS':
        summary.pass = row.cnt;
        break;
      case 'MUST_REPRINT':
        summary.mustReprint = row.cnt;
        break;
      case 'CAN_CONTINUE':
        summary.canContinue = row.cnt;
        break;
      case 'NEEDS_MANUAL_CHECK':
        summary.needsManualCheck = row.cnt;
        break;
      case 'MANUALLY_APPROVED':
        summary.manuallyApproved = row.cnt;
        break;
      case 'MANUALLY_REJECTED':
        summary.manuallyRejected = row.cnt;
        break;
    }
  }
  
  return summary;
}

export function getCheckResultByScanId(scanId: string): CheckResult | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM check_results WHERE scan_id = ?').get(scanId) as CheckResult | undefined;
}

export function getCheckResultById(id: string): CheckResult | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM check_results WHERE id = ?').get(id) as CheckResult | undefined;
}

export function getCheckIssues(resultId: string): CheckIssue[] {
  const db = getDb();
  return db.prepare('SELECT * FROM check_issues WHERE check_result_id = ?').all(resultId) as CheckIssue[];
}

export function getStatusHistory(resultId: string): StatusHistory[] {
  const db = getDb();
  return db.prepare('SELECT * FROM status_history WHERE check_result_id = ? ORDER BY created_at ASC').all(resultId) as StatusHistory[];
}

export function getAllCheckResults(options: CheckOptions = {}): CheckResult[] {
  const db = getDb();
  
  let sql = 'SELECT * FROM check_results WHERE 1=1';
  const params: any[] = [];
  
  if (options.storeId) {
    sql += ' AND store_id = ?';
    params.push(options.storeId);
  }
  
  if (options.sku) {
    sql += ' AND sku = ?';
    params.push(options.sku);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return db.prepare(sql).all(...params) as CheckResult[];
}

export function recheckAll(options: CheckOptions = {}): { 
  results: CheckResult[]; 
  summary: CheckSummary;
  checkTime: string;
} {
  return runCheck(options);
}
