"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingLiabilityOrders = exports.getLiabilityJudgment = exports.manualJudgeLiability = exports.autoJudgeLiability = exports.getLiabilityPartyName = void 0;
const database_1 = require("../database");
const response_1 = require("../utils/response");
const orderService_1 = require("./orderService");
const mealTimerService_1 = require("./mealTimerService");
const idempotentService_1 = require("./idempotentService");
const getLiabilityPartyName = (party) => {
    const names = {
        merchant: '商家',
        rider: '骑手',
        platform: '平台',
        user: '用户',
        unknown: '待确认',
        none: '无责任',
    };
    return names[party] || party;
};
exports.getLiabilityPartyName = getLiabilityPartyName;
const analyzeOrderNodes = (order, nodes) => {
    let merchantCookingTime = 0;
    let riderWaitTime = 0;
    let hasMerchantDelay = false;
    let hasRiderDelay = false;
    let cookingStart = null;
    let mealReady = null;
    let riderAssigned = null;
    let riderPickedUp = null;
    for (const node of nodes) {
        if (node.node_type === 'start_cooking') {
            cookingStart = node.created_at;
        }
        else if (node.node_type === 'meal_ready') {
            mealReady = node.created_at;
        }
        else if (node.node_type === 'rider_assign') {
            riderAssigned = node.created_at;
        }
        else if (node.node_type === 'rider_pickup') {
            riderPickedUp = node.created_at;
        }
    }
    if (cookingStart && mealReady) {
        merchantCookingTime = (mealReady - cookingStart) / (1000 * 60);
        const threshold = order.expected_meal_minutes * 1.2;
        hasMerchantDelay = merchantCookingTime > threshold;
    }
    else if (order.status === 'created' || order.status === 'merchant_accepted' || order.status === 'cooking') {
        hasMerchantDelay = true;
        hasRiderDelay = false;
    }
    if (mealReady && riderPickedUp) {
        riderWaitTime = (riderPickedUp - mealReady) / (1000 * 60);
        hasRiderDelay = riderWaitTime > 15;
    }
    return {
        hasMerchantDelay: !!hasMerchantDelay,
        hasRiderDelay: !!hasRiderDelay,
        merchantCookingTime,
        riderWaitTime,
    };
};
const autoJudgeLiability = (orderId) => {
    const db = (0, database_1.getDb)();
    const order = (0, orderService_1.getOrderById)(orderId);
    const timer = (0, mealTimerService_1.getMealTimer)(orderId);
    const nodes = (0, orderService_1.getOrderNodes)(orderId);
    if (!timer) {
        throw new response_1.BusinessError('计时器不存在', '该订单没有启动出餐计时器，无法判定责任', 'TIMER_NOT_FOUND');
    }
    const existing = (0, database_1.executeGet)('SELECT * FROM liability_judgments WHERE order_id = ?', [orderId]);
    if (existing) {
        throw new response_1.BusinessError('已存在判定', `该订单已存在责任判定（${(0, exports.getLiabilityPartyName)(existing.liable_party)}）`, 'JUDGMENT_ALREADY_EXISTS');
    }
    const analysis = analyzeOrderNodes(order, nodes);
    let liableParty = 'unknown';
    let reason = '';
    let judgmentType = 'auto';
    if (analysis.hasMerchantDelay && !analysis.hasRiderDelay) {
        liableParty = 'merchant';
        reason = `商家出餐超时，预计 ${order.expected_meal_minutes} 分钟，实际用时 ${analysis.merchantCookingTime.toFixed(1)} 分钟`;
    }
    else if (analysis.hasMerchantDelay && analysis.hasRiderDelay) {
        liableParty = 'merchant';
        reason = `商家出餐超时（${analysis.merchantCookingTime.toFixed(1)}分钟）且骑手等待时间过长（${analysis.riderWaitTime.toFixed(1)}分钟），主要责任归商家`;
    }
    else if (!analysis.hasMerchantDelay && analysis.hasRiderDelay) {
        liableParty = 'rider';
        reason = `骑手等待时间过长，餐品准备好后 ${analysis.riderWaitTime.toFixed(1)} 分钟才取餐`;
    }
    else if (analysis.hasMerchantDelay === false && analysis.hasRiderDelay === false) {
        liableParty = 'none';
        reason = '未检测到明显的出餐超时责任方';
        judgmentType = 'auto';
    }
    else {
        liableParty = 'unknown';
        reason = '无法自动判定，需要人工介入';
    }
    const judgment = {
        id: (0, database_1.generateId)(),
        order_id: orderId,
        meal_timer_id: timer.id,
        liable_party: liableParty,
        judgment_type: judgmentType,
        reason,
        evidence: JSON.stringify(analysis),
        created_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO liability_judgments (
      id, order_id, meal_timer_id, liable_party, judgment_type,
      reason, evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        judgment.id,
        judgment.order_id,
        judgment.meal_timer_id,
        judgment.liable_party,
        judgment.judgment_type,
        judgment.reason,
        judgment.evidence,
        judgment.created_at,
    ]);
    (0, idempotentService_1.logOperation)(orderId, 'system', 'system', 'auto_judge_liability', `自动判定责任方: ${(0, exports.getLiabilityPartyName)(liableParty)}，原因: ${reason}`, null, { judgment });
    (0, database_1.saveDatabase)();
    return judgment;
};
exports.autoJudgeLiability = autoJudgeLiability;
const manualJudgeLiability = (orderId, liableParty, reason, evidence, operatorId, operatorRole) => {
    if (!reason || !reason.trim()) {
        throw new response_1.BusinessError('判定原因不能为空', '请填写责任判定的原因', 'INVALID_REASON');
    }
    const db = (0, database_1.getDb)();
    const order = (0, orderService_1.getOrderById)(orderId);
    const timer = (0, mealTimerService_1.getMealTimer)(orderId);
    if (!timer) {
        throw new response_1.BusinessError('计时器不存在', '该订单没有启动出餐计时器', 'TIMER_NOT_FOUND');
    }
    const existing = (0, database_1.executeGet)('SELECT * FROM liability_judgments WHERE order_id = ?', [orderId]);
    if (existing) {
        (0, idempotentService_1.logOperation)(orderId, operatorId, operatorRole, 'manual_rejudge_liability', `人工重新判定: 从「${(0, exports.getLiabilityPartyName)(existing.liable_party)}」改为「${(0, exports.getLiabilityPartyName)(liableParty)}」，原因: ${reason}`, { liable_party: existing.liable_party, reason: existing.reason }, { liable_party: liableParty, reason });
        db.run(`
      UPDATE liability_judgments 
      SET liable_party = ?, judgment_type = 'manual', reason = ?, evidence = ?, created_at = ?
      WHERE id = ?
    `, [
            liableParty,
            reason,
            evidence,
            (0, database_1.now)(),
            existing.id,
        ]);
        (0, database_1.saveDatabase)();
        return (0, database_1.executeGet)('SELECT * FROM liability_judgments WHERE id = ?', [existing.id]);
    }
    const judgment = {
        id: (0, database_1.generateId)(),
        order_id: orderId,
        meal_timer_id: timer.id,
        liable_party: liableParty,
        judgment_type: 'manual',
        reason,
        evidence,
        created_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO liability_judgments (
      id, order_id, meal_timer_id, liable_party, judgment_type,
      reason, evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        judgment.id,
        judgment.order_id,
        judgment.meal_timer_id,
        judgment.liable_party,
        judgment.judgment_type,
        judgment.reason,
        judgment.evidence,
        judgment.created_at,
    ]);
    (0, idempotentService_1.logOperation)(orderId, operatorId, operatorRole, 'manual_judge_liability', `人工判定责任方: ${(0, exports.getLiabilityPartyName)(liableParty)}，原因: ${reason}`, null, { judgment });
    (0, database_1.saveDatabase)();
    return judgment;
};
exports.manualJudgeLiability = manualJudgeLiability;
const getLiabilityJudgment = (orderId) => {
    return (0, database_1.executeGet)('SELECT * FROM liability_judgments WHERE order_id = ?', [orderId]);
};
exports.getLiabilityJudgment = getLiabilityJudgment;
const getPendingLiabilityOrders = () => {
    const overtimeOrders = (0, mealTimerService_1.getOvertimeOrders)();
    const result = [];
    for (const item of overtimeOrders) {
        const existing = (0, exports.getLiabilityJudgment)(item.orderId);
        if (!existing) {
            const order = (0, orderService_1.getOrderById)(item.orderId);
            const nodes = (0, orderService_1.getOrderNodes)(item.orderId);
            const analysis = analyzeOrderNodes(order, nodes);
            result.push({
                orderId: item.orderId,
                overtimeMinutes: item.overtimeMinutes,
                analysis,
            });
        }
    }
    return result;
};
exports.getPendingLiabilityOrders = getPendingLiabilityOrders;
//# sourceMappingURL=liabilityService.js.map