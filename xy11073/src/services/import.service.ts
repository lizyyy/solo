import { v4 as uuidv4 } from 'uuid';
import { EquipmentBooking, ImportResult, BadRecord, ManualReviewRequest } from '../types';
import { ValidationService } from './validation.service';

export class ImportService {
  private validationService: ValidationService;
  private importResults: Map<string, ImportResult> = new Map();

  constructor() {
    this.validationService = new ValidationService();
  }

  importData(rawData: Partial<EquipmentBooking>[], existingBookings: EquipmentBooking[] = []): ImportResult {
    const batchId = uuidv4();
    const normalRecords: EquipmentBooking[] = [];
    const badRecords: BadRecord[] = [];

    this.validationService.setExistingBookings(existingBookings);

    rawData.forEach((rawRecord, index) => {
      const error = this.validationService.validateBooking(rawRecord, index);
      
      if (error) {
        badRecords.push(error);
      } else {
        const completeRecord = this.enrichRecord(rawRecord as EquipmentBooking);
        normalRecords.push(completeRecord);
      }
    });

    const result: ImportResult = {
      导入批次号: batchId,
      导入时间: new Date().toISOString(),
      总记录数: rawData.length,
      正常记录数: normalRecords.length,
      异常记录数: badRecords.length,
      正常记录列表: normalRecords,
      异常记录列表: badRecords
    };

    this.importResults.set(batchId, result);
    return result;
  }

  reviewBadRecord(reviewRequest: ManualReviewRequest): ImportResult | null {
    const result = this.importResults.get(reviewRequest.批次号);
    if (!result) return null;

    const badRecordIndex = result.异常记录列表.findIndex(r => r.行号 === reviewRequest.行号);
    if (badRecordIndex === -1) return null;

    const badRecord = result.异常记录列表[badRecordIndex];
    badRecord.人工备注 = reviewRequest.人工备注;

    if (reviewRequest.是否通过审核 && badRecord.是否允许继续) {
      const completeRecord = this.enrichRecord(badRecord.原始数据 as EquipmentBooking);
      completeRecord.预约备注 += ` | 人工审核备注: ${reviewRequest.人工备注}`;
      
      result.正常记录列表.push(completeRecord);
      result.异常记录列表.splice(badRecordIndex, 1);
      result.正常记录数++;
      result.异常记录数--;
    }

    return result;
  }

  getImportResult(batchId: string): ImportResult | null {
    return this.importResults.get(batchId) || null;
  }

  getAllImportResults(): ImportResult[] {
    return Array.from(this.importResults.values());
  }

  private enrichRecord(record: EquipmentBooking): EquipmentBooking {
    const now = new Date().toISOString();
    return {
      ...record,
      创建时间: record.创建时间 || now,
      更新时间: now,
      患者禁忌情况: record.患者禁忌情况 || '无禁忌',
      器械强度等级: record.器械强度等级 || '中等强度',
      预约备注: record.预约备注 || ''
    };
  }
}
