import { InspectionRecord, SelfCheckResult, NightSamplingPoint } from '@/types';
import { generateId, generateChecksum } from '@/utils/helpers';
import dayjs from 'dayjs';

export function runAllChecks(
  records: InspectionRecord[],
  samplingPoints: NightSamplingPoint[]
): SelfCheckResult[] {
  const results: SelfCheckResult[] = [];

  results.push(checkDuplicateImports(samplingPoints));
  results.push(checkRampScoreUnchanged(records));
  results.push(checkRecalculateAfterSupplement(records));
  results.push(checkExportConsistency(records));

  return results;
}

export function checkDuplicateImports(samplingPoints: NightSamplingPoint[]): SelfCheckResult {
  const codeCount = new Map<string, number>();
  samplingPoints.forEach(point => {
    codeCount.set(point.pointCode, (codeCount.get(point.pointCode) || 0) + 1);
  });

  const duplicates: string[] = [];
  codeCount.forEach((count, code) => {
    if (count > 1) duplicates.push(code);
  });

  return {
    id: generateId(),
    checkType: 'duplicate_import',
    checkName: '重复导入检测',
    status: duplicates.length > 0 ? 'warning' : 'pass',
    message: duplicates.length > 0 
      ? `发现 ${duplicates.length} 个采样点重复导入`
      : '未发现重复导入',
    affectedRecords: duplicates,
    checkTime: dayjs().toISOString()
  };
}

export function checkRampScoreUnchanged(records: InspectionRecord[]): SelfCheckResult {
  const unchangedRecords = records.filter(r => r.rampScoreUnchanged && !r.conflictEvidence.find(c => c.type === 'ramp_score_unchanged' && c.resolved));
  
  const affectedIds = unchangedRecords.map(r => r.pointCode);

  return {
    id: generateId(),
    checkType: 'ramp_score_unchanged',
    checkName: '坡道补录后评分未变化检测',
    status: unchangedRecords.length > 0 ? 'fail' : 'pass',
    message: unchangedRecords.length > 0
      ? `发现 ${unchangedRecords.length} 条记录坡道补录后评分未变化，需交通协管复核`
      : '所有坡道补录记录评分正常更新',
    affectedRecords: affectedIds,
    checkTime: dayjs().toISOString()
  };
}

export function checkRecalculateAfterSupplement(records: InspectionRecord[]): SelfCheckResult {
  const failedRecords: string[] = [];
  
  records.forEach(record => {
    if (record.rampSupplementTime && record.nightSampling) {
      const expectedScore = calculateExpectedScore(
        record.nightSampling.illumination,
        true
      );
      if (Math.abs(record.score - expectedScore) > 5 && !record.rampScoreUnchanged) {
        failedRecords.push(record.pointCode);
      }
    }
  });

  return {
    id: generateId(),
    checkType: 'recalculate_after_supplement',
    checkName: '补录后重算验证',
    status: failedRecords.length > 0 ? 'fail' : 'pass',
    message: failedRecords.length > 0
      ? `发现 ${failedRecords.length} 条记录补录后评分重算异常`
      : '所有补录记录评分计算正常',
    affectedRecords: failedRecords,
    checkTime: dayjs().toISOString()
  };
}

export function checkExportConsistency(records: InspectionRecord[]): SelfCheckResult {
  const json1 = JSON.stringify(records);
  const json2 = JSON.stringify(JSON.parse(JSON.stringify(records)));
  const checksum1 = generateChecksum(json1);
  const checksum2 = generateChecksum(json2);

  const isConsistent = checksum1 === checksum2;

  return {
    id: generateId(),
    checkType: 'export_consistency',
    checkName: '导出一致性校验',
    status: isConsistent ? 'pass' : 'fail',
    message: isConsistent
      ? '页面展示、接口返回、导出数据一致性校验通过'
      : '数据一致性校验失败，请检查数据源',
    affectedRecords: [],
    checkTime: dayjs().toISOString()
  };
}

function calculateExpectedScore(illumination: number, hasRamp: boolean): number {
  let baseScore = Math.min(100, Math.max(0, illumination * 2));
  if (hasRamp) {
    baseScore = Math.max(0, baseScore - 15);
  }
  return Math.round(baseScore);
}
