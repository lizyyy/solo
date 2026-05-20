"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const ReconciliationEngine_1 = require("./ReconciliationEngine");
const date_1 = require("../utils/date");
class ReviewService {
    constructor(engine) {
        this.engine = engine;
    }
    performReview(action) {
        const result = this.engine.getResultById(action.resultId);
        if (!result) {
            return null;
        }
        switch (action.action) {
            case 'APPROVE':
                return this.approveResult(result, action);
            case 'REJECT':
                return this.rejectResult(result, action);
            case 'REQUEST_INFO':
                return this.requestMoreInfo(result, action);
            case 'MODIFY':
                return this.modifyAndRecalculate(result, action);
            default:
                return null;
        }
    }
    approveResult(result, action) {
        const updated = {
            ...result,
            status: 'APPROVED',
            reviewedBy: action.reviewer,
            reviewedAt: (0, date_1.formatDate)(new Date()),
            reviewNotes: action.notes || '人工审核通过',
        };
        this.engine.updateResult(updated);
        return updated;
    }
    rejectResult(result, action) {
        const updated = {
            ...result,
            status: 'REJECTED',
            reviewedBy: action.reviewer,
            reviewedAt: (0, date_1.formatDate)(new Date()),
            reviewNotes: action.notes || '人工审核驳回',
        };
        this.engine.updateResult(updated);
        return updated;
    }
    requestMoreInfo(result, action) {
        const updated = {
            ...result,
            status: 'NEEDS_MORE_INFO',
            reviewedBy: action.reviewer,
            reviewedAt: (0, date_1.formatDate)(new Date()),
            reviewNotes: action.notes || '需补充材料',
        };
        this.engine.updateResult(updated);
        return updated;
    }
    modifyAndRecalculate(result, action) {
        if (!action.modifications || action.modifications.length === 0) {
            return result;
        }
        let updatedResult = { ...result };
        for (const modification of action.modifications) {
            updatedResult = this.applyModification(updatedResult, modification);
        }
        const oldNotes = updatedResult.reviewNotes || '';
        const modificationLog = action.modifications
            .map((m) => `[修改] ${m.field}: ${m.oldValue} → ${m.newValue} (原因: ${m.reason})`)
            .join('\n');
        updatedResult.reviewedBy = action.reviewer;
        updatedResult.reviewedAt = (0, date_1.formatDate)(new Date());
        updatedResult.reviewNotes = oldNotes
            ? `${oldNotes}\n${modificationLog}`
            : modificationLog;
        updatedResult = this.recalculateDiscrepancies(updatedResult);
        this.engine.updateResult(updatedResult);
        return updatedResult;
    }
    applyModification(result, modification) {
        const fieldPath = modification.field.split('.');
        const updatedResult = { ...result };
        if (fieldPath[0] === 'healthCheck' && result.healthCheck) {
            const healthCheck = { ...result.healthCheck };
            healthCheck[fieldPath[1]] = modification.newValue;
            updatedResult.healthCheck = healthCheck;
        }
        else if (fieldPath[0] === 'medication' && result.medication) {
            const medication = { ...result.medication };
            medication[fieldPath[1]] = modification.newValue;
            updatedResult.medication = medication;
        }
        else if (fieldPath[0] === 'student') {
            const student = { ...result.student };
            student[fieldPath[1]] = modification.newValue;
            updatedResult.student = student;
        }
        else {
            updatedResult[fieldPath[0]] = modification.newValue;
        }
        return updatedResult;
    }
    recalculateDiscrepancies(result) {
        const allResults = this.engine.getResults();
        const otherResults = allResults.filter((r) => r.id !== result.id);
        const tempEngine = new ReconciliationEngine_1.ReconciliationEngine();
        tempEngine.loadData([result.student], result.healthCheck ? [result.healthCheck] : [], result.medication ? [result.medication] : []);
        const recalculated = tempEngine.performReconciliation()[0];
        if (recalculated) {
            return {
                ...result,
                discrepancies: recalculated.discrepancies,
                status: recalculated.status,
            };
        }
        return result;
    }
    batchApprove(resultIds, reviewer) {
        const results = [];
        for (const id of resultIds) {
            const result = this.performReview({
                resultId: id,
                action: 'APPROVE',
                reviewer,
            });
            if (result) {
                results.push(result);
            }
        }
        return results;
    }
    getModificationHistory(result) {
        return result.reviewNotes || null;
    }
    getAuditTrail(result) {
        return {
            status: result.status,
            reviewedBy: result.reviewedBy,
            reviewedAt: result.reviewedAt,
            notes: result.reviewNotes,
        };
    }
}
exports.ReviewService = ReviewService;
