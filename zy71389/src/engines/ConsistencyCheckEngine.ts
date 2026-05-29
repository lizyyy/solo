import { 
  ExposureLog, 
  CheckResult, 
  ConversionData, 
  ContaminationType, 
  ConsistencyReport, 
  ConsistencyDetail 
} from '../types';

export class ConsistencyCheckEngine {
  static generateChecksum(exposures: ExposureLog[], conversions: ConversionData[]): string {
    const sortedExposures = [...exposures].sort((a, b) => 
      a.exposureId.localeCompare(b.exposureId)
    );
    
    const sortedConversions = [...conversions].sort((a, b) => 
      a.conversionId.localeCompare(b.conversionId)
    );

    let hash = 0;
    const exposureStr = JSON.stringify(sortedExposures.map(e => ({
      exposureId: e.exposureId,
      isContaminated: e.isContaminated,
      contaminationType: e.contaminationType
    })));
    
    const conversionStr = JSON.stringify(sortedConversions.map(c => ({
      conversionId: c.conversionId,
      exposureId: c.exposureId
    })));

    const combined = exposureStr + conversionStr;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  static verifyChecksum(
    exposures: ExposureLog[],
    conversions: ConversionData[],
    expectedChecksum: string
  ): boolean {
    const actualChecksum = this.generateChecksum(exposures, conversions);
    return actualChecksum === expectedChecksum;
  }

  static performConsistencyCheck(
    exposures: ExposureLog[],
    conversions: ConversionData[],
    result: CheckResult
  ): ConsistencyReport {
    const details: ConsistencyDetail[] = [];

    const totalExposures = exposures.length;
    details.push({
      name: '总曝光量一致性',
      match: result.totalExposures === totalExposures,
      expected: result.totalExposures,
      actual: totalExposures,
      diff: result.totalExposures - totalExposures
    });

    const contaminatedCount = exposures.filter(e => e.isContaminated).length;
    details.push({
      name: '污染记录数一致性',
      match: result.contaminatedCount === contaminatedCount,
      expected: result.contaminatedCount,
      actual: contaminatedCount,
      diff: result.contaminatedCount - contaminatedCount
    });

    const crossGroupCount = exposures.filter(
      e => e.contaminationType === ContaminationType.CROSS_GROUP
    ).length;
    details.push({
      name: '串组记录数一致性',
      match: result.crossGroupCount === crossGroupCount,
      expected: result.crossGroupCount,
      actual: crossGroupCount,
      diff: result.crossGroupCount - crossGroupCount
    });

    const duplicateCount = exposures.filter(
      e => e.contaminationType === ContaminationType.DUPLICATE_EXPOSURE
    ).length;
    details.push({
      name: '重复曝光记录数一致性',
      match: result.duplicateExposureCount === duplicateCount,
      expected: result.duplicateExposureCount,
      actual: duplicateCount,
      diff: result.duplicateExposureCount - duplicateCount
    });

    const configChangeCount = exposures.filter(
      e => e.contaminationType === ContaminationType.CONFIG_CHANGE
    ).length;
    details.push({
      name: '配置变更污染记录数一致性',
      match: result.configChangeCount === configChangeCount,
      expected: result.configChangeCount,
      actual: configChangeCount,
      diff: result.configChangeCount - configChangeCount
    });

    const affectedUsersFromData = new Set(
      exposures.filter(e => e.isContaminated).map(e => e.userId)
    ).size;
    details.push({
      name: '受影响用户数一致性',
      match: result.affectedUsers.length === affectedUsersFromData,
      expected: result.affectedUsers.length,
      actual: affectedUsersFromData,
      diff: result.affectedUsers.length - affectedUsersFromData
    });

    const contaminatedExposuresFromData = exposures
      .filter(e => e.isContaminated)
      .map(e => e.exposureId)
      .sort();
    const contaminatedExposuresFromResult = [...result.contaminatedExposures].sort();
    const exposureIdsMatch = 
      contaminatedExposuresFromData.length === contaminatedExposuresFromResult.length &&
      contaminatedExposuresFromData.every((id, i) => id === contaminatedExposuresFromResult[i]);
    
    details.push({
      name: '污染曝光ID列表一致性',
      match: exposureIdsMatch,
      expected: contaminatedExposuresFromResult.length,
      actual: contaminatedExposuresFromData.length,
      diff: contaminatedExposuresFromResult.length - contaminatedExposuresFromData.length
    });

    const actualChecksum = this.generateChecksum(exposures, conversions);
    details.push({
      name: '数据校验和一致性',
      match: result.consistencyChecksum === actualChecksum,
      expected: 0,
      actual: 0,
      diff: 0
    });

    const phaseExposureTotal = result.phaseResults.reduce(
      (sum, p) => sum + p.exposureCount, 0
    );
    details.push({
      name: '阶段曝光量汇总一致性',
      match: phaseExposureTotal === totalExposures,
      expected: totalExposures,
      actual: phaseExposureTotal,
      diff: totalExposures - phaseExposureTotal
    });

    const validExposures = exposures.filter(e => !e.isContaminated);
    const validExposureIds = new Set(validExposures.map(e => e.exposureId));
    const validConversions = conversions.filter(c => validExposureIds.has(c.exposureId));
    
    const recalcRate = validExposures.length > 0 
      ? validConversions.length / validExposures.length 
      : 0;
    
    details.push({
      name: '重算转化率一致性',
      match: Math.abs(result.recalculatedMetrics.conversionRate - recalcRate) < 0.0001,
      expected: Math.round(result.recalculatedMetrics.conversionRate * 10000),
      actual: Math.round(recalcRate * 10000),
      diff: Math.round((result.recalculatedMetrics.conversionRate - recalcRate) * 10000)
    });

    const allPassed = details.every(c => c.match);
    const passedCount = details.filter(c => c.match).length;
    const totalCount = details.length;

    return {
      isConsistent: allPassed,
      checksum: actualChecksum,
      details,
      summary: allPassed 
        ? `所有 ${totalCount} 项一致性检查通过` 
        : `${passedCount}/${totalCount} 项检查通过，请关注失败项`
    };
  }

  static generateTableRow(
    exposure: ExposureLog,
    conversionData: ConversionData[]
  ): Record<string, any> {
    const conversions = conversionData.filter(c => c.exposureId === exposure.exposureId);
    
    return {
      exposureId: exposure.exposureId,
      userId: exposure.userId,
      experimentId: exposure.experimentId,
      groupId: exposure.groupId,
      exposureTime: new Date(exposure.exposureTime).toISOString(),
      configVersion: exposure.configVersion,
      isContaminated: exposure.isContaminated,
      contaminationType: exposure.contaminationType,
      contaminationReason: exposure.contaminationReason || '',
      conversionCount: conversions.length,
      totalConversionValue: conversions.reduce((sum, c) => sum + c.conversionValue, 0)
    };
  }

  static verifyExportData(
    exportRows: Record<string, any>[],
    exposures: ExposureLog[],
    conversionData: ConversionData[]
  ): {
    valid: boolean;
    matchedCount: number;
    mismatchedCount: number;
    errors: string[];
  } {
    const errors: string[] = [];
    let matchedCount = 0;
    let mismatchedCount = 0;

    if (exportRows.length !== exposures.length) {
      errors.push(`导出行数(${exportRows.length})与数据条数(${exposures.length})不一致`);
    }

    const exposureMap = new Map(exposures.map(e => [e.exposureId, e]));

    exportRows.forEach((row, index) => {
      const exposure = exposureMap.get(row.exposureId);
      if (!exposure) {
        errors.push(`行${index + 2}: 曝光ID ${row.exposureId} 在原始数据中不存在`);
        mismatchedCount++;
        return;
      }

      if (row.isContaminated !== exposure.isContaminated) {
        errors.push(`行${index + 2}: 污染标记不一致，导出=${row.isContaminated}, 实际=${exposure.isContaminated}`);
        mismatchedCount++;
        return;
      }

      if (row.contaminationType !== exposure.contaminationType) {
        errors.push(`行${index + 2}: 污染类型不一致，导出=${row.contaminationType}, 实际=${exposure.contaminationType}`);
        mismatchedCount++;
        return;
      }

      matchedCount++;
    });

    return {
      valid: errors.length === 0,
      matchedCount,
      mismatchedCount,
      errors
    };
  }
}
