"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReconciliationSummary = exports.getReconciliationResults = exports.performReconciliation = void 0;
const connection_1 = require("../database/connection");
const schema_1 = require("../database/schema");
const anomalyService_1 = require("./anomalyService");
const uuid_1 = require("uuid");
const performReconciliation = async (taskId, params = {}) => {
    const { franchiseeId, startDate, endDate } = params;
    let orderWhere = '1=1';
    let orderParams = [];
    if (franchiseeId) {
        orderWhere += ' AND franchisee_id = ?';
        orderParams.push(franchiseeId);
    }
    if (startDate) {
        orderWhere += ' AND order_date >= ?';
        orderParams.push(startDate);
    }
    if (endDate) {
        orderWhere += ' AND order_date <= ?';
        orderParams.push(endDate);
    }
    const orderSummary = await (0, connection_1.runQuery)(`SELECT franchisee_id, material_code, material_name, SUM(quantity) as total_quantity, unit
     FROM ${schema_1.TABLES.ORDER_ITEMS}
     WHERE ${orderWhere}
     GROUP BY franchisee_id, material_code`, orderParams);
    const wasteSummary = await (0, connection_1.runQuery)(`SELECT franchisee_id, material_code, SUM(quantity) as total_quantity
     FROM ${schema_1.TABLES.WASTE_RECORDS}
     WHERE ${orderWhere.replace('order_date', 'waste_date')}
     GROUP BY franchisee_id, material_code`, orderParams);
    const supplementSummary = await (0, connection_1.runQuery)(`SELECT franchisee_id, material_code, SUM(quantity) as total_quantity
     FROM ${schema_1.TABLES.SUPPLEMENT_RECORDS}
     WHERE ${orderWhere.replace('order_date', 'supplement_date')}
     GROUP BY franchisee_id, material_code`, orderParams);
    const prices = await (0, connection_1.runQuery)(`SELECT p.material_code, p.price
     FROM ${schema_1.TABLES.HEADQUARTER_PRICES} p
     WHERE p.effective_date <= DATE('now')
     AND (p.expire_date IS NULL OR p.expire_date >= DATE('now'))`);
    const priceMap = new Map(prices.map(p => [p.material_code, p.price]));
    const wasteMap = new Map(wasteSummary.map(w => [`${w.franchisee_id}:${w.material_code}`, w.total_quantity]));
    const supplementMap = new Map(supplementSummary.map(s => [`${s.franchisee_id}:${s.material_code}`, s.total_quantity]));
    let resultCount = 0;
    let anomalyCount = 0;
    for (const order of orderSummary) {
        const key = `${order.franchisee_id}:${order.material_code}`;
        const wasteQty = wasteMap.get(key) || 0;
        const supplementQty = supplementMap.get(key) || 0;
        const expectedQuantity = order.total_quantity;
        const actualQuantity = order.total_quantity - wasteQty + supplementQty;
        const difference = actualQuantity - expectedQuantity;
        const unitPrice = priceMap.get(order.material_code) || 0;
        const differenceAmount = difference * unitPrice;
        const resultId = `result_${(0, uuid_1.v4)().slice(0, 24)}`;
        const status = Math.abs(difference) > 0.001 ? 'mismatch' : 'matched';
        await (0, connection_1.runInsert)(`INSERT INTO ${schema_1.TABLES.RECONCILIATION_RESULTS} (
        result_id, task_id, franchisee_id, material_code,
        expected_quantity, actual_quantity, difference,
        unit_price, difference_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            resultId, taskId, order.franchisee_id, order.material_code,
            expectedQuantity, actualQuantity, difference,
            unitPrice, differenceAmount, status
        ]);
        resultCount++;
        if (status === 'mismatch') {
            await (0, anomalyService_1.createAnomaly)(taskId, 'quantity_mismatch', Math.abs(differenceAmount) > 100 ? 'high' : 'medium', `加盟商 ${order.franchisee_id} 物料 ${order.material_code} 数量差异: ${difference.toFixed(2)}`, [resultId]);
            anomalyCount++;
        }
    }
    return {
        resultId: taskId,
        count: resultCount,
        anomalies: anomalyCount
    };
};
exports.performReconciliation = performReconciliation;
const getReconciliationResults = async (taskId) => {
    return await (0, connection_1.runQuery)(`SELECT r.*, o.material_name
     FROM ${schema_1.TABLES.RECONCILIATION_RESULTS} r
     LEFT JOIN ${schema_1.TABLES.ORDER_ITEMS} o ON r.franchisee_id = o.franchisee_id AND r.material_code = o.material_code
     WHERE r.task_id = ?
     GROUP BY r.result_id`, [taskId]);
};
exports.getReconciliationResults = getReconciliationResults;
const getReconciliationSummary = async (taskId) => {
    const results = await (0, connection_1.runQuery)(`SELECT status, COUNT(*) as count, SUM(ABS(difference_amount)) as total_amount
     FROM ${schema_1.TABLES.RECONCILIATION_RESULTS}
     WHERE task_id = ?
     GROUP BY status`, [taskId]);
    return {
        taskId,
        summary: results
    };
};
exports.getReconciliationSummary = getReconciliationSummary;
