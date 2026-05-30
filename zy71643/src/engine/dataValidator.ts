import type { PipelineSegment, DataIssue, DetectionConfig } from '../types';
import { logger } from '../utils/logger';

const UNIT_ERROR_THRESHOLD = 100;

export interface ValidationResult {
  segments: PipelineSegment[];
  issues: DataIssue[];
  correctedCount: number;
  skippedCount: number;
}

export function validateAndCorrectPipelineData(
  segments: PipelineSegment[],
  config: DetectionConfig
): ValidationResult {
  logger.info('data', '开始校验管线数据', { total: segments.length });

  const correctedSegments: PipelineSegment[] = [];
  const allIssues: DataIssue[] = [];
  let correctedCount = 0;
  let skippedCount = 0;
  const seenCoordinates = new Set<string>();

  for (const segment of segments) {
    const issues: DataIssue[] = [];
    let correctedSegment = { ...segment };
    let shouldSkip = false;

    const coordKey = `${segment.startPoint.x},${segment.startPoint.y},${segment.startPoint.z},${segment.endPoint.x},${segment.endPoint.y},${segment.endPoint.z}`;

    if (seenCoordinates.has(coordKey) && segment.dataSource !== 'duplicate') {
      issues.push({
        type: 'duplicate',
        description: '管线坐标重复，疑似重复录入',
        originalValue: coordKey,
        impact: '重复管线会导致虚假碰撞，建议删除重复数据后重新检测',
      });
      correctedSegment.dataSource = 'duplicate';
      correctedSegment.hasWarning = true;
      correctedSegment.warningMessage = '管线坐标重复，疑似重复录入';
      correctedCount++;
    }
    seenCoordinates.add(coordKey);

    if (
      Math.abs(segment.startPoint.y) > UNIT_ERROR_THRESHOLD ||
      Math.abs(segment.endPoint.y) > UNIT_ERROR_THRESHOLD
    ) {
      const originalY = { start: segment.startPoint.y, end: segment.endPoint.y };

      if (config.autoCorrectUnit) {
        correctedSegment.startPoint = {
          ...segment.startPoint,
          y: segment.startPoint.y / 1000,
        };
        correctedSegment.endPoint = {
          ...segment.endPoint,
          y: segment.endPoint.y / 1000,
        };
        issues.push({
          type: 'unit_error',
          description: '标高单位疑似错误，已自动修正（毫米→米）',
          originalValue: originalY,
          correctedValue: { start: correctedSegment.startPoint.y, end: correctedSegment.endPoint.y },
          impact: `修正前标高${originalY.start}m超出正常范围，修正后标高${correctedSegment.startPoint.y}m，可能导致碰撞检测结果变化`,
        });
        correctedSegment.hasWarning = true;
        correctedSegment.warningMessage = '标高单位已自动修正';
        correctedSegment.dataSource = 'corrected';
        correctedCount++;
      } else {
        issues.push({
          type: 'unit_error',
          description: '标高值异常，疑似单位错误',
          originalValue: originalY,
          impact: '异常标高会导致管线位置严重偏离，碰撞检测结果不可靠',
        });
        shouldSkip = true;
      }
    }

    if (segment.diameter <= 0) {
      issues.push({
        type: 'missing',
        description: '管径数据缺失',
        originalValue: segment.diameter,
        impact: '缺失管径的管线无法进行准确的净距计算，已跳过碰撞检测',
      });
      shouldSkip = true;
    }

    if (!segment.startPileNo || !segment.endPileNo) {
      issues.push({
        type: 'missing',
        description: '桩号数据缺失',
        originalValue: { start: segment.startPileNo, end: segment.endPileNo },
        impact: '缺失桩号的管线无法准确定位，建议补充桩号信息',
      });
      correctedSegment.hasWarning = true;
      correctedSegment.warningMessage = correctedSegment.warningMessage || '桩号数据缺失';
    }

    if (issues.length > 0) {
      logger.warning('data', `管线 ${segment.id} 存在${issues.length}个数据问题`, {
        segmentId: segment.id,
        issues: issues.map((i) => i.description),
      });
      allIssues.push(...issues);
    }

    if (shouldSkip) {
      skippedCount++;
      logger.warning('data', `管线 ${segment.id} 已跳过碰撞检测`, { reason: issues[0]?.description });
    }

    correctedSegments.push(correctedSegment);
  }

  logger.info('data', '数据校验完成', {
    total: segments.length,
    corrected: correctedCount,
    skipped: skippedCount,
    issues: allIssues.length,
  });

  return {
    segments: correctedSegments,
    issues: allIssues,
    correctedCount,
    skippedCount,
  };
}

export function findElevationAnomalies(
  segments: PipelineSegment[],
  tolerance: number
): DataIssue[] {
  const issues: DataIssue[] = [];
  const pileNoMap = new Map<string, PipelineSegment[]>();

  for (const seg of segments) {
    if (seg.startPileNo) {
      const existing = pileNoMap.get(seg.startPileNo) || [];
      existing.push(seg);
      pileNoMap.set(seg.startPileNo, existing);
    }
  }

  for (const [pileNo, segsAtPile] of pileNoMap) {
    const sameTypeGroups = new Map<string, PipelineSegment[]>();
    for (const seg of segsAtPile) {
      const key = seg.type;
      const group = sameTypeGroups.get(key) || [];
      group.push(seg);
      sameTypeGroups.set(key, group);
    }

    for (const [type, group] of sameTypeGroups) {
      if (group.length >= 2) {
        const elevations = group.map((g) => g.startPoint.y);
        const maxDiff = Math.max(...elevations) - Math.min(...elevations);
        if (maxDiff > tolerance) {
          issues.push({
            type: 'elevation_mismatch',
            description: `桩号${pileNo}处${type}管线标高差异过大`,
            originalValue: elevations,
            impact: `同桩号处同类管线标高差异${maxDiff.toFixed(2)}m，超出容差${tolerance}m，可能存在设计错误`,
          });
        }
      }
    }
  }

  return issues;
}
