"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialWorkflow = createInitialWorkflow;
exports.advanceStep = advanceStep;
exports.step1ImportTunerMessages = step1ImportTunerMessages;
exports.step2ReviewGroupSignup = step2ReviewGroupSignup;
exports.step3UpdateSettlement = step3UpdateSettlement;
exports.canAdvanceToStep = canAdvanceToStep;
exports.isStepCompleted = isStepCompleted;
exports.getPendingReviews = getPendingReviews;
const uuid_1 = require("uuid");
const types_1 = require("./types");
const import_1 = require("./import");
const selfCheck_1 = require("./selfCheck");
const audit_1 = require("./audit");
const unifiedResult_1 = require("./unifiedResult");
function createInitialWorkflow() {
    const now = new Date().toISOString();
    return {
        currentStep: 'import_tuner',
        steps: [
            { name: 'import_tuner', status: 'in_progress' },
            { name: 'review_group', status: 'pending' },
            { name: 'update_settlement', status: 'pending' }
        ],
        startedAt: now,
        updatedAt: now
    };
}
function advanceStep(state, stepName, operator) {
    const now = new Date().toISOString();
    const stepIndex = state.steps.findIndex(s => s.name === stepName);
    if (stepIndex === -1)
        return state;
    const updatedSteps = state.steps.map((step, index) => {
        if (index === stepIndex) {
            return {
                ...step,
                status: 'completed',
                completedAt: now,
                operator
            };
        }
        if (index === stepIndex + 1) {
            return {
                ...step,
                status: 'in_progress'
            };
        }
        return step;
    });
    const nextStep = updatedSteps[stepIndex + 1];
    return {
        ...state,
        currentStep: nextStep ? nextStep.name : stepName,
        steps: updatedSteps,
        updatedAt: now
    };
}
function step1ImportTunerMessages(tunerLines, operator) {
    const batchId = (0, uuid_1.v4)();
    const { batch, records: tunerRecords } = (0, import_1.parseTunerMessage)(tunerLines, batchId, operator);
    let consumptionRecords = (0, import_1.createConsumptionRecordsFromTuner)(tunerRecords);
    consumptionRecords = (0, selfCheck_1.markDuplicates)(consumptionRecords);
    unifiedResult_1.unifiedStore.setRecords(consumptionRecords);
    unifiedResult_1.unifiedStore.addBatch(batch);
    const workflow = createInitialWorkflow();
    return {
        records: consumptionRecords,
        batch,
        workflow
    };
}
function step2ReviewGroupSignup(groupLines, operator, currentWorkflow) {
    const batchId = (0, uuid_1.v4)();
    const { batch, records: groupRecords } = (0, import_1.parseGroupSignup)(groupLines, batchId, operator);
    let existingRecords = unifiedResult_1.unifiedStore.getRecords();
    let mergedRecords = (0, import_1.mergeGroupSignupToRecords)(existingRecords, groupRecords);
    mergedRecords = (0, selfCheck_1.markDuplicates)(mergedRecords);
    mergedRecords = (0, selfCheck_1.recalculateAfterSupplement)(mergedRecords);
    unifiedResult_1.unifiedStore.setRecords(mergedRecords);
    unifiedResult_1.unifiedStore.addBatch(batch);
    const workflow = advanceStep(currentWorkflow, 'import_tuner', operator);
    return {
        records: mergedRecords,
        batch,
        workflow
    };
}
function step3UpdateSettlement(operator, currentWorkflow) {
    let records = unifiedResult_1.unifiedStore.getRecords();
    records = records.map(record => {
        if (record.status === types_1.RecordStatus.MATCHED ||
            (record.status === types_1.RecordStatus.IMPORTED && record.reviewFlag === 'none')) {
            return {
                ...record,
                status: types_1.RecordStatus.CONFIRMED,
                updatedAt: new Date().toISOString()
            };
        }
        return record;
    });
    records = (0, audit_1.settleRecords)(records, operator);
    records = (0, selfCheck_1.recalculateAfterSupplement)(records);
    unifiedResult_1.unifiedStore.setRecords(records);
    const workflow = advanceStep(currentWorkflow, 'review_group', operator);
    return {
        records,
        workflow
    };
}
function canAdvanceToStep(state, targetStep) {
    const stepOrder = ['import_tuner', 'review_group', 'update_settlement'];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);
    return targetIndex === currentIndex + 1;
}
function isStepCompleted(state, stepName) {
    const step = state.steps.find(s => s.name === stepName);
    return step?.status === 'completed';
}
function getPendingReviews(records) {
    return records.filter(r => r.status === types_1.RecordStatus.NEEDS_REVIEW);
}
//# sourceMappingURL=workflow.js.map