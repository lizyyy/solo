import type { InspectionRecord } from '../../shared/types';
import { RecordStatus, RecordType } from '../../shared/types';
import { createInitialRecords } from './mockData';
import { CalculationService } from './CalculationService';
import { AuditLogger } from './AuditLogger';

export class ImportService {
  static async importPhotoNumbers(
    photoNos: string[]
  ): Promise<InspectionRecord[]> {
    const baseRecords = createInitialRecords();
    const records: InspectionRecord[] = [];

    for (const [index, photoNo] of photoNos.entries()) {
      const record = baseRecords[index];
      if (!record) continue;

      await new Promise((r) => setTimeout(r, 300));

      record.photoNo = photoNo;
      record.updatedAt = new Date().toISOString();

      AuditLogger.log({
        recordId: record.id,
        operator: '系统导入',
        action: 'import',
        fieldName: 'photoNo',
        oldValue: '',
        newValue: photoNo,
        remark: `导入巡检照片编号: ${photoNo}`,
      });

      const length = CalculationService.calculateRouteLength(record);
      record.originalLength = length;
      record.routeLength = length;

      if (record.recordType === RecordType.SUPPLEMENT_NO_RECALC) {
        record.status = RecordStatus.PENDING_REVIEW;
        record.lengthRecalculated = false;
        AuditLogger.log({
          recordId: record.id,
          operator: '系统标记',
          action: 'calculate',
          remark: '此记录为补录路线，未重新计算长度，标记为待复核',
        });
      } else {
        record.status = RecordStatus.NORMAL;
        record.lengthRecalculated = true;
      }

      records.push(record);
    }

    return records;
  }

  static validatePhotoNo(photoNo: string): boolean {
    const pattern = /^PHOTO-\d{4}-\d{3}$/;
    return pattern.test(photoNo);
  }

  static validateCadLayerName(name: string): boolean {
    const pattern = /^LAYER-[A-Z]+-[A-Z](-OLD)?$/;
    return pattern.test(name);
  }
}
