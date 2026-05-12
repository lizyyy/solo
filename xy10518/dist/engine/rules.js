"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDefectScore = calculateDefectScore;
exports.hasCriticalDefect = hasCriticalDefect;
exports.getTotalDefectCount = getTotalDefectCount;
exports.evaluateInspection = evaluateInspection;
exports.requiresReinspection = requiresReinspection;
exports.requiresConcession = requiresConcession;
exports.validateReinspectionSampleCount = validateReinspectionSampleCount;
exports.calculateRiskLevel = calculateRiskLevel;
exports.isApprovedAndLocked = isApprovedAndLocked;
exports.validateModificationAfterApproval = validateModificationAfterApproval;
exports.getDefectLevelLabel = getDefectLevelLabel;
exports.formatDefects = formatDefects;
const types_1 = require("../types");
function calculateDefectScore(defects) {
    return defects.reduce((score, defect) => {
        return score + (types_1.DEFECT_LEVEL_WEIGHTS[defect.level] * defect.count);
    }, 0);
}
function hasCriticalDefect(defects) {
    return defects.some(d => d.level === 'CRITICAL' && d.count > 0);
}
function getTotalDefectCount(defects) {
    return defects.reduce((count, defect) => count + defect.count, 0);
}
function evaluateInspection(defects, sampleCount, isReinspection = false) {
    const totalDefects = getTotalDefectCount(defects);
    const hasCritical = hasCriticalDefect(defects);
    if (hasCritical) {
        return 'FAIL';
    }
    const hasMajor = defects.some(d => d.level === 'MAJOR' && d.count > 0);
    if (hasMajor) {
        return 'FAIL';
    }
    const maxMinorDefects = isReinspection
        ? Math.floor(types_1.INSPECTION_RULES.MAX_DEFECTS * 1.5)
        : types_1.INSPECTION_RULES.MAX_DEFECTS;
    const minorDefects = defects.find(d => d.level === 'MINOR')?.count || 0;
    if (minorDefects > maxMinorDefects) {
        return 'FAIL';
    }
    if (minorDefects > 0 && !isReinspection) {
        return 'FAIL';
    }
    return 'PASS';
}
function requiresReinspection(inspection, previousInspections) {
    if (inspection.result === 'PASS') {
        return false;
    }
    if (hasCriticalDefect(inspection.defects) && types_1.INSPECTION_RULES.CRITICAL_DEFECT_CONCESSION_ONLY) {
        return false;
    }
    const reinspectionCount = previousInspections.filter(i => previousInspections.indexOf(i) > 0).length;
    return reinspectionCount < 1;
}
function requiresConcession(inspection) {
    return hasCriticalDefect(inspection.defects) && types_1.INSPECTION_RULES.CRITICAL_DEFECT_CONCESSION_ONLY;
}
function validateReinspectionSampleCount(initialSampleCount, reinspectionSampleCount) {
    const errors = [];
    const warnings = [];
    const requiredRatio = types_1.INSPECTION_RULES.MIN_REINSPECTION_SAMPLE_RATIO;
    const actualRatio = reinspectionSampleCount / initialSampleCount;
    if (actualRatio < requiredRatio) {
        errors.push(`复检样本数不足: 需至少 ${Math.ceil(initialSampleCount * requiredRatio)} 件, 实际 ${reinspectionSampleCount} 件`);
    }
    if (reinspectionSampleCount < initialSampleCount * 2) {
        warnings.push(`复检样本数建议为初检的2倍以上: 建议 ${initialSampleCount * 2} 件, 实际 ${reinspectionSampleCount} 件`);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}
function calculateRiskLevel(defects) {
    const score = calculateDefectScore(defects);
    if (score >= 100)
        return 'CRITICAL';
    if (score >= 30)
        return 'HIGH';
    if (score >= 10)
        return 'MEDIUM';
    if (score > 0)
        return 'LOW';
    return 'NONE';
}
function isApprovedAndLocked(batch) {
    const approvedConcessions = batch.concessionRequests.filter(c => c.approvalStatus === 'APPROVED');
    return approvedConcessions.length > 0;
}
function validateModificationAfterApproval(batch, actor) {
    const errors = [];
    const warnings = [];
    if (isApprovedAndLocked(batch)) {
        warnings.push(`该批次已有让步放行审批记录, 修改需要由质量经理审批并记录修改差异`);
    }
    return {
        valid: true,
        errors,
        warnings
    };
}
function getDefectLevelLabel(level) {
    const labels = {
        CRITICAL: '严重缺陷',
        MAJOR: '主要缺陷',
        MINOR: '次要缺陷',
        NONE: '无缺陷'
    };
    return labels[level];
}
function formatDefects(defects) {
    if (defects.length === 0)
        return '无缺陷';
    return defects
        .filter(d => d.count > 0)
        .map(d => `${getDefectLevelLabel(d.level)}: ${d.count}个${d.description ? ` (${d.description})` : ''}`)
        .join('; ');
}
//# sourceMappingURL=rules.js.map