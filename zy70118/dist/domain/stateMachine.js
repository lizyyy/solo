"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_TRANSITIONS = exports.STATE_NAMES = exports.INSPECTION_OPERATIONS = void 0;
exports.canTransition = canTransition;
exports.validateTransition = validateTransition;
exports.checkDuplicateSubmission = checkDuplicateSubmission;
exports.isTerminalStatus = isTerminalStatus;
exports.getAllowedTargetStates = getAllowedTargetStates;
exports.getNextRequiredState = getNextRequiredState;
const types_1 = require("./types");
const errors_1 = require("./errors");
exports.INSPECTION_OPERATIONS = {
    TEMPERATURE: '验温',
    WEIGHT: '验重',
    TICKET: '验票'
};
exports.STATE_NAMES = {
    [types_1.BatchStatus.PENDING]: '待验收',
    [types_1.BatchStatus.TEMPERATURE_CHECKED]: '验温完成',
    [types_1.BatchStatus.WEIGHT_CHECKED]: '验重完成',
    [types_1.BatchStatus.TICKET_CHECKED]: '验票完成',
    [types_1.BatchStatus.ACCEPTED]: '已验收',
    [types_1.BatchStatus.PARTIALLY_ACCEPTED]: '部分验收',
    [types_1.BatchStatus.REJECTED]: '已拒收',
    [types_1.BatchStatus.REPLENISHED]: '已补货'
};
exports.ALLOWED_TRANSITIONS = new Map([
    [types_1.BatchStatus.PENDING, [
            types_1.BatchStatus.TEMPERATURE_CHECKED,
            types_1.BatchStatus.REJECTED
        ]],
    [types_1.BatchStatus.TEMPERATURE_CHECKED, [
            types_1.BatchStatus.WEIGHT_CHECKED,
            types_1.BatchStatus.REJECTED
        ]],
    [types_1.BatchStatus.WEIGHT_CHECKED, [
            types_1.BatchStatus.TICKET_CHECKED,
            types_1.BatchStatus.REJECTED
        ]],
    [types_1.BatchStatus.TICKET_CHECKED, [
            types_1.BatchStatus.ACCEPTED,
            types_1.BatchStatus.PARTIALLY_ACCEPTED,
            types_1.BatchStatus.REJECTED
        ]],
    [types_1.BatchStatus.REJECTED, [
            types_1.BatchStatus.REPLENISHED
        ]],
    [types_1.BatchStatus.REPLENISHED, [
            types_1.BatchStatus.TEMPERATURE_CHECKED,
            types_1.BatchStatus.WEIGHT_CHECKED,
            types_1.BatchStatus.TICKET_CHECKED,
            types_1.BatchStatus.ACCEPTED
        ]],
    [types_1.BatchStatus.ACCEPTED, []],
    [types_1.BatchStatus.PARTIALLY_ACCEPTED, []]
]);
function canTransition(from, to) {
    const allowed = exports.ALLOWED_TRANSITIONS.get(from);
    if (!allowed) {
        return false;
    }
    return allowed.includes(to);
}
function validateTransition(from, to) {
    if (!canTransition(from, to)) {
        const allowed = exports.ALLOWED_TRANSITIONS.get(from) || [];
        throw new errors_1.InvalidStateTransitionError(exports.STATE_NAMES[from], exports.STATE_NAMES[to], allowed.map(s => exports.STATE_NAMES[s]));
    }
}
function checkDuplicateSubmission(batch, inspectionType) {
    switch (inspectionType) {
        case types_1.InspectionType.TEMPERATURE:
            if (batch.status === types_1.BatchStatus.TEMPERATURE_CHECKED ||
                batch.status === types_1.BatchStatus.WEIGHT_CHECKED ||
                batch.status === types_1.BatchStatus.TICKET_CHECKED ||
                batch.status === types_1.BatchStatus.ACCEPTED ||
                batch.status === types_1.BatchStatus.PARTIALLY_ACCEPTED) {
                throw new errors_1.DuplicateSubmissionError(exports.INSPECTION_OPERATIONS.TEMPERATURE, batch.id);
            }
            break;
        case types_1.InspectionType.WEIGHT:
            if (batch.status === types_1.BatchStatus.WEIGHT_CHECKED ||
                batch.status === types_1.BatchStatus.TICKET_CHECKED ||
                batch.status === types_1.BatchStatus.ACCEPTED ||
                batch.status === types_1.BatchStatus.PARTIALLY_ACCEPTED) {
                throw new errors_1.DuplicateSubmissionError(exports.INSPECTION_OPERATIONS.WEIGHT, batch.id);
            }
            break;
        case types_1.InspectionType.TICKET:
            if (batch.status === types_1.BatchStatus.TICKET_CHECKED ||
                batch.status === types_1.BatchStatus.ACCEPTED ||
                batch.status === types_1.BatchStatus.PARTIALLY_ACCEPTED) {
                throw new errors_1.DuplicateSubmissionError(exports.INSPECTION_OPERATIONS.TICKET, batch.id);
            }
            break;
    }
}
function isTerminalStatus(status) {
    return [
        types_1.BatchStatus.ACCEPTED,
        types_1.BatchStatus.PARTIALLY_ACCEPTED,
        types_1.BatchStatus.REJECTED
    ].includes(status);
}
function getAllowedTargetStates(current) {
    return exports.ALLOWED_TRANSITIONS.get(current) || [];
}
function getNextRequiredState(current) {
    const flow = [
        types_1.BatchStatus.PENDING,
        types_1.BatchStatus.TEMPERATURE_CHECKED,
        types_1.BatchStatus.WEIGHT_CHECKED,
        types_1.BatchStatus.TICKET_CHECKED,
        types_1.BatchStatus.ACCEPTED
    ];
    const currentIndex = flow.indexOf(current);
    if (currentIndex === -1 || currentIndex === flow.length - 1) {
        return null;
    }
    return flow[currentIndex + 1];
}
//# sourceMappingURL=stateMachine.js.map