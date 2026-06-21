"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSampleField = updateSampleField;
exports.confirmSample = confirmSample;
exports.correctSampleValue = correctSampleValue;
exports.withdrawSample = withdrawSample;
exports.addSample = addSample;
exports.getSampleChangeHistory = getSampleChangeHistory;
exports.getSampleSourceInfo = getSampleSourceInfo;
exports.getConfirmationDiffs = getConfirmationDiffs;
exports.recalculateWithWithdrawn = recalculateWithWithdrawn;
exports.verifyCalibrationConsistency = verifyCalibrationConsistency;
exports.getDirtySamples = getDirtySamples;
exports.getRawSamples = getRawSamples;
const lodash_1 = require("lodash");
const factories_1 = require("../models/factories");
const fitting_1 = require("../algorithms/fitting");
const anomalyDetection_1 = require("../algorithms/anomalyDetection");
function updateSampleField(session, sampleId, field, newValue, changedBy, reason) {
    const sample = session.samples.find(s => s.id === sampleId);
    if (!sample)
        return null;
    const oldValue = sample[field];
    if ((0, lodash_1.isEqual)(oldValue, newValue))
        return sample;
    const changeRecord = (0, factories_1.createChangeRecord)('sample', sampleId, field, oldValue, newValue, changedBy, reason);
    sample[field] = newValue;
    sample.updatedAt = Date.now();
    session.changeHistory.push(changeRecord);
    session.updatedAt = Date.now();
    return sample;
}
function confirmSample(session, sampleId, confirmedBy, notes) {
    const sample = session.samples.find(s => s.id === sampleId);
    if (!sample)
        return null;
    const oldStatus = sample.status;
    if (oldStatus === 'confirmed')
        return sample;
    const changeRecord = (0, factories_1.createChangeRecord)('sample', sampleId, 'status', oldStatus, 'confirmed', confirmedBy, notes || '人工确认样本有效');
    sample.status = 'confirmed';
    sample.confirmedBy = confirmedBy;
    sample.confirmedAt = Date.now();
    sample.confirmedNotes = notes;
    sample.updatedAt = Date.now();
    sample.anomalies.forEach(a => {
        if (!a.resolved && a.severity !== 'high') {
            a.resolved = true;
            a.resolvedAt = Date.now();
            a.resolvedBy = confirmedBy;
        }
    });
    session.changeHistory.push(changeRecord);
    session.updatedAt = Date.now();
    return sample;
}
function correctSampleValue(session, sampleId, field, newValue, correctedBy, notes) {
    const sample = session.samples.find(s => s.id === sampleId);
    if (!sample)
        return null;
    const oldValue = sample[field];
    if (oldValue === newValue)
        return sample;
    const changeRecord = (0, factories_1.createChangeRecord)('sample', sampleId, field, oldValue, newValue, correctedBy, notes || '人工修正数值');
    sample[field] = newValue;
    sample.correctionNotes = notes;
    if (sample.status === 'raw') {
        sample.status = 'dirty';
    }
    sample.updatedAt = Date.now();
    session.changeHistory.push(changeRecord);
    session.updatedAt = Date.now();
    (0, anomalyDetection_1.detectAllAnomalies)(session.samples);
    return sample;
}
function withdrawSample(session, sampleId, withdrawnBy, reason) {
    const sample = session.samples.find(s => s.id === sampleId);
    if (!sample)
        return null;
    const oldStatus = sample.status;
    if (oldStatus === 'withdrawn')
        return sample;
    const changeRecord = (0, factories_1.createChangeRecord)('sample', sampleId, 'status', oldStatus, 'withdrawn', withdrawnBy, reason);
    sample.status = 'withdrawn';
    sample.withdrawnReason = reason;
    sample.withdrawnAt = Date.now();
    sample.updatedAt = Date.now();
    session.changeHistory.push(changeRecord);
    session.updatedAt = Date.now();
    (0, anomalyDetection_1.detectAllAnomalies)(session.samples);
    return sample;
}
function addSample(session, x, y, source, addedBy) {
    const sample = (0, factories_1.createSample)(x, y, source, 'raw');
    const changeRecord = (0, factories_1.createChangeRecord)('sample', sample.id, 'created', null, sample, addedBy, '新增样本');
    session.samples.push(sample);
    session.changeHistory.push(changeRecord);
    session.updatedAt = Date.now();
    (0, anomalyDetection_1.detectAllAnomalies)(session.samples);
    return sample;
}
function getSampleChangeHistory(session, sampleId) {
    return session.changeHistory
        .filter(c => c.entityType === 'sample' && c.entityId === sampleId)
        .sort((a, b) => {
        if (b.changedAt !== a.changedAt) {
            return b.changedAt - a.changedAt;
        }
        return b.id.localeCompare(a.id);
    });
}
function getSampleSourceInfo(sample) {
    const { source } = sample;
    const parts = [
        `学生: ${source.studentId}`,
        `草稿: ${source.draftId}`,
        `文件: ${source.fileName}`,
    ];
    if (source.originalLine !== undefined) {
        parts.push(`行号: ${source.originalLine}`);
    }
    if (source.notes) {
        parts.push(`备注: ${source.notes}`);
    }
    return parts.join(' | ');
}
function getConfirmationDiffs(session, sampleId) {
    const allHistory = session.changeHistory
        .filter(c => c.entityType === 'sample' && c.entityId === sampleId)
        .sort((a, b) => {
        if (a.changedAt !== b.changedAt) {
            return a.changedAt - b.changedAt;
        }
        return a.id.localeCompare(b.id);
    });
    const confirmationIndex = allHistory.findIndex(c => c.field === 'status' && c.newValue === 'confirmed');
    if (confirmationIndex === -1)
        return [];
    const diffs = [];
    for (let i = 0; i <= confirmationIndex; i++) {
        const c = allHistory[i];
        diffs.push({
            sampleId,
            field: c.field,
            before: c.oldValue,
            after: c.newValue,
            changedBy: c.changedBy,
            changedAt: c.changedAt,
            reason: c.reason,
        });
    }
    return diffs.sort((a, b) => {
        if (b.changedAt !== a.changedAt) {
            return b.changedAt - a.changedAt;
        }
        if (a.field === 'status' && b.field !== 'status')
            return -1;
        if (b.field === 'status' && a.field !== 'status')
            return 1;
        return 0;
    });
}
function recalculateWithWithdrawn(session, withdrawnSampleId, method, calculatedBy, degree) {
    const sample = session.samples.find(s => s.id === withdrawnSampleId);
    if (!sample || sample.status !== 'withdrawn')
        return null;
    const samplesBefore = (0, lodash_1.cloneDeep)(session.samples);
    const targetSampleBefore = samplesBefore.find(s => s.id === withdrawnSampleId);
    if (targetSampleBefore) {
        targetSampleBefore.status = 'raw';
        targetSampleBefore.withdrawnReason = undefined;
        targetSampleBefore.withdrawnAt = undefined;
        targetSampleBefore.anomalies = targetSampleBefore.anomalies.filter(a => a.type !== 'withdrawn');
    }
    const before = (0, fitting_1.calculateFitting)(samplesBefore, method, calculatedBy, true, degree);
    const after = (0, fitting_1.calculateFitting)(session.samples, method, calculatedBy, true, degree);
    return { before, after };
}
function verifyCalibrationConsistency(session, fittingId) {
    const fitting = session.fittingParams.find(f => f.id === fittingId);
    if (!fitting) {
        return { consistent: false, mismatches: [{ sampleId: 'none', type: 'status_mismatch', message: '拟合记录不存在' }] };
    }
    const mismatches = [];
    const chartIncludedIds = new Set(fitting.sampleIds);
    const chartExcludedIds = new Set(fitting.excludedSampleIds);
    session.samples.forEach(sample => {
        const isIncludedInChart = chartIncludedIds.has(sample.id);
        const shouldBeExcluded = sample.status === 'withdrawn' ||
            sample.anomalies.some(a => !a.resolved && a.severity === 'high');
        if (isIncludedInChart && shouldBeExcluded) {
            mismatches.push({
                sampleId: sample.id,
                type: 'exclusion_mismatch',
                chartIncluded: true,
                detailIncluded: false,
                message: `图表包含了应排除的样本（状态: ${sample.status}，异常: ${sample.anomalies.filter(a => !a.resolved).map(a => a.type).join(', ')}）`,
            });
        }
        if (!isIncludedInChart && !shouldBeExcluded && !chartExcludedIds.has(sample.id)) {
            mismatches.push({
                sampleId: sample.id,
                type: 'exclusion_mismatch',
                chartIncluded: false,
                detailIncluded: true,
                message: '图表未包含应纳入的正常样本',
            });
        }
        if (sample.rawX !== sample.x || sample.rawY !== sample.y) {
            mismatches.push({
                sampleId: sample.id,
                type: 'raw_modified',
                rawValue: sample.rawY,
                currentValue: sample.y,
                message: `原始值(${sample.rawY.toFixed(4)})与当前值(${sample.y.toFixed(4)})不一致，已人工修正`,
            });
        }
        const withdrawnAnomaly = sample.anomalies.find(a => a.type === 'withdrawn');
        if (sample.status === 'withdrawn' && !withdrawnAnomaly) {
            mismatches.push({
                sampleId: sample.id,
                type: 'status_mismatch',
                message: '样本状态为撤回但缺少撤回异常标记',
            });
        }
    });
    return {
        consistent: mismatches.length === 0,
        mismatches,
    };
}
function getDirtySamples(session) {
    return session.samples.filter(s => s.status === 'dirty');
}
function getRawSamples(session) {
    return session.samples.filter(s => s.status === 'raw');
}
//# sourceMappingURL=traceability.js.map