"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialWorkflow = createInitialWorkflow;
exports.advanceStep = advanceStep;
exports.finishWorkflow = finishWorkflow;
exports.isWorkflowDone = isWorkflowDone;
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
    const isLastStep = stepIndex === state.steps.length - 1;
    const nextStep = updatedSteps[stepIndex + 1];
    return {
        ...state,
        currentStep: isLastStep ? stepName : nextStep ? nextStep.name : stepName,
        steps: updatedSteps,
        updatedAt: now
    };
}
function finishWorkflow(state, operator) {
    const now = new Date().toISOString();
    return {
        ...state,
        currentStep: state.steps[state.steps.length - 1].name,
        steps: state.steps.map(step => {
            if (step.name === 'update_settlement' && step.status !== 'completed') {
                return {
                    ...step,
                    status: 'completed',
                    completedAt: now,
                    operator
                };
            }
            return step;
        }),
        updatedAt: now
    };
}
function isWorkflowDone(state) {
    return state.steps.every(s => s.status === 'completed');
}
function step1ImportTunerMessages(tunerLines, operator) {
    const batchId = (0, uuid_1.v4)();
    const { batch, records: tunerRecords } = (0, import_1.parseTunerMessage)(tunerLines, batchId, operator);
    const existingRecords = unifiedResult_1.unifiedStore.getRecords();
    const existingKeys = new Set(existingRecords
        .filter(r => r.tunerMessageId)
        .map(r => `${r.studentName}|${r.courseDate}|${r.courseTime}|${r.teacherName}`));
    let consumptionRecords = (0, import_1.createConsumptionRecordsFromTuner)(tunerRecords);
    const reuseReport = { reused: 0, newlyAdded: 0 };
    consumptionRecords = consumptionRecords.map(record => {
        const key = `${record.studentName}|${record.courseDate}|${record.courseTime}|${record.teacherName}`;
        if (existingKeys.has(key)) {
            reuseReport.reused++;
            return {
                ...record,
                importSource: 'reimport_reuse',
                importBatchLabel: `复用(已有相同调音师留言): ${record.tunerRawContent}`,
                manualEdits: [{
                        id: (0, uuid_1.v4)(),
                        timestamp: new Date().toISOString(),
                        operator: 'system',
                        action: 'reimport_detected',
                        reason: `重复导入检测: 调音师留言"${record.tunerRawContent}"在系统中已存在，标记为复用记录`
                    }]
            };
        }
        reuseReport.newlyAdded++;
        return record;
    });
    consumptionRecords = (0, selfCheck_1.markDuplicates)(consumptionRecords);
    if (existingRecords.length === 0) {
        unifiedResult_1.unifiedStore.setRecords(consumptionRecords);
    }
    else {
        unifiedResult_1.unifiedStore.setRecords([...existingRecords, ...consumptionRecords]);
    }
    unifiedResult_1.unifiedStore.addBatch(batch);
    const workflow = createInitialWorkflow();
    return {
        records: unifiedResult_1.unifiedStore.getRecords(),
        batch,
        workflow,
        reuseReport
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
        if (record.status === types_1.RecordStatus.MATCHED) {
            return {
                ...record,
                status: types_1.RecordStatus.CONFIRMED,
                updatedAt: new Date().toISOString()
            };
        }
        if (record.status === types_1.RecordStatus.IMPORTED && record.reviewFlag === types_1.ReviewFlag.NONE) {
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
    const workflow = finishWorkflow(advanceStep(currentWorkflow, 'review_group', operator), operator);
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