"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewAndAdjustmentService = exports.ReviewAndAdjustmentService = void 0;
const uuid_1 = require("uuid");
const data_store_1 = require("./data-store");
class ReviewAndAdjustmentService {
    registerReviewReason(auditId, differenceId, reason, reviewedBy) {
        const errors = [];
        const differences = data_store_1.dataStore.getDifferences(auditId);
        const difference = differences.find(d => d.id === differenceId);
        if (!difference) {
            errors.push({
                type: 'sku_missing',
                message: `差异记录不存在: ${differenceId}`
            });
            return { success: false, message: '差异记录不存在', errors };
        }
        const now = new Date().toISOString();
        const updated = data_store_1.dataStore.updateDifference(auditId, differenceId, {
            reviewReason: reason,
            reviewedBy,
            reviewedAt: now
        });
        if (updated) {
            return {
                success: true,
                message: '复核原因已登记',
                errors: []
            };
        }
        errors.push({
            type: 'sku_missing',
            message: '更新失败'
        });
        return { success: false, message: '更新失败', errors };
    }
    submitAdjustment(auditId, differenceId, adjustmentQuantity, reviewedBy) {
        const errors = [];
        const differences = data_store_1.dataStore.getDifferences(auditId);
        const difference = differences.find(d => d.id === differenceId);
        if (!difference) {
            errors.push({
                type: 'sku_missing',
                message: `差异记录不存在: ${differenceId}`
            });
            return { success: false, message: '差异记录不存在', errors };
        }
        if (Math.abs(adjustmentQuantity) > Math.abs(difference.differenceQuantity)) {
            errors.push({
                type: 'adjustment_exceeds_difference',
                message: `调整数量 (${adjustmentQuantity}) 超过差异数量 (${difference.differenceQuantity})`,
                details: {
                    adjustmentQuantity,
                    differenceQuantity: difference.differenceQuantity
                }
            });
            return { success: false, message: '调整数量不能超过差异数量', errors };
        }
        const now = new Date().toISOString();
        const updated = data_store_1.dataStore.updateDifference(auditId, differenceId, {
            adjustmentQuantity,
            reviewedBy,
            reviewedAt: now,
            approvalStatus: 'pending'
        });
        const session = data_store_1.dataStore.getAuditSession(auditId);
        if (session && session.status !== 'adjusting') {
            session.status = 'adjusting';
            session.updatedAt = now;
            data_store_1.dataStore.saveAuditSession(session);
        }
        if (updated) {
            return {
                success: true,
                message: '调整已提交，等待审批',
                errors: []
            };
        }
        errors.push({
            type: 'sku_missing',
            message: '更新失败'
        });
        return { success: false, message: '更新失败', errors };
    }
    approveAdjustment(auditId, differenceId, approvedBy) {
        const errors = [];
        const differences = data_store_1.dataStore.getDifferences(auditId);
        const difference = differences.find(d => d.id === differenceId);
        if (!difference) {
            errors.push({
                type: 'sku_missing',
                message: `差异记录不存在: ${differenceId}`
            });
            return { success: false, message: '差异记录不存在', errors };
        }
        if (difference.approvalStatus !== 'pending') {
            errors.push({
                type: 'sku_missing',
                message: `当前状态不是待审批状态: ${difference.approvalStatus}`
            });
            return { success: false, message: '当前状态不是待审批状态', errors };
        }
        if (difference.adjustmentQuantity === undefined) {
            errors.push({
                type: 'sku_missing',
                message: '该差异还没有提交调整数量'
            });
            return { success: false, message: '该差异还没有提交调整数量', errors };
        }
        const now = new Date().toISOString();
        const oldQuantity = difference.bookQuantity;
        const newQuantity = difference.bookQuantity + difference.adjustmentQuantity;
        const updated = data_store_1.dataStore.updateDifference(auditId, differenceId, {
            approvalStatus: 'approved',
            approvedBy,
            approvedAt: now
        });
        const history = {
            id: (0, uuid_1.v4)(),
            auditId,
            differenceId,
            location: difference.location,
            sku: difference.sku,
            oldQuantity,
            newQuantity,
            adjustmentQuantity: difference.adjustmentQuantity,
            approvedBy,
            approvedAt: now
        };
        data_store_1.dataStore.saveAdjustmentHistory(history);
        if (updated) {
            return {
                success: true,
                message: '调整已审批通过，并记录到历史',
                errors: []
            };
        }
        errors.push({
            type: 'sku_missing',
            message: '更新失败'
        });
        return { success: false, message: '更新失败', errors };
    }
    rejectAdjustment(auditId, differenceId, rejectedBy, rejectionReason) {
        const errors = [];
        const differences = data_store_1.dataStore.getDifferences(auditId);
        const difference = differences.find(d => d.id === differenceId);
        if (!difference) {
            errors.push({
                type: 'sku_missing',
                message: `差异记录不存在: ${differenceId}`
            });
            return { success: false, message: '差异记录不存在', errors };
        }
        if (difference.approvalStatus !== 'pending') {
            errors.push({
                type: 'sku_missing',
                message: `当前状态不是待审批状态: ${difference.approvalStatus}`
            });
            return { success: false, message: '当前状态不是待审批状态', errors };
        }
        const now = new Date().toISOString();
        const updated = data_store_1.dataStore.updateDifference(auditId, differenceId, {
            approvalStatus: 'rejected',
            reviewReason: difference.reviewReason
                ? `${difference.reviewReason} | 驳回原因: ${rejectionReason}`
                : `驳回原因: ${rejectionReason}`,
            reviewedBy: rejectedBy,
            reviewedAt: now
        });
        if (updated) {
            return {
                success: true,
                message: '调整已被驳回',
                errors: []
            };
        }
        errors.push({
            type: 'sku_missing',
            message: '更新失败'
        });
        return { success: false, message: '更新失败', errors };
    }
    getPendingApproval(auditId) {
        const differences = data_store_1.dataStore.getDifferences(auditId);
        return differences.filter(d => d.approvalStatus === 'pending' && d.adjustmentQuantity !== undefined);
    }
    getAdjustmentHistory(auditId) {
        return data_store_1.dataStore.getAdjustmentHistory(auditId);
    }
}
exports.ReviewAndAdjustmentService = ReviewAndAdjustmentService;
exports.reviewAndAdjustmentService = new ReviewAndAdjustmentService();
