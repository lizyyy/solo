import type { InspectionRecord } from '../../shared/types';
import { RecordStatus, RecordType } from '../../shared/types';
import { CalculationService } from './CalculationService';
import { AuditLogger } from './AuditLogger';

export class CadService {
  static updateCadLayerName(
    record: InspectionRecord,
    cadLayerName: string,
    operator: string = '老梁'
  ): InspectionRecord {
    const oldValue = record.cadLayerName;
    record.cadLayerName = cadLayerName;
    record.updatedAt = new Date().toISOString();

    if (record.recordType === RecordType.SUPPLEMENT_NO_RECALC) {
      record.lengthRecalculated = false;
      AuditLogger.log({
        recordId: record.id,
        operator,
        action: 'cad_update',
        fieldName: 'cadLayerName',
        oldValue,
        newValue: cadLayerName,
        remark: `培训教官${operator}补录CAD图层名，补录路线未重算，保持待复核状态`,
      });
    } else if (record.recordType === RecordType.OLD_CALIBER_FILL) {
      if (cadLayerName.includes('-OLD')) {
        record.caliber = '2023版旧口径';
        record.status = RecordStatus.OLD_CALIBER;
        CalculationService.recalculateWithOldCaliber(record);
        record.hasRerun = true;
        AuditLogger.log({
          recordId: record.id,
          operator: '系统触发',
          action: 'rerun',
          remark: '检测到CAD图层名包含-OLD，自动回填旧口径数据并重跑计算',
        });
      } else {
        record.status = RecordStatus.NORMAL;
        record.lengthRecalculated = true;
      }
      AuditLogger.log({
        recordId: record.id,
        operator,
        action: 'cad_update',
        fieldName: 'cadLayerName',
        oldValue,
        newValue: cadLayerName,
        remark: `培训教官${operator}补录CAD图层名`,
      });
    } else {
      record.status = RecordStatus.NORMAL;
      record.lengthRecalculated = true;
      AuditLogger.log({
        recordId: record.id,
        operator,
        action: 'cad_update',
        fieldName: 'cadLayerName',
        oldValue,
        newValue: cadLayerName,
        remark: `培训教官${operator}补录CAD图层名`,
      });
    }

    return record;
  }

  static detectOldCaliber(cadLayerName: string): boolean {
    return cadLayerName.includes('-OLD');
  }

  static extractCaliberFromCadName(cadLayerName: string): string {
    if (cadLayerName.includes('-OLD')) {
      return '2023版旧口径';
    }
    return '2026版新口径';
  }

  static generateExportFileName(
    records: InspectionRecord[],
    timestamp?: string
  ): string {
    const ts = timestamp || new Date().toISOString().slice(0, 10);
    const cadNames = records
      .map((r) => r.cadLayerName || 'NO-CAD')
      .join('_');
    return `充电站车流模拟_${ts}_${cadNames}.png`;
  }
}
