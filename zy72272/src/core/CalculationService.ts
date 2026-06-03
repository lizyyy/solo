import type { InspectionRecord } from '../../shared/types';
import { RecordType } from '../../shared/types';
import { AuditLogger } from './AuditLogger';

export class CalculationService {
  static calculateRouteLength(record: InspectionRecord): number {
    const baseLengths: Record<string, number> = {
      'REC-001': 1250.5,
      'REC-002': 980.3,
      'REC-003': 1560.8,
    };

    const base = baseLengths[record.id] || 1000;
    const randomVariation = Math.random() * 50 - 25;
    const length = Math.round((base + randomVariation) * 100) / 100;

    AuditLogger.log({
      recordId: record.id,
      operator: '系统计算',
      action: 'calculate',
      fieldName: 'routeLength',
      oldValue: record.routeLength?.toString() || 'null',
      newValue: length.toString(),
      remark: `自动计算路线长度，口径：${record.caliber}`,
    });

    return length;
  }

  static recalculateWithOldCaliber(record: InspectionRecord): number {
    const oldCaliberMultiplier = 1.05;
    const original = this.calculateRouteLength(record);
    const recalculated = Math.round(original * oldCaliberMultiplier * 100) / 100;

    AuditLogger.log({
      recordId: record.id,
      operator: '系统重跑',
      action: 'rerun',
      fieldName: 'routeLength',
      oldValue: original.toString(),
      newValue: recalculated.toString(),
      remark: `使用2023版旧口径重算路线长度，系数：${oldCaliberMultiplier}`,
    });

    record.routeLength = recalculated;
    record.lengthRecalculated = true;
    record.updatedAt = new Date().toISOString();

    return recalculated;
  }

  static manualCorrect(
    record: InspectionRecord,
    correctedLength: number,
    operator: string = '老梁'
  ): number {
    const oldValue = record.routeLength?.toString() || 'null';
    record.correctedLength = correctedLength;
    record.routeLength = correctedLength;
    record.hasManualCorrection = true;
    record.updatedAt = new Date().toISOString();

    AuditLogger.log({
      recordId: record.id,
      operator,
      action: 'manual_correct',
      fieldName: 'correctedLength',
      oldValue,
      newValue: correctedLength.toString(),
      remark: `培训教官${operator}人工修正路线长度`,
    });

    return correctedLength;
  }

  static forceRecalculate(
    record: InspectionRecord,
    operator: string = '老梁'
  ): number {
    const oldValue = record.routeLength?.toString() || 'null';
    const newLength = this.calculateRouteLength(record);

    record.routeLength = newLength;
    record.lengthRecalculated = true;
    record.hasRerun = true;
    record.updatedAt = new Date().toISOString();

    AuditLogger.log({
      recordId: record.id,
      operator,
      action: 'rerun',
      fieldName: 'routeLength',
      oldValue,
      newValue: newLength.toString(),
      remark: `${operator}手动触发重跑计算`,
    });

    return newLength;
  }

  static isSupplementaryRecord(record: InspectionRecord): boolean {
    return record.recordType === RecordType.SUPPLEMENT_NO_RECALC;
  }

  static isOldCaliberRecord(record: InspectionRecord): boolean {
    return record.recordType === RecordType.OLD_CALIBER_FILL;
  }
}
