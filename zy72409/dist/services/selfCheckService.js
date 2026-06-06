"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllChecks = runAllChecks;
exports.checkDuplicateImports = checkDuplicateImports;
exports.checkMixedTicketTypes = checkMixedTicketTypes;
exports.checkRecalculationConsistency = checkRecalculationConsistency;
exports.checkExportConsistency = checkExportConsistency;
const db_1 = require("../db");
const types_1 = require("../types");
const revenueService_1 = require("./revenueService");
function runAllChecks(batchId) {
    return [
        checkDuplicateImports(batchId),
        checkMixedTicketTypes(batchId),
        checkRecalculationConsistency(batchId),
        checkExportConsistency(batchId)
    ];
}
function checkDuplicateImports(batchId) {
    const duplicates = db_1.db.prepare(`
    SELECT source, ticket_number, attendee_name, COUNT(*) as cnt
    FROM ticket_records
    WHERE batch_id = ?
    GROUP BY source, ticket_number, attendee_name
    HAVING cnt > 1
  `).all(batchId);
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
function checkMixedTicketTypes(batchId) {
    const batch = db_1.db.prepare('SELECT * FROM show_batches WHERE id = ?').get(batchId);
    if (!batch) {
        return {
            checkType: 'mixed_tickets',
            passed: false,
            message: '批次不存在'
        };
    }
    const hasMixed = batch.has_mixed_tickets === 1;
    if (hasMixed) {
        const compCount = db_1.db.prepare(`
      SELECT SUM(quantity) as cnt FROM ticket_records 
      WHERE batch_id = ? AND ticket_type = ?
    `).get(batchId, types_1.TicketType.COMP);
        const paidCount = db_1.db.prepare(`
      SELECT SUM(quantity) as cnt FROM ticket_records 
      WHERE batch_id = ? AND ticket_type = ?
    `).get(batchId, types_1.TicketType.PAID);
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
function checkRecalculationConsistency(batchId) {
    const results = db_1.db.prepare(`
    SELECT * FROM revenue_split_results 
    WHERE batch_id = ? 
    ORDER BY version DESC
  `).all(batchId);
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
    const differences = [];
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
function checkExportConsistency(batchId) {
    const latestSplit = (0, revenueService_1.getLatestRevenueSplit)(batchId);
    if (!latestSplit) {
        return {
            checkType: 'export_consistency',
            passed: false,
            message: '尚无分成计算结果'
        };
    }
    const apiRecords = db_1.db.prepare(`
    SELECT ticket_type, SUM(quantity) as qty, SUM(price * quantity) as revenue
    FROM ticket_records 
    WHERE batch_id = ?
    GROUP BY ticket_type
  `).all(batchId);
    let apiPaidQty = 0;
    let apiCompQty = 0;
    let apiRevenue = 0;
    for (const record of apiRecords) {
        if (record.ticket_type === types_1.TicketType.PAID) {
            apiPaidQty = record.qty;
            apiRevenue = record.revenue;
        }
        else if (record.ticket_type === types_1.TicketType.COMP) {
            apiCompQty = record.qty;
        }
    }
    const issues = [];
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
