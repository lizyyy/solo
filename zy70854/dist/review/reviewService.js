"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class ReviewService {
    constructor() {
        this.reviewHistory = new Map();
    }
    recordReview(matchId, reviewer, action, previousStatus, newStatus, reason, changes = []) {
        const now = new Date();
        const reviewRecord = {
            id: (0, uuid_1.v4)(),
            matchId,
            reviewer,
            reviewDate: now.toISOString().split('T')[0],
            reviewTime: now.toTimeString().split(' ')[0],
            action,
            previousStatus,
            newStatus,
            reason,
            changes
        };
        if (!this.reviewHistory.has(matchId)) {
            this.reviewHistory.set(matchId, []);
        }
        this.reviewHistory.get(matchId).push(reviewRecord);
        return reviewRecord;
    }
    startReview(match, reviewer) {
        if (match.status !== types_1.ItemStatus.MATCHED && match.status !== types_1.ItemStatus.UNMATCHED) {
            throw new Error('该记录状态不允许开始复核');
        }
        const previousStatus = match.status;
        match.status = types_1.ItemStatus.REVIEWING;
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.REQUEST_MORE_INFO, previousStatus, types_1.ItemStatus.REVIEWING, '开始人工复核', []);
        return { match, reviewRecord };
    }
    approveMatch(match, reviewer, reason) {
        if (match.status !== types_1.ItemStatus.REVIEWING && match.status !== types_1.ItemStatus.MATCHED) {
            throw new Error('该记录状态不允许审批通过');
        }
        const previousStatus = match.status;
        match.status = types_1.ItemStatus.APPROVED;
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.APPROVE, previousStatus, types_1.ItemStatus.APPROVED, reason, []);
        return { match, reviewRecord };
    }
    rejectMatch(match, reviewer, reason) {
        if (match.status !== types_1.ItemStatus.REVIEWING && match.status !== types_1.ItemStatus.MATCHED) {
            throw new Error('该记录状态不允许驳回');
        }
        const previousStatus = match.status;
        match.status = types_1.ItemStatus.REJECTED;
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.REJECT, previousStatus, types_1.ItemStatus.REJECTED, reason, []);
        return { match, reviewRecord };
    }
    manualMatch(match, reviewer, reason, targetIds) {
        const previousStatus = match.status;
        const changes = [];
        if (targetIds.passengerItemId && match.passengerItemId !== targetIds.passengerItemId) {
            changes.push({
                field: 'passengerItemId',
                oldValue: match.passengerItemId || '',
                newValue: targetIds.passengerItemId
            });
            match.passengerItemId = targetIds.passengerItemId;
        }
        if (targetIds.driverItemId && match.driverItemId !== targetIds.driverItemId) {
            changes.push({
                field: 'driverItemId',
                oldValue: match.driverItemId || '',
                newValue: targetIds.driverItemId
            });
            match.driverItemId = targetIds.driverItemId;
        }
        if (targetIds.warehouseItemId && match.warehouseItemId !== targetIds.warehouseItemId) {
            changes.push({
                field: 'warehouseItemId',
                oldValue: match.warehouseItemId || '',
                newValue: targetIds.warehouseItemId
            });
            match.warehouseItemId = targetIds.warehouseItemId;
        }
        match.status = types_1.ItemStatus.MATCHED;
        match.matchScore = 1;
        match.matchedFields = ['manual_match'];
        match.differences = match.differences.filter(d => d !== types_1.DifferenceType.DUPLICATE);
        match.differenceExplanations.push(`人工匹配: ${reason}`);
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.MANUAL_MATCH, previousStatus, types_1.ItemStatus.MATCHED, reason, changes);
        return { match, reviewRecord };
    }
    unmatch(match, reviewer, reason) {
        const previousStatus = match.status;
        match.status = types_1.ItemStatus.UNMATCHED;
        match.differenceExplanations.push(`解除匹配: ${reason}`);
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.UNMATCH, previousStatus, types_1.ItemStatus.UNMATCHED, reason, []);
        return { match, reviewRecord };
    }
    requestMoreInfo(match, reviewer, reason) {
        const previousStatus = match.status;
        match.status = types_1.ItemStatus.REVIEWING;
        match.differenceExplanations.push(`要求补充信息: ${reason}`);
        match.updatedAt = new Date().toISOString();
        const reviewRecord = this.recordReview(match.id, reviewer, types_1.ReviewAction.REQUEST_MORE_INFO, previousStatus, types_1.ItemStatus.REVIEWING, reason, []);
        return { match, reviewRecord };
    }
    addDifferenceExplanation(match, explanation, differenceType) {
        match.differenceExplanations.push(explanation);
        if (differenceType && !match.differences.includes(differenceType)) {
            match.differences.push(differenceType);
        }
        match.updatedAt = new Date().toISOString();
        return match;
    }
    getReviewHistory(matchId) {
        return this.reviewHistory.get(matchId) || [];
    }
    getAllReviewHistory() {
        const allRecords = [];
        this.reviewHistory.forEach(records => {
            allRecords.push(...records);
        });
        return allRecords;
    }
    getReviewRecordsByReviewer(reviewer) {
        const allRecords = [];
        this.reviewHistory.forEach(records => {
            allRecords.push(...records.filter(r => r.reviewer === reviewer));
        });
        return allRecords;
    }
    getReviewRecordsByDateRange(startDate, endDate) {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const allRecords = [];
        this.reviewHistory.forEach(records => {
            allRecords.push(...records.filter(r => {
                const reviewTime = new Date(r.reviewDate + ' ' + r.reviewTime).getTime();
                return reviewTime >= start && reviewTime <= end;
            }));
        });
        return allRecords;
    }
    getAuditTrail(matchId) {
        const history = this.getReviewHistory(matchId);
        return history.map(record => {
            const actionText = this.getActionText(record.action);
            return `[${record.reviewDate} ${record.reviewTime}] ${record.reviewer} ${actionText} - ${record.reason}`;
        });
    }
    getActionText(action) {
        const actionMap = {
            [types_1.ReviewAction.APPROVE]: '审批通过',
            [types_1.ReviewAction.REJECT]: '驳回',
            [types_1.ReviewAction.REQUEST_MORE_INFO]: '要求补充信息',
            [types_1.ReviewAction.MANUAL_MATCH]: '人工匹配',
            [types_1.ReviewAction.UNMATCH]: '解除匹配'
        };
        return actionMap[action] || action;
    }
    validateMatchConsistency(match, passengerItems, driverItems, warehouseItems) {
        const issues = [];
        if (match.passengerItemId) {
            const passenger = passengerItems.find(p => p.id === match.passengerItemId);
            if (!passenger) {
                issues.push('关联的乘客报失记录不存在');
            }
        }
        if (match.driverItemId) {
            const driver = driverItems.find(d => d.id === match.driverItemId);
            if (!driver) {
                issues.push('关联的司机上交记录不存在');
            }
        }
        if (match.warehouseItemId) {
            const warehouse = warehouseItems.find(w => w.id === match.warehouseItemId);
            if (!warehouse) {
                issues.push('关联的仓库入库记录不存在');
            }
        }
        if (!match.passengerItemId && !match.driverItemId && !match.warehouseItemId) {
            issues.push('匹配记录未关联任何来源记录');
        }
        return {
            valid: issues.length === 0,
            issues
        };
    }
}
exports.ReviewService = ReviewService;
