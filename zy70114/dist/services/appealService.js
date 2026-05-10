"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualRollback = exports.startReview = exports.reviewAppeal = exports.getAppealById = exports.getAppeals = exports.createAppeal = exports.getAppealStatusName = void 0;
const database_1 = require("../database");
const response_1 = require("../utils/response");
const orderService_1 = require("./orderService");
const compensationService_1 = require("./compensationService");
const idempotentService_1 = require("./idempotentService");
const getAppealStatusName = (status) => {
    const names = {
        pending: '待审核',
        reviewing: '审核中',
        approved: '申诉通过',
        rejected: '申诉驳回',
    };
    return names[status] || status;
};
exports.getAppealStatusName = getAppealStatusName;
const createAppeal = (orderId, compensationId, appellantParty, appellantId, appealReason, appealEvidence) => {
    if (!appealReason || !appealReason.trim()) {
        throw new response_1.BusinessError('申诉原因不能为空', '请填写申诉原因', 'INVALID_REASON');
    }
    const order = (0, orderService_1.getOrderById)(orderId);
    const compensation = (0, compensationService_1.getCompensationById)(compensationId);
    if (compensation.order_id !== orderId) {
        throw new response_1.BusinessError('补偿记录不匹配', '该补偿记录不属于这个订单', 'COMPENSATION_MISMATCH');
    }
    if (compensation.status === 'appealed') {
        throw new response_1.BusinessError('已存在申诉', '该补偿记录已经申诉过了', 'APPEAL_ALREADY_EXISTS');
    }
    if (compensation.status === 'rolled_back') {
        throw new response_1.BusinessError('已回滚', '该补偿记录已经回滚，不能再申诉', 'ALREADY_ROLLED_BACK');
    }
    const db = (0, database_1.getDb)();
    const appeal = {
        id: (0, database_1.generateId)(),
        order_id: orderId,
        compensation_id: compensationId,
        appellant_party: appellantParty,
        appellant_id: appellantId,
        appeal_reason: appealReason,
        appeal_evidence: appealEvidence,
        status: 'pending',
        reviewer_id: null,
        review_result: null,
        created_at: (0, database_1.now)(),
        reviewed_at: null,
    };
    db.run(`
    INSERT INTO appeals (
      id, order_id, compensation_id, appellant_party, appellant_id,
      appeal_reason, appeal_evidence, status, reviewer_id, review_result,
      created_at, reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        appeal.id,
        appeal.order_id,
        appeal.compensation_id,
        appeal.appellant_party,
        appeal.appellant_id,
        appeal.appeal_reason,
        appeal.appeal_evidence,
        appeal.status,
        appeal.reviewer_id,
        appeal.review_result,
        appeal.created_at,
        appeal.reviewed_at,
    ]);
    (0, compensationService_1.updateCompensationStatus)(compensationId, 'appealed', appellantId, appellantParty);
    (0, idempotentService_1.logOperation)(orderId, appellantId, appellantParty, 'create_appeal', `提交申诉: ${appealReason}`, null, {
        appellantParty,
        appealReason,
        compensationId,
    });
    (0, database_1.saveDatabase)();
    return appeal;
};
exports.createAppeal = createAppeal;
const getAppeals = (orderId) => {
    return (0, database_1.executeAll)(`SELECT * FROM appeals WHERE order_id = ? ORDER BY created_at DESC`, [orderId]);
};
exports.getAppeals = getAppeals;
const getAppealById = (appealId) => {
    const appeal = (0, database_1.executeGet)('SELECT * FROM appeals WHERE id = ?', [appealId]);
    if (!appeal) {
        throw new response_1.BusinessError('申诉记录不存在', '找不到该申诉记录', 'APPEAL_NOT_FOUND');
    }
    return appeal;
};
exports.getAppealById = getAppealById;
const reviewAppeal = (appealId, reviewerId, reviewerRole, approved, reviewResult) => {
    if (!reviewResult || !reviewResult.trim()) {
        throw new response_1.BusinessError('审核结果不能为空', '请填写审核结果说明', 'INVALID_RESULT');
    }
    const db = (0, database_1.getDb)();
    const appeal = (0, exports.getAppealById)(appealId);
    if (appeal.status !== 'pending' && appeal.status !== 'reviewing') {
        throw new response_1.BusinessError('无法审核', `当前状态「${(0, exports.getAppealStatusName)(appeal.status)}」不能审核`, 'INVALID_STATUS');
    }
    const newStatus = approved ? 'approved' : 'rejected';
    db.run(`
    UPDATE appeals 
    SET status = ?, reviewer_id = ?, review_result = ?, reviewed_at = ?
    WHERE id = ?
  `, [
        newStatus,
        reviewerId,
        reviewResult,
        (0, database_1.now)(),
        appealId,
    ]);
    if (approved) {
        const compensation = (0, compensationService_1.getCompensationById)(appeal.compensation_id);
        if (compensation.status === 'executed' || compensation.status === 'appealed') {
            db.run(`
        UPDATE compensations 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `, ['rolled_back', (0, database_1.now)(), appeal.compensation_id]);
            (0, idempotentService_1.logOperation)(appeal.order_id, reviewerId, reviewerRole, 'rollback_compensation', `申诉通过，回滚补偿: ${compensation.compensation_type} ¥${compensation.amount}`, { status: compensation.status }, { status: 'rolled_back' });
        }
    }
    (0, idempotentService_1.logOperation)(appeal.order_id, reviewerId, reviewerRole, 'review_appeal', `${approved ? '通过' : '驳回'}申诉: ${reviewResult}`, { status: appeal.status }, { status: newStatus, reviewResult });
    (0, database_1.saveDatabase)();
    return (0, exports.getAppealById)(appealId);
};
exports.reviewAppeal = reviewAppeal;
const startReview = (appealId, reviewerId, reviewerRole) => {
    const db = (0, database_1.getDb)();
    const appeal = (0, exports.getAppealById)(appealId);
    if (appeal.status !== 'pending') {
        throw new response_1.BusinessError('无法开始审核', `当前状态「${(0, exports.getAppealStatusName)(appeal.status)}」不能开始审核`, 'INVALID_STATUS');
    }
    db.run(`
    UPDATE appeals 
    SET status = ?, reviewer_id = ?
    WHERE id = ?
  `, ['reviewing', reviewerId, appealId]);
    (0, idempotentService_1.logOperation)(appeal.order_id, reviewerId, reviewerRole, 'start_review', '开始审核申诉', { status: appeal.status }, { status: 'reviewing' });
    (0, database_1.saveDatabase)();
    return (0, exports.getAppealById)(appealId);
};
exports.startReview = startReview;
const manualRollback = (compensationId, operatorId, operatorRole, reason) => {
    const compensation = (0, compensationService_1.getCompensationById)(compensationId);
    if (compensation.status === 'rolled_back') {
        throw new response_1.BusinessError('已回滚', '该补偿已经回滚过了', 'ALREADY_ROLLED_BACK');
    }
    if (compensation.status !== 'executed' && compensation.status !== 'approved') {
        throw new response_1.BusinessError('无法回滚', `当前状态「${(0, compensationService_1.getCompensationStatusName)(compensation.status)}」不能回滚`, 'INVALID_STATUS');
    }
    const db = (0, database_1.getDb)();
    const newRemark = `${compensation.remark || ''} | 人工回滚原因: ${reason}`;
    db.run(`
    UPDATE compensations 
    SET status = ?, remark = ?, updated_at = ?
    WHERE id = ?
  `, ['rolled_back', newRemark, (0, database_1.now)(), compensationId]);
    (0, idempotentService_1.logOperation)(compensation.order_id, operatorId, operatorRole, 'manual_rollback', `人工回滚补偿，原因: ${reason}`, { status: compensation.status }, { status: 'rolled_back', reason });
    (0, database_1.saveDatabase)();
};
exports.manualRollback = manualRollback;
//# sourceMappingURL=appealService.js.map