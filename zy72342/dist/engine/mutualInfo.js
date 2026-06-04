"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMutualInformation = calculateMutualInformation;
exports.calculateMutualInfoForRow = calculateMutualInfoForRow;
exports.evaluateBoundaryCondition = evaluateBoundaryCondition;
exports.calculateCorrelationScore = calculateCorrelationScore;
function calculateMutualInformation(input) {
    const { answerValues, targetLabels } = input;
    if (answerValues.length === 0 || targetLabels.length === 0) {
        return 0;
    }
    if (answerValues.length !== targetLabels.length) {
        throw new Error('answerValues and targetLabels must have the same length');
    }
    const n = answerValues.length;
    const valueCounts = new Map();
    const labelCounts = new Map();
    const jointCounts = new Map();
    for (let i = 0; i < n; i++) {
        const v = answerValues[i];
        const l = targetLabels[i];
        valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
        labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
        const key = `${v},${l}`;
        jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
    }
    let mi = 0;
    for (const [key, jointCount] of jointCounts.entries()) {
        const [vStr, lStr] = key.split(',');
        const v = parseFloat(vStr);
        const l = parseFloat(lStr);
        const pJoint = jointCount / n;
        const pValue = (valueCounts.get(v) || 0) / n;
        const pLabel = (labelCounts.get(l) || 0) / n;
        if (pValue > 0 && pLabel > 0 && pJoint > 0) {
            mi += pJoint * Math.log2(pJoint / (pValue * pLabel));
        }
    }
    const maxMI = calculateMaxMI(valueCounts, labelCounts, n);
    if (maxMI === 0)
        return 0;
    return Math.max(0, Math.min(1, mi / maxMI));
}
function calculateMaxMI(valueCounts, labelCounts, n) {
    let maxMI = 0;
    for (const count of valueCounts.values()) {
        const p = count / n;
        if (p > 0) {
            maxMI -= p * Math.log2(p);
        }
    }
    for (const count of labelCounts.values()) {
        const p = count / n;
        if (p > 0) {
            maxMI -= p * Math.log2(p);
        }
    }
    return maxMI;
}
function calculateMutualInfoForRow(row, allRows, boundaryNotes) {
    const sameQuestionRows = allRows.filter(r => r.questionId === row.questionId);
    if (sameQuestionRows.length < 2) {
        return { score: 0.5, threshold: 0.5, isAtThreshold: true };
    }
    const answerValues = sameQuestionRows.map(r => r.answerValue);
    const median = calculateMedian(answerValues);
    const targetLabels = sameQuestionRows.map(r => (r.answerValue > median ? 1 : 0));
    const rowIndex = sameQuestionRows.findIndex(r => r.id === row.id);
    if (rowIndex === -1) {
        return { score: 0.5, threshold: 0.5, isAtThreshold: true };
    }
    const input = {
        answerValues: answerValues.map((v, i) => i === rowIndex ? v : v > median ? 1 : 0),
        targetLabels,
    };
    let score = calculateMutualInformation(input);
    if (score === 0) {
        score = 0.1;
    }
    const relevantNotes = boundaryNotes.filter(n => n.questionId === row.questionId &&
        (!n.respondentId || n.respondentId === row.respondentId));
    let threshold = 0.5;
    if (relevantNotes.length > 0) {
        const noteThresholds = relevantNotes.map(n => n.threshold);
        threshold = Math.min(...noteThresholds);
    }
    const isAtThreshold = Math.abs(score - threshold) < 0.001;
    return { score, threshold, isAtThreshold };
}
function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}
function evaluateBoundaryCondition(answerValue, note) {
    switch (note.operator) {
        case '>':
            return answerValue > note.threshold;
        case '<':
            return answerValue < note.threshold;
        case '>=':
            return answerValue >= note.threshold;
        case '<=':
            return answerValue <= note.threshold;
        case '==':
            return Math.abs(answerValue - note.threshold) < 0.001;
        default:
            return false;
    }
}
function calculateCorrelationScore(row, notes) {
    const relevantNotes = notes.filter(n => n.questionId === row.questionId &&
        (!n.respondentId || n.respondentId === row.respondentId));
    if (relevantNotes.length === 0) {
        return 0.5;
    }
    let matchCount = 0;
    for (const note of relevantNotes) {
        if (evaluateBoundaryCondition(row.answerValue, note)) {
            matchCount++;
        }
    }
    return matchCount / relevantNotes.length;
}
//# sourceMappingURL=mutualInfo.js.map