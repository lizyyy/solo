"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const uuid_1 = require("uuid");
const dataStore_1 = __importDefault(require("../store/dataStore"));
class ReviewService {
    performAction(recordId, action, operator, remark) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        const oldStatus = record.status;
        const newStatus = this.getNewStatus(action);
        const auditLog = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            operator,
            action: this.getActionDescription(action),
            oldValue: oldStatus,
            newValue: newStatus,
            remark,
        };
        record.status = newStatus;
        record.reviewer = operator;
        record.reviewRemark = remark;
        record.reviewedAt = new Date();
        record.auditLogs.push(auditLog);
        dataStore_1.default.saveReconciliationRecord(record);
        dataStore_1.default.updateBatchStats(record.batchId);
        return record;
    }
    getNewStatus(action) {
        switch (action) {
            case 'approve':
                return 'approved';
            case 'reject':
                return 'rejected';
            case 'supplement':
                return 'supplement';
            case 'mark_as_reviewing':
                return 'reviewing';
            default:
                throw new Error(`未知操作: ${action}`);
        }
    }
    getActionDescription(action) {
        switch (action) {
            case 'approve':
                return '审批通过';
            case 'reject':
                return '退回';
            case 'supplement':
                return '要求补材料';
            case 'mark_as_reviewing':
                return '标记为复核中';
            default:
                return action;
        }
    }
    approve(recordId, operator, remark) {
        return this.performAction(recordId, 'approve', operator, remark);
    }
    reject(recordId, operator, remark) {
        return this.performAction(recordId, 'reject', operator, remark);
    }
    requestSupplement(recordId, operator, remark) {
        return this.performAction(recordId, 'supplement', operator, remark);
    }
    markAsReviewing(recordId, operator, remark) {
        return this.performAction(recordId, 'mark_as_reviewing', operator, remark);
    }
    batchApprove(recordIds, operator, remark) {
        const success = [];
        const failed = [];
        for (const id of recordIds) {
            try {
                this.approve(id, operator, remark);
                success.push(id);
            }
            catch (e) {
                failed.push(id);
            }
        }
        return { success, failed };
    }
    addComment(recordId, operator, comment) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        record.auditLogs.push({
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            operator,
            action: '添加备注',
            remark: comment,
        });
        dataStore_1.default.saveReconciliationRecord(record);
        return record;
    }
    resolveDiscrepancy(recordId, discrepancyId, operator, resolution) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        const discrepancy = record.discrepancies.find(d => d.id === discrepancyId);
        if (!discrepancy) {
            throw new Error(`差异不存在: ${discrepancyId}`);
        }
        record.auditLogs.push({
            id: (0, uuid_1.v4)(),
            timestamp: new Date(),
            operator,
            action: '处理差异',
            oldValue: discrepancy.description,
            newValue: resolution,
            remark: `差异ID: ${discrepancyId}`,
        });
        dataStore_1.default.saveReconciliationRecord(record);
        return record;
    }
    getRecordAuditTrail(recordId) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        return [...record.auditLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    explainDecision(recordId) {
        const record = dataStore_1.default.getReconciliationRecord(recordId);
        if (!record) {
            throw new Error(`对账记录不存在: ${recordId}`);
        }
        const parts = [];
        parts.push(`【服务单 ${record.serviceOrder.orderNo}】处理说明`);
        parts.push(`老人: ${record.serviceOrder.elderName}`);
        parts.push(`护士: ${record.serviceOrder.nurseName}`);
        parts.push(`服务日期: ${record.serviceOrder.serviceDate}`);
        parts.push(``);
        parts.push(`当前状态: ${this.getStatusText(record.status)}`);
        if (record.discrepancies.length > 0) {
            parts.push(``);
            parts.push(`发现的差异 (${record.discrepancies.length} 处):`);
            record.discrepancies.forEach((d, i) => {
                parts.push(`${i + 1}. ${d.description}`);
                parts.push(`   说明: ${d.explanation}`);
            });
        }
        if (record.reviewRemark) {
            parts.push(``);
            parts.push(`复核意见: ${record.reviewRemark}`);
        }
        if (record.reviewer && record.reviewedAt) {
            parts.push(``);
            parts.push(`复核人: ${record.reviewer}`);
            parts.push(`复核时间: ${record.reviewedAt.toLocaleString()}`);
        }
        return parts.join('\n');
    }
    getStatusText(status) {
        const map = {
            matched: '已匹配',
            discrepancy: '存在差异',
            reviewing: '复核中',
            approved: '已放行',
            rejected: '已退回',
            supplement: '待补材料',
        };
        return map[status] || status;
    }
}
exports.ReviewService = ReviewService;
exports.default = new ReviewService();
