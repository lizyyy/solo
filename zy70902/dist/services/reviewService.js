"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const dataStore_1 = require("../store/dataStore");
const reconciliationService_1 = require("./reconciliationService");
class ReviewService {
    async reviewDiff(resultId, diffId, reviewer, action, notes) {
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result)
            return undefined;
        const diffIndex = result.diffs.findIndex(d => d.id === diffId);
        if (diffIndex === -1)
            return undefined;
        const updatedDiff = {
            ...result.diffs[diffIndex],
            status: action === 'resolve' ? 'resolved' : action === 'confirm' ? 'confirmed' : 'open',
            reviewedBy: reviewer,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes,
        };
        result.diffs[diffIndex] = updatedDiff;
        dataStore_1.dataStore.updateReconciliationResult(resultId, {
            diffs: result.diffs,
        });
        dataStore_1.dataStore.addReviewRecord({
            diffId,
            reviewer,
            action,
            notes,
        });
        await reconciliationService_1.reconciliationService.recalculateSummary(resultId);
        return updatedDiff;
    }
    async batchReview(resultId, diffIds, reviewer, action, notes) {
        const updatedDiffs = [];
        for (const diffId of diffIds) {
            const diff = await this.reviewDiff(resultId, diffId, reviewer, action, notes);
            if (diff) {
                updatedDiffs.push(diff);
            }
        }
        return updatedDiffs;
    }
    getReviewHistory(diffId) {
        return dataStore_1.dataStore.getReviewRecordsByDiff(diffId);
    }
    async recalculateResult(resultId) {
        return reconciliationService_1.reconciliationService.recalculateSummary(resultId);
    }
}
exports.ReviewService = ReviewService;
exports.reviewService = new ReviewService();
//# sourceMappingURL=reviewService.js.map