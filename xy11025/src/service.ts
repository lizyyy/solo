import { v4 as uuidv4 } from 'uuid';
import {
  ReturnBucketRecord,
  ReturnBucketCreateRequest,
  ReturnBucketStatus,
  MaterialType,
  ValidationResult,
  ExportQueryParams
} from './types';
import { returnBucketStore } from './store';

class ReturnBucketService {
  private createRecordFromRequest(
    req: ReturnBucketCreateRequest,
    status: ReturnBucketStatus = ReturnBucketStatus.NORMAL
  ): ReturnBucketRecord {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      ...req,
      receiverId: '',
      receiverName: '',
      status,
      supplementMaterials: [],
      ledgerConsistent: true,
      createTime: now,
      updateTime: now
    };
  }

  private checkDuplicateBucket(
    bucketNumber: string,
    customerAddress: string
  ): { hasDuplicate: boolean; existingAddress?: string } {
    const activeStatuses = [
      ReturnBucketStatus.NORMAL,
      ReturnBucketStatus.SUPPLEMENT,
      ReturnBucketStatus.COMPLETED
    ];
    const existingRecords = returnBucketStore.findByBucketNumberAndStatus(
      bucketNumber,
      activeStatuses
    );

    for (const record of existingRecords) {
      if (record.customerAddress !== customerAddress) {
        return {
          hasDuplicate: true,
          existingAddress: record.customerAddress + ' ' + record.customerAddressDetail
        };
      }
    }
    return { hasDuplicate: false };
  }

  private checkLedgerConsistency(record: ReturnBucketCreateRequest): {
    consistent: boolean;
    reason?: string;
  } {
    const inconsistentReasons: string[] = [];

    if (!record.bucketNumber || record.bucketNumber.length < 5) {
      inconsistentReasons.push('桶编号格式不规范');
    }
    if (!record.returnDate || isNaN(Date.parse(record.returnDate))) {
      inconsistentReasons.push('退桶日期无效');
    }
    if (record.returnQuantity <= 0 || record.returnQuantity > 100) {
      inconsistentReasons.push('退桶数量异常');
    }
    if (!record.driverName || !record.driverPhone) {
      inconsistentReasons.push('配送员信息不完整');
    }
    if (!record.customerName || !record.customerPhone) {
      inconsistentReasons.push('客户信息不完整');
    }

    return {
      consistent: inconsistentReasons.length === 0,
      reason: inconsistentReasons.length > 0 ? inconsistentReasons.join('; ') : undefined
    };
  }

  private determineRequiredMaterials(
    hasDuplicate: boolean,
    ledgerConsistent: boolean,
    hasDamage: boolean
  ): MaterialType[] {
    const materials: MaterialType[] = [];

    if (hasDuplicate) {
      materials.push(MaterialType.TRANSFER_RECORD);
      materials.push(MaterialType.DRIVER_CONFIRMATION);
      materials.push(MaterialType.SITE_VERIFICATION);
    }

    if (!ledgerConsistent) {
      materials.push(MaterialType.CUSTOMER_SIGNATURE);
      materials.push(MaterialType.PHOTO_PROOF);
    }

    if (hasDamage) {
      materials.push(MaterialType.DAMAGE_REPORT);
      materials.push(MaterialType.PHOTO_PROOF);
    }

    return [...new Set(materials)];
  }

  validateRecord(record: ReturnBucketCreateRequest): ValidationResult {
    const duplicateCheck = this.checkDuplicateBucket(
      record.bucketNumber,
      record.customerAddress
    );
    const ledgerCheck = this.checkLedgerConsistency(record);
    const requiredMaterials = this.determineRequiredMaterials(
      duplicateCheck.hasDuplicate,
      ledgerCheck.consistent,
      record.hasDamage
    );

    const messages: string[] = [];
    if (duplicateCheck.hasDuplicate) {
      messages.push(`桶编号 ${record.bucketNumber} 已在其他地址登记`);
    }
    if (!ledgerCheck.consistent) {
      messages.push(`台账不一致: ${ledgerCheck.reason}`);
    }
    if (requiredMaterials.length > 0) {
      messages.push(`需要补充材料: ${requiredMaterials.join(', ')}`);
    }

    const valid = !duplicateCheck.hasDuplicate && ledgerCheck.consistent && requiredMaterials.length === 0;

    return {
      valid,
      hasDuplicateBucket: duplicateCheck.hasDuplicate,
      duplicateBucketInfo: duplicateCheck.hasDuplicate ? {
        bucketNumber: record.bucketNumber,
        existingAddress: duplicateCheck.existingAddress!,
        newAddress: record.customerAddress + ' ' + record.customerAddressDetail
      } : undefined,
      ledgerConsistent: ledgerCheck.consistent,
      ledgerInconsistencyReason: ledgerCheck.reason,
      requiredMaterials,
      message: messages.length > 0 ? messages.join(' | ') : '校验通过'
    };
  }

  createSingleRecord(req: ReturnBucketCreateRequest): {
    record: ReturnBucketRecord;
    validation: ValidationResult;
  } {
    const validation = this.validateRecord(req);

    let status: ReturnBucketStatus;
    if (!validation.valid) {
      if (validation.hasDuplicateBucket || !validation.ledgerConsistent) {
        status = ReturnBucketStatus.SUPPLEMENT;
      } else {
        status = ReturnBucketStatus.REJECTED;
      }
    } else {
      status = ReturnBucketStatus.NORMAL;
    }

    const record = this.createRecordFromRequest(req, status);
    record.supplementMaterials = validation.requiredMaterials;
    record.ledgerConsistent = validation.ledgerConsistent;
    record.ledgerInconsistencyReason = validation.ledgerInconsistencyReason;
    record.duplicateBucketAddress = validation.duplicateBucketInfo?.existingAddress;

    returnBucketStore.add(record);
    return { record, validation };
  }

  batchCreateRecords(
    records: ReturnBucketCreateRequest[],
    batchNo: string
  ): {
    successful: ReturnBucketRecord[];
    failed: Array<{ record: ReturnBucketCreateRequest; reason: string; validation: ValidationResult }>;
    validationResults: ValidationResult[];
  } {
    const successful: ReturnBucketRecord[] = [];
    const failed: Array<{ record: ReturnBucketCreateRequest; reason: string; validation: ValidationResult }> = [];
    const validationResults: ValidationResult[] = [];

    for (const req of records) {
      try {
        const result = this.createSingleRecord(req);
        validationResults.push(result.validation);
        if (result.validation.valid) {
          successful.push(result.record);
        } else {
          failed.push({
            record: req,
            reason: result.validation.message,
            validation: result.validation
          });
        }
      } catch (error: any) {
        failed.push({
          record: req,
          reason: error.message,
          validation: {
            valid: false,
            hasDuplicateBucket: false,
            ledgerConsistent: true,
            requiredMaterials: [],
            message: error.message
          }
        });
      }
    }

    return { successful, failed, validationResults };
  }

  updateRecordStatus(
    id: string,
    status: ReturnBucketStatus,
    operatorId: string,
    operatorName: string,
    rejectReason?: string,
    supplementRemark?: string
  ): ReturnBucketRecord | undefined {
    const updateData: Partial<ReturnBucketRecord> = {
      status,
      operatorId,
      operatorName,
      rejectReason,
      supplementRemark
    };

    if (status === ReturnBucketStatus.COMPLETED) {
      updateData.receiveDate = new Date().toISOString();
    }

    return returnBucketStore.update(id, updateData);
  }

  getRecord(id: string): ReturnBucketRecord | undefined {
    return returnBucketStore.get(id);
  }

  getAllRecords(): ReturnBucketRecord[] {
    return returnBucketStore.getAll();
  }

  getRecordsForExport(params: ExportQueryParams): ReturnBucketRecord[] {
    let records = this.getAllRecords();

    if (params.waterStationId) {
      records = records.filter(r => r.waterStationId === params.waterStationId);
    }
    if (params.deliveryTeamId) {
      records = records.filter(r => r.deliveryTeamId === params.deliveryTeamId);
    }
    if (params.startDate) {
      records = records.filter(r => r.returnDate >= params.startDate!);
    }
    if (params.endDate) {
      records = records.filter(r => r.returnDate <= params.endDate!);
    }
    if (params.status) {
      records = records.filter(r => r.status === params.status);
    }

    return records;
  }
}

export const returnBucketService = new ReturnBucketService();
