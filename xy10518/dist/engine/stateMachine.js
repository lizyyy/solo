"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_STATE_MAP = exports.STATE_TRANSITIONS = void 0;
exports.canTransition = canTransition;
exports.validateAction = validateAction;
exports.getNextStatus = getNextStatus;
exports.STATE_TRANSITIONS = {
    CREATED: ['INITIAL_INSPECTION'],
    INITIAL_INSPECTION: ['PASSED', 'PENDING_REINSPECTION', 'PENDING_CONCESSION'],
    PENDING_REINSPECTION: ['REINSPECTION'],
    REINSPECTION: ['PASSED', 'PENDING_CONCESSION', 'REWORK', 'REJECTED'],
    PENDING_CONCESSION: ['CONCESSION_APPROVED', 'REJECTED', 'REWORK', 'PENDING_REINSPECTION'],
    CONCESSION_APPROVED: ['CLOSED'],
    PASSED: ['CLOSED'],
    REJECTED: ['CLOSED'],
    REWORK: ['CLOSED', 'PENDING_REINSPECTION'],
    CLOSED: []
};
exports.ACTION_STATE_MAP = {
    INITIAL_INSPECT: { from: ['CREATED'], to: 'INITIAL_INSPECTION' },
    REINSPECT: { from: ['PENDING_REINSPECTION'], to: 'REINSPECTION' },
    REQUEST_CONCESSION: { from: ['PENDING_CONCESSION', 'REINSPECTION'], to: 'PENDING_CONCESSION' },
    APPROVE_CONCESSION: { from: ['PENDING_CONCESSION'], to: 'CONCESSION_APPROVED' },
    REJECT_CONCESSION: { from: ['PENDING_CONCESSION'], to: 'REJECTED' },
    APPROVE_REWORK: { from: ['REINSPECTION', 'PENDING_CONCESSION'], to: 'REWORK' },
    MANUAL_CORRECTION: {
        from: ['CREATED', 'INITIAL_INSPECTION', 'PENDING_REINSPECTION', 'REINSPECTION',
            'PENDING_CONCESSION', 'CONCESSION_APPROVED', 'PASSED', 'REJECTED', 'REWORK'],
        to: 'CREATED'
    },
    CLOSE_BATCH: { from: ['PASSED', 'REJECTED', 'REWORK', 'CONCESSION_APPROVED'], to: 'CLOSED' }
};
function canTransition(from, to) {
    return exports.STATE_TRANSITIONS[from]?.includes(to) ?? false;
}
function validateAction(action, currentStatus) {
    const mapping = exports.ACTION_STATE_MAP[action];
    if (!mapping)
        return false;
    return mapping.from.includes(currentStatus);
}
function getNextStatus(action) {
    return exports.ACTION_STATE_MAP[action]?.to || 'CREATED';
}
//# sourceMappingURL=stateMachine.js.map