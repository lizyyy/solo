"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyCutService = void 0;
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
const types_1 = require("../types");
class DailyCutService {
    generateId() {
        return (0, uuid_1.v4)();
    }
    getNow() {
        return new Date().toISOString();
    }
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    updateConfirmationStatus(confirmationId, newStatus, updatedBy, summary, updates = {}) {
        const confirmation = dataStore_1.dataStore.getConfirmation(confirmationId);
        if (!confirmation)
            return false;
        const beforeState = this.deepClone(confirmation);
        const oldStatus = confirmation.status;
        confirmation.status = newStatus;
        Object.assign(confirmation, updates);
        const historyStore = dataStore_1.dataStore;
        historyStore.createHistoryRecord(confirmationId, 'CONFIRMATION', types_1.ChangeType.STATUS_CHANGE, updatedBy, beforeState, this.deepClone(confirmation), summary);
        return true;
    }
    canReviewExRightsDate(confirmation) {
        const validStatuses = [
            types_1.ProcessingStatus.IMPORTED,
            types_1.ProcessingStatus.APPROVER_VERIFIED
        ];
        return validStatuses.includes(confirmation.status);
    }
    reviewExRightsDate(confirmationId, reviewedBy, screenshotReference, hasExRightsEvent, exRightsDate, impactDescription, adjustmentAmount = 0) {
        const confirmation = dataStore_1.dataStore.getConfirmation(confirmationId);
        if (!confirmation)
            return null;
        if (!this.canReviewExRightsDate(confirmation))
            return null;
        const review = {
            id: this.generateId(),
            confirmationId,
            reviewedBy,
            reviewedAt: this.getNow(),
            screenshotReference,
            hasExRightsEvent,
            exRightsDate,
            impactDescription,
            adjustmentAmount
        };
        dataStore_1.dataStore.saveExRightsReview(review);
        this.updateConfirmationStatus(confirmationId, types_1.ProcessingStatus.EX_RIGHTS_DATE_REVIEWED, reviewedBy, `除权日审查完成 - 有除权事件: ${hasExRightsEvent}, 调整金额: ${adjustmentAmount}`, { exRightsDateReviewId: review.id });
        return review;
    }
    canUpdateBalance(confirmation) {
        return confirmation.status === types_1.ProcessingStatus.EX_RIGHTS_DATE_REVIEWED;
    }
    updateBalance(confirmationId, updatedBy, previousBalance, effectiveDate) {
        const confirmation = dataStore_1.dataStore.getConfirmation(confirmationId);
        if (!confirmation)
            return null;
        if (!this.canUpdateBalance(confirmation))
            return null;
        let adjustmentAmount = 0;
        if (confirmation.exRightsDateReviewId) {
            const review = dataStore_1.dataStore.getExRightsReview(confirmation.exRightsDateReviewId);
            if (review) {
                adjustmentAmount = review.adjustmentAmount;
            }
        }
        const interestAmount = confirmation.interestAmount;
        const newBalance = previousBalance + interestAmount + adjustmentAmount;
        const balanceChange = {
            id: this.generateId(),
            confirmationId,
            updatedAt: this.getNow(),
            updatedBy,
            previousBalance,
            newBalance,
            interestAmount,
            adjustmentAmount,
            effectiveDate
        };
        dataStore_1.dataStore.saveBalanceChange(balanceChange);
        this.updateConfirmationStatus(confirmationId, types_1.ProcessingStatus.BALANCE_UPDATED, updatedBy, `余额更新完成 - 原余额: ${previousBalance}, 新余额: ${newBalance}`, { balanceUpdateId: balanceChange.id });
        return balanceChange;
    }
    processFullWorkflow(confirmationId, operator, screenshotReference, hasExRightsEvent, exRightsDate, impactDescription, previousBalance, effectiveDate) {
        const confirmation = dataStore_1.dataStore.getConfirmation(confirmationId);
        if (!confirmation) {
            return { exRightsReview: null, balanceChange: null, completed: false };
        }
        if (confirmation.isPinyinApprover && confirmation.status === types_1.ProcessingStatus.PENDING_APPROVER_VERIFICATION) {
            return { exRightsReview: null, balanceChange: null, completed: false };
        }
        const exRightsReview = this.reviewExRightsDate(confirmationId, operator, screenshotReference, hasExRightsEvent, exRightsDate, impactDescription);
        if (!exRightsReview) {
            return { exRightsReview: null, balanceChange: null, completed: false };
        }
        const balanceChange = this.updateBalance(confirmationId, operator, previousBalance, effectiveDate);
        return {
            exRightsReview,
            balanceChange,
            completed: !!balanceChange
        };
    }
    getStatistics() {
        const allConfirmations = dataStore_1.dataStore.getAllConfirmations();
        const stats = {
            total: allConfirmations.length,
            byStatus: {},
            pinyinApproverCount: 0,
            withManualModifications: 0
        };
        Object.values(types_1.ProcessingStatus).forEach(status => {
            stats.byStatus[status] = 0;
        });
        for (const conf of allConfirmations) {
            stats.byStatus[conf.status]++;
            if (conf.isPinyinApprover)
                stats.pinyinApproverCount++;
            if (conf.manualModifications.length > 0)
                stats.withManualModifications++;
        }
        return stats;
    }
    getEvidenceForCustomerManager(confirmationId) {
        const confirmation = dataStore_1.dataStore.getConfirmation(confirmationId);
        if (!confirmation)
            return null;
        const history = dataStore_1.dataStore.getHistory(confirmationId);
        const statusFlow = dataStore_1.dataStore.getStatusFlow(confirmationId);
        let exRightsReview = null;
        if (confirmation.exRightsDateReviewId) {
            exRightsReview = dataStore_1.dataStore.getExRightsReview(confirmation.exRightsDateReviewId) || null;
        }
        let balanceChange = null;
        if (confirmation.balanceUpdateId) {
            balanceChange = dataStore_1.dataStore.getBalanceChange(confirmation.balanceUpdateId) || null;
        }
        return {
            originalRowNumber: confirmation.originalRowNumber,
            rawContent: confirmation.rawContent,
            manualModifications: confirmation.manualModifications,
            status: confirmation.status,
            statusFlow,
            history: history.map(h => ({
                changeType: h.changeType,
                changedBy: h.changedBy,
                changedAt: h.changedAt,
                diffSummary: h.diffSummary
            })),
            exRightsReview,
            balanceChange
        };
    }
}
exports.dailyCutService = new DailyCutService();
