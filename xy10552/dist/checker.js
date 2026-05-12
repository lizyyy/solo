"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheck = runCheck;
exports.getCheckSummary = getCheckSummary;
exports.getCheckResultByScanId = getCheckResultByScanId;
exports.getCheckResultById = getCheckResultById;
exports.getCheckIssues = getCheckIssues;
exports.getStatusHistory = getStatusHistory;
exports.getAllCheckResults = getAllCheckResults;
exports.recheckAll = recheckAll;
const database_1 = require("./database");
const rules_1 = require("./rules");
const uuid_1 = require("uuid");
function nowISO() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
function getUncheckedScans(options) {
    const db = (0, database_1.getDb)();
    let sql = `
    SELECT DISTINCT ts.* 
    FROM tag_scans ts
    LEFT JOIN check_results cr ON ts.id = cr.scan_id
    WHERE cr.id IS NULL
  `;
    const params = [];
    if (options.storeId) {
        sql += ' AND ts.store_id = ?';
        params.push(options.storeId);
    }
    if (options.sku) {
        sql += ' AND ts.sku = ?';
        params.push(options.sku);
    }
    return db.prepare(sql).all(...params);
}
function getPrintRecordsForStoreSku(storeId, sku) {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT * FROM tag_print_records 
    WHERE store_id = ? AND sku = ?
    ORDER BY printed_at DESC
  `).all(storeId, sku);
}
function saveCheckResult(scan, ruleResult, checkTime) {
    const db = (0, database_1.getDb)();
    const existing = db.prepare(`
    SELECT * FROM check_results WHERE scan_id = ?
  `).get(scan.id);
    if (existing) {
        return existing;
    }
    const resultId = (0, uuid_1.v4)();
    const checkResult = {
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
  `).run(resultId, scan.id, scan.store_id, scan.sku, ruleResult.status, ruleResult.systemPrice, ruleResult.storePrice, scan.scanned_price, scan.scanned_price, ruleResult.effectivePromotionId, checkTime);
    const insertIssue = db.prepare(`
    INSERT INTO check_issues (id, check_result_id, issue_type, issue_code, issue_message, severity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    for (const issue of ruleResult.issues) {
        const issueId = (0, uuid_1.v4)();
        insertIssue.run(issueId, resultId, issue.issue_type, issue.issue_code, issue.issue_message, issue.severity);
    }
    const historyId = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO status_history (id, check_result_id, from_status, to_status, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(historyId, resultId, null, ruleResult.status, 'Initial check completed', 'system');
    return checkResult;
}
function runCheck(options = {}) {
    const checkTime = options.checkTime || nowISO();
    const scans = getUncheckedScans(options);
    const results = [];
    for (const scan of scans) {
        const printRecords = getPrintRecordsForStoreSku(scan.store_id, scan.sku);
        const ruleResult = (0, rules_1.runCheckRules)({
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
function getCheckSummary(options = {}) {
    const db = (0, database_1.getDb)();
    let sql = 'SELECT status, COUNT(*) as cnt FROM check_results WHERE 1=1';
    const params = [];
    if (options.storeId) {
        sql += ' AND store_id = ?';
        params.push(options.storeId);
    }
    if (options.sku) {
        sql += ' AND sku = ?';
        params.push(options.sku);
    }
    sql += ' GROUP BY status';
    const rows = db.prepare(sql).all(...params);
    const summary = {
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
function getCheckResultByScanId(scanId) {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM check_results WHERE scan_id = ?').get(scanId);
}
function getCheckResultById(id) {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM check_results WHERE id = ?').get(id);
}
function getCheckIssues(resultId) {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM check_issues WHERE check_result_id = ?').all(resultId);
}
function getStatusHistory(resultId) {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM status_history WHERE check_result_id = ? ORDER BY created_at ASC').all(resultId);
}
function getAllCheckResults(options = {}) {
    const db = (0, database_1.getDb)();
    let sql = 'SELECT * FROM check_results WHERE 1=1';
    const params = [];
    if (options.storeId) {
        sql += ' AND store_id = ?';
        params.push(options.storeId);
    }
    if (options.sku) {
        sql += ' AND sku = ?';
        params.push(options.sku);
    }
    sql += ' ORDER BY created_at DESC';
    return db.prepare(sql).all(...params);
}
function recheckAll(options = {}) {
    return runCheck(options);
}
