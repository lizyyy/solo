"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCompensation = exports.rejectCompensation = exports.approveCompensation = exports.updateCompensationStatus = exports.getCompensationById = exports.getCompensations = exports.generateCompensations = exports.calculateCompensation = exports.getCompensationStatusName = exports.getCompensationTypeName = exports.COMPENSATION_RULES = void 0;
const database_1 = require("../database");
const response_1 = require("../utils/response");
const liabilityService_1 = require("./liabilityService");
const idempotentService_1 = require("./idempotentService");
exports.COMPENSATION_RULES = {
    merchant: [
        { type: 'user_refund', target: 'user', base: 0, perMinute: 1, min: 5, max: 50 },
        { type: 'rider_waiting_fee', target: 'rider', base: 3, perMinute: 0.5, min: 3, max: 20 },
        { type: 'merchant_penalty', target: 'merchant', base: 10, perMinute: 2, min: 10, max: 200 },
    ],
    rider: [
        { type: 'user_coupon', target: 'user', base: 5, perMinute: 0.5, min: 5, max: 30 },
        { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
    ],
    platform: [
        { type: 'user_refund', target: 'user', base: 10, perMinute: 2, min: 10, max: 100 },
        { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
    ],
    user: [
        { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
    ],
    unknown: [
        { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
    ],
    none: [
        { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
    ],
};
const getCompensationTypeName = (type) => {
    const names = {
        user_coupon: '用户优惠券',
        user_refund: '用户退款',
        rider_waiting_fee: '骑手等待费',
        merchant_penalty: '商家罚款',
        platform_coverage: '平台兜底',
    };
    return names[type] || type;
};
exports.getCompensationTypeName = getCompensationTypeName;
const getCompensationStatusName = (status) => {
    const names = {
        pending: '待审批',
        approved: '已审批',
        rejected: '已拒绝',
        executed: '已执行',
        appealed: '申诉中',
        rolled_back: '已回滚',
    };
    return names[status] || status;
};
exports.getCompensationStatusName = getCompensationStatusName;
const calculateCompensation = (rule, overtimeMinutes, orderAmount) => {
    if (rule.min === 0 && rule.max === 0 && rule.perMinute === 0 && rule.base === 0) {
        return 0;
    }
    let amount = rule.base + (overtimeMinutes * rule.perMinute);
    if (rule.type === 'user_refund') {
        const maxByOrder = orderAmount * 0.3;
        amount = Math.min(amount, maxByOrder);
    }
    if (rule.min > 0) {
        amount = Math.max(amount, rule.min);
    }
    if (rule.max > 0) {
        amount = Math.min(amount, rule.max);
    }
    return Math.round(amount * 100) / 100;
};
exports.calculateCompensation = calculateCompensation;
const generateCompensations = (orderId, orderAmount, operatorId, operatorRole) => {
    const db = (0, database_1.getDb)();
    const judgment = (0, liabilityService_1.getLiabilityJudgment)(orderId);
    if (!judgment) {
        throw new response_1.BusinessError('未找到责任判定', '请先完成责任判定再生成补偿', 'NO_LIABILITY_JUDGMENT');
    }
    const existing = (0, exports.getCompensations)(orderId);
    if (existing.length > 0) {
        throw new response_1.BusinessError('补偿已生成', `该订单已生成 ${existing.length} 条补偿记录`, 'COMPENSATIONS_ALREADY_GENERATED');
    }
    const rules = exports.COMPENSATION_RULES[judgment.liable_party];
    const timer = (0, database_1.executeGet)('SELECT overtime_minutes FROM meal_timers WHERE order_id = ?', [orderId]);
    const overtimeMinutes = timer ? timer.overtime_minutes : 0;
    const compensations = [];
    for (const rule of rules) {
        const amount = (0, exports.calculateCompensation)(rule, overtimeMinutes, orderAmount);
        if (amount <= 0 && rule.min === 0) {
            continue;
        }
        const comp = {
            id: (0, database_1.generateId)(),
            order_id: orderId,
            liability_judgment_id: judgment.id,
            compensation_type: rule.type,
            target_party: rule.target,
            amount,
            status: 'pending',
            remark: `${(0, liabilityService_1.getLiabilityPartyName)(judgment.liable_party)}责任，超时 ${overtimeMinutes} 分钟`,
            created_at: (0, database_1.now)(),
            updated_at: (0, database_1.now)(),
        };
        db.run(`
      INSERT INTO compensations (
        id, order_id, liability_judgment_id, compensation_type,
        target_party, amount, status, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            comp.id,
            comp.order_id,
            comp.liability_judgment_id,
            comp.compensation_type,
            comp.target_party,
            comp.amount,
            comp.status,
            comp.remark,
            comp.created_at,
            comp.updated_at,
        ]);
        compensations.push(comp);
    }
    (0, idempotentService_1.logOperation)(orderId, operatorId, operatorRole, 'generate_compensations', `生成 ${compensations.length} 条补偿记录`, null, { compensations, liability: judgment.liable_party, overtimeMinutes });
    (0, database_1.saveDatabase)();
    return compensations;
};
exports.generateCompensations = generateCompensations;
const getCompensations = (orderId) => {
    return (0, database_1.executeAll)(`SELECT * FROM compensations WHERE order_id = ? ORDER BY created_at DESC`, [orderId]);
};
exports.getCompensations = getCompensations;
const getCompensationById = (compensationId) => {
    const comp = (0, database_1.executeGet)('SELECT * FROM compensations WHERE id = ?', [compensationId]);
    if (!comp) {
        throw new response_1.BusinessError('补偿记录不存在', `找不到ID为「${compensationId}」的补偿记录`, 'COMPENSATION_NOT_FOUND');
    }
    return comp;
};
exports.getCompensationById = getCompensationById;
const updateCompensationStatus = (compensationId, newStatus, operatorId, operatorRole, remark) => {
    const db = (0, database_1.getDb)();
    const comp = (0, exports.getCompensationById)(compensationId);
    db.run(`
    UPDATE compensations 
    SET status = ?, updated_at = ?, remark = COALESCE(?, remark)
    WHERE id = ?
  `, [newStatus, (0, database_1.now)(), remark || null, compensationId]);
    (0, idempotentService_1.logOperation)(comp.order_id, operatorId, operatorRole, 'update_compensation_status', `${(0, exports.getCompensationTypeName)(comp.compensation_type)} 状态变更: ${(0, exports.getCompensationStatusName)(comp.status)} -> ${(0, exports.getCompensationStatusName)(newStatus)}`, { status: comp.status }, { status: newStatus });
    (0, database_1.saveDatabase)();
    return (0, exports.getCompensationById)(compensationId);
};
exports.updateCompensationStatus = updateCompensationStatus;
const approveCompensation = (compensationId, operatorId, operatorRole) => {
    const comp = (0, exports.getCompensationById)(compensationId);
    if (comp.status !== 'pending') {
        throw new response_1.BusinessError('状态不允许', `当前状态「${(0, exports.getCompensationStatusName)(comp.status)}」不能审批`, 'INVALID_STATUS');
    }
    return (0, exports.updateCompensationStatus)(compensationId, 'approved', operatorId, operatorRole);
};
exports.approveCompensation = approveCompensation;
const rejectCompensation = (compensationId, reason, operatorId, operatorRole) => {
    if (!reason || !reason.trim()) {
        throw new response_1.BusinessError('拒绝原因不能为空', '请填写拒绝补偿的原因', 'INVALID_REASON');
    }
    const comp = (0, exports.getCompensationById)(compensationId);
    if (comp.status !== 'pending') {
        throw new response_1.BusinessError('状态不允许', `当前状态「${(0, exports.getCompensationStatusName)(comp.status)}」不能拒绝`, 'INVALID_STATUS');
    }
    return (0, exports.updateCompensationStatus)(compensationId, 'rejected', operatorId, operatorRole, `拒绝原因: ${reason}`);
};
exports.rejectCompensation = rejectCompensation;
const executeCompensation = (compensationId, operatorId, operatorRole) => {
    const comp = (0, exports.getCompensationById)(compensationId);
    if (comp.status !== 'approved') {
        throw new response_1.BusinessError('状态不允许', `当前状态「${(0, exports.getCompensationStatusName)(comp.status)}」不能执行，需要先审批通过`, 'INVALID_STATUS');
    }
    return (0, exports.updateCompensationStatus)(compensationId, 'executed', operatorId, operatorRole);
};
exports.executeCompensation = executeCompensation;
//# sourceMappingURL=compensationService.js.map