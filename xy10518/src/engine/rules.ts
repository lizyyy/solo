import { Defect, DefectLevel, InspectionResult, InspectionRecord, Batch, INSPECTION_RULES, DEFECT_LEVEL_WEIGHTS, ValidationResult } from '../types';

export function calculateDefectScore(defects: Defect[]): number {
  return defects.reduce((score, defect) => {
    return score + (DEFECT_LEVEL_WEIGHTS[defect.level] * defect.count);
  }, 0);
}

export function hasCriticalDefect(defects: Defect[]): boolean {
  return defects.some(d => d.level === 'CRITICAL' && d.count > 0);
}

export function getTotalDefectCount(defects: Defect[]): number {
  return defects.reduce((count, defect) => count + defect.count, 0);
}

export function evaluateInspection(defects: Defect[], sampleCount: number, isReinspection: boolean = false): InspectionResult {
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
    ? Math.floor(INSPECTION_RULES.MAX_DEFECTS * 1.5)
    : INSPECTION_RULES.MAX_DEFECTS;

  const minorDefects = defects.find(d => d.level === 'MINOR')?.count || 0;
  if (minorDefects > maxMinorDefects) {
    return 'FAIL';
  }

  if (minorDefects > 0 && !isReinspection) {
    return 'FAIL';
  }

  return 'PASS';
}

export function requiresReinspection(inspection: InspectionRecord, previousInspections: InspectionRecord[]): boolean {
  if (inspection.result === 'PASS') {
    return false;
  }

  if (hasCriticalDefect(inspection.defects) && INSPECTION_RULES.CRITICAL_DEFECT_CONCESSION_ONLY) {
    return false;
  }

  const reinspectionCount = previousInspections.filter(i => 
    previousInspections.indexOf(i) > 0
  ).length;

  return reinspectionCount < 1;
}

export function requiresConcession(inspection: InspectionRecord): boolean {
  return hasCriticalDefect(inspection.defects) && INSPECTION_RULES.CRITICAL_DEFECT_CONCESSION_ONLY;
}

export function validateReinspectionSampleCount(
  initialSampleCount: number, 
  reinspectionSampleCount: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredRatio = INSPECTION_RULES.MIN_REINSPECTION_SAMPLE_RATIO;
  const actualRatio = reinspectionSampleCount / initialSampleCount;

  if (actualRatio < requiredRatio) {
    errors.push(
      `复检样本数不足: 需至少 ${Math.ceil(initialSampleCount * requiredRatio)} 件, 实际 ${reinspectionSampleCount} 件`
    );
  }

  if (reinspectionSampleCount < initialSampleCount * 2) {
    warnings.push(
      `复检样本数建议为初检的2倍以上: 建议 ${initialSampleCount * 2} 件, 实际 ${reinspectionSampleCount} 件`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculateRiskLevel(defects: Defect[]): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const score = calculateDefectScore(defects);
  
  if (score >= 100) return 'CRITICAL';
  if (score >= 30) return 'HIGH';
  if (score >= 10) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'NONE';
}

export function isApprovedAndLocked(batch: Batch): boolean {
  const approvedConcessions = batch.concessionRequests.filter(
    c => c.approvalStatus === 'APPROVED'
  );
  return approvedConcessions.length > 0;
}

export function validateModificationAfterApproval(batch: Batch, actor: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isApprovedAndLocked(batch)) {
    warnings.push(
      `该批次已有让步放行审批记录, 修改需要由质量经理审批并记录修改差异`
    );
  }

  return {
    valid: true,
    errors,
    warnings
  };
}

export function getDefectLevelLabel(level: DefectLevel): string {
  const labels: Record<DefectLevel, string> = {
    CRITICAL: '严重缺陷',
    MAJOR: '主要缺陷',
    MINOR: '次要缺陷',
    NONE: '无缺陷'
  };
  return labels[level];
}

export function formatDefects(defects: Defect[]): string {
  if (defects.length === 0) return '无缺陷';
  
  return defects
    .filter(d => d.count > 0)
    .map(d => `${getDefectLevelLabel(d.level)}: ${d.count}个${d.description ? ` (${d.description})` : ''}`)
    .join('; ');
}
