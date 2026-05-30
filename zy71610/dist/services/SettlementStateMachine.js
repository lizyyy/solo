"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementStateMachine = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const STATE_TRANSITIONS = [
    {
        from: ['DRAFT'],
        to: 'PENDING_REVIEW',
        allowedRoles: ['OPERATOR', 'SUPERVISOR'],
        reasonCode: 'SUBMIT_FOR_REVIEW',
        reasonMessage: '提交审核',
    },
    {
        from: ['PENDING_REVIEW'],
        to: 'REVIEWED',
        allowedRoles: ['SUPERVISOR', 'MANAGER'],
        reasonCode: 'REVIEW_PASS',
        reasonMessage: '审核通过',
    },
    {
        from: ['PENDING_REVIEW'],
        to: 'DRAFT',
        allowedRoles: ['SUPERVISOR', 'MANAGER'],
        reasonCode: 'REVIEW_RETURN',
        reasonMessage: '审核退回',
    },
    {
        from: ['REVIEWED'],
        to: 'APPROVED',
        allowedRoles: ['MANAGER'],
        reasonCode: 'APPROVE',
        reasonMessage: '审批通过',
    },
    {
        from: ['REVIEWED'],
        to: 'DRAFT',
        allowedRoles: ['MANAGER'],
        reasonCode: 'APPROVE_REJECT',
        reasonMessage: '审批拒绝',
    },
    {
        from: ['APPROVED'],
        to: 'EXECUTED',
        allowedRoles: ['OPERATOR', 'SUPERVISOR'],
        reasonCode: 'EXECUTE',
        reasonMessage: '执行结清',
    },
    {
        from: ['DRAFT', 'PENDING_REVIEW'],
        to: 'CANCELLED',
        allowedRoles: ['OPERATOR', 'SUPERVISOR', 'MANAGER'],
        reasonCode: 'CANCEL',
        reasonMessage: '取消申请',
    },
];
class SettlementStateMachine {
    createReason(code, message, source, operator) {
        return {
            code,
            message,
            source,
            timestamp: (0, dayjs_1.default)().toISOString(),
            operator,
        };
    }
    canTransition(currentStatus, targetStatus, userRole) {
        const transition = STATE_TRANSITIONS.find((t) => t.from.includes(currentStatus) && t.to === targetStatus);
        if (!transition)
            return false;
        return transition.allowedRoles.includes(userRole);
    }
    getAvailableTransitions(currentStatus, userRole) {
        return STATE_TRANSITIONS.filter((t) => t.from.includes(currentStatus) && t.allowedRoles.includes(userRole)).map((t) => t.to);
    }
    transition(application, targetStatus, userRole, operator, remark) {
        const transition = STATE_TRANSITIONS.find((t) => t.from.includes(application.status) && t.to === targetStatus);
        if (!transition) {
            return {
                success: false,
                updatedApplication: application,
                reason: this.createReason('INVALID_TRANSITION', `不允许从${application.status}状态转换到${targetStatus}状态`, 'SettlementStateMachine.transition', operator),
            };
        }
        if (!transition.allowedRoles.includes(userRole)) {
            return {
                success: false,
                updatedApplication: application,
                reason: this.createReason('PERMISSION_DENIED', `角色${userRole}无权执行此状态转换`, 'SettlementStateMachine.transition', operator),
            };
        }
        const reason = this.createReason(transition.reasonCode, `${transition.reasonMessage}${remark ? `：${remark}` : ''}`, 'SettlementStateMachine.transition', operator);
        const updatedApplication = {
            ...application,
            status: targetStatus,
            updatedAt: (0, dayjs_1.default)().toISOString(),
            updatedBy: operator,
            reasons: {
                ...application.reasons,
                stateTransition: [...application.reasons.stateTransition, reason],
            },
        };
        if (targetStatus === 'EXECUTED') {
            updatedApplication.settlementDate = (0, dayjs_1.default)().toISOString();
            updatedApplication.settledBy = operator;
        }
        return {
            success: true,
            updatedApplication,
            reason,
        };
    }
    isEditable(status) {
        return ['DRAFT', 'PENDING_REVIEW'].includes(status);
    }
    isCorrectionAllowed(status) {
        return ['DRAFT', 'PENDING_REVIEW', 'REVIEWED'].includes(status);
    }
}
exports.SettlementStateMachine = SettlementStateMachine;
//# sourceMappingURL=SettlementStateMachine.js.map