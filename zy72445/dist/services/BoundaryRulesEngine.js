"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundaryRulesEngine = void 0;
const DataStore_1 = require("../store/DataStore");
const boundaryRules_1 = require("../constants/boundaryRules");
const errorMessages_1 = require("../constants/errorMessages");
const types_1 = require("../types");
class BoundaryRulesEngine {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
    }
    detectReworkReason(content) {
        if (!boundaryRules_1.BOUNDARY_RULES.reworkReason.autoDetect) {
            return { hasReworkReason: false, detectedKeywords: [] };
        }
        const detected = [];
        for (const keyword of boundaryRules_1.BOUNDARY_RULES.reworkReason.keywords) {
            if (content.includes(keyword)) {
                detected.push(keyword);
            }
        }
        return {
            hasReworkReason: detected.length > 0,
            detectedKeywords: detected,
            reworkReason: detected.length > 0 ? content : undefined
        };
    }
    canTransitionStatus(currentStatus, nextStatus) {
        const allowedPaths = boundaryRules_1.BOUNDARY_RULES.statusTransition.allowedPaths;
        const allowed = allowedPaths[currentStatus] || [];
        return allowed.includes(nextStatus);
    }
    validateStatusTransition(currentStatus, nextStatus, trackId) {
        if (!this.canTransitionStatus(currentStatus, nextStatus)) {
            return {
                valid: false,
                error: (0, errorMessages_1.getHumanReadableError)('invalid_status_transition')
            };
        }
        if (nextStatus === types_1.ApprovalStatus.NORMAL) {
            if (boundaryRules_1.BOUNDARY_RULES.reworkReason.preventAutoNormal) {
                const hasRework = this.store.hasReworkReasonForTrack(trackId);
                if (hasRework) {
                    return {
                        valid: false,
                        error: (0, errorMessages_1.getHumanReadableError)('rework_reason_pending')
                    };
                }
            }
        }
        return { valid: true };
    }
    canRollback(status) {
        return boundaryRules_1.BOUNDARY_RULES.statusTransition.allowRollbackFrom.includes(status);
    }
    validateRollback(approvalId) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval) {
            return {
                valid: false,
                error: (0, errorMessages_1.getHumanReadableError)('track_not_found')
            };
        }
        if (approval.status === types_1.ApprovalStatus.NORMAL) {
            return {
                valid: false,
                error: (0, errorMessages_1.getHumanReadableError)('cannot_rollback_normal')
            };
        }
        if (!this.canRollback(approval.status)) {
            return {
                valid: false,
                error: (0, errorMessages_1.getHumanReadableError)('invalid_status_transition')
            };
        }
        return { valid: true };
    }
    processTrackRemark(trackId, content, createdBy) {
        const detection = this.detectReworkReason(content);
        const remark = this.store.createTrackRemark({
            trackId,
            content,
            hasReworkReason: detection.hasReworkReason,
            reworkReason: detection.reworkReason,
            createdBy
        });
        let shouldSetReworkRequired = false;
        let warning;
        if (detection.hasReworkReason) {
            shouldSetReworkRequired = true;
            warning = (0, errorMessages_1.getHumanReadableError)('rework_reason_pending');
        }
        return {
            remark,
            approvalImpact: {
                shouldSetReworkRequired,
                warning
            }
        };
    }
    canMarkNormal(approval, reviewedBy) {
        if (boundaryRules_1.BOUNDARY_RULES.statusTransition.requireReviewBeforeNormal) {
            if (!reviewedBy && !approval.reviewedBy) {
                return false;
            }
        }
        if (boundaryRules_1.BOUNDARY_RULES.reworkReason.preventAutoNormal) {
            if (this.store.hasReworkReasonForTrack(approval.trackId)) {
                return false;
            }
        }
        return true;
    }
}
exports.BoundaryRulesEngine = BoundaryRulesEngine;
//# sourceMappingURL=BoundaryRulesEngine.js.map