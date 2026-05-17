"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransition = canTransition;
exports.validateTransition = validateTransition;
exports.getNextStates = getNextStates;
exports.canResolveConflict = canResolveConflict;
exports.validateConflictResolution = validateConflictResolution;
const errors_1 = require("./errors");
const validStatuses = ['leasing', 'renewal_pending', 'renewed', 'pending_return'];
const transitions = [
    {
        from: ['leasing'],
        to: 'renewal_pending',
        condition: (ctx) => ctx.autoRenewalEligible || ctx.hasManualRenewal
    },
    {
        from: ['renewal_pending'],
        to: 'renewed',
        condition: (ctx) => ctx.allConflictsResolved && ctx.paymentStatus === 'paid'
    },
    {
        from: ['renewal_pending', 'leasing'],
        to: 'pending_return',
        condition: () => true
    },
    {
        from: ['renewed', 'pending_return'],
        to: 'leasing',
        condition: () => true
    },
    {
        from: ['renewed'],
        to: 'pending_return',
        condition: () => true
    }
];
function canTransition(from, to, context = {}) {
    const transition = transitions.find(t => t.from.includes(from) && t.to === to);
    if (!transition)
        return false;
    if (transition.condition && !transition.condition(context))
        return false;
    return true;
}
function validateTransition(from, to, context = {}) {
    if (!validStatuses.includes(to)) {
        return { valid: false, error: errors_1.errors.invalidStatusTransition(from, to) };
    }
    const transition = transitions.find(t => t.from.includes(from) && t.to === to);
    if (!transition) {
        return { valid: false, error: errors_1.errors.invalidStatusTransition(from, to) };
    }
    if (transition.condition && !transition.condition(context)) {
        if (context.unresolvedConflicts > 0) {
            return { valid: false, error: errors_1.errors.conflictNotResolved(context.unresolvedConflicts) };
        }
        if (context.paymentStatus !== 'paid') {
            return { valid: false, error: errors_1.errors.paymentRequired() };
        }
        return { valid: false, error: errors_1.errors.invalidStatusTransition(from, to) };
    }
    return { valid: true };
}
function getNextStates(current) {
    return transitions
        .filter(t => t.from.includes(current))
        .map(t => t.to);
}
function canResolveConflict(context) {
    return !!context.hasRemark;
}
function validateConflictResolution(context) {
    if (!context.hasRemark) {
        return { valid: false, error: errors_1.errors.remarkRequired() };
    }
    return { valid: true };
}
