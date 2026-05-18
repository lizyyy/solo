import {
  DetentionFeeRecord,
  DetentionFeeStatus,
  DetentionReason,
  ImportRowResult,
  ImportRequest,
  ImportResponse,
  STATUS_TRANSITION_RULES,
  REQUIRED_FIELDS
} from '../types/detention-fee';
import { storageService } from './storage.service';

class ImportService {
  validateRequiredFields(data: Record<string, any>): { missing: string[]; invalid: string[] } {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        missing.push(field);
      }
    }

    if (data.detentionDays !== undefined && (typeof data.detentionDays !== 'number' || data.detentionDays < 0)) {
      invalid.push('detentionDays必须为非负数');
    }
    if (data.freeDays !== undefined && (typeof data.freeDays !== 'number' || data.freeDays < 0)) {
      invalid.push('freeDays必须为非负数');
    }
    if (data.billableDays !== undefined && (typeof data.billableDays !== 'number' || data.billableDays < 0)) {
      invalid.push('billableDays必须为非负数');
    }
    if (data.dailyRate !== undefined && (typeof data.dailyRate !== 'number' || data.dailyRate <= 0)) {
      invalid.push('dailyRate必须为正数');
    }
    if (data.totalAmount !== undefined && (typeof data.totalAmount !== 'number' || data.totalAmount <= 0)) {
      invalid.push('totalAmount必须为正数');
    }

    return { missing, invalid };
  }

  checkDuplicate(data: Record<string, any>): boolean {
    return storageService.exists({
      billOfLadingNo: data.billOfLadingNo,
      containerNo: data.containerNo,
      portCode: data.portCode
    });
  }

  checkStatusTransition(currentStatus: DetentionFeeStatus | undefined, targetStatus: DetentionFeeStatus): boolean {
    if (!currentStatus) {
      return targetStatus === DetentionFeeStatus.IMPORTED;
    }
    const allowedTransitions = STATUS_TRANSITION_RULES[currentStatus];
    return allowedTransitions.includes(targetStatus);
  }

  isJointReasonCase(data: Record<string, any>): boolean {
    const reasons = data.detentionReasons || [];
    return (
      reasons.includes(DetentionReason.CUSTOMS_INSPECTION) &&
      reasons.includes(DetentionReason.CUSTOMER_DELAY)
    ) || (data.isCustomsInspection && data.isCustomerDelay);
  }

  getSuggestion(errorCode: string, data: Record<string, any>): string {
    switch (errorCode) {
      case 'MISSING_FIELDS':
        return '请补充完整必填字段后重新提交';
      case 'INVALID_FIELD_VALUES':
        return '请检查数字字段是否为有效值（非负数/正数）后重新提交';
      case 'DUPLICATE_RECORD':
        return '该提单+箱号+口岸组合已存在，请核实是否为重复导入，如需更新请走变更流程';
      case 'STATUS_TRANSITION_INVALID':
        return '状态跳转不符合业务流程规则，请按顺序逐级推进';
      case 'JOINT_REASON_REQUIRES_REMARK':
        return '海关查验与客户延迟共同导致滞箱，需添加人工备注说明费用明细一致性后继续推进';
      default:
        return '请检查数据格式后重新提交，或联系系统管理员';
    }
  }

  parseRecord(data: Record<string, any>, operatorId: string, operatorName: string): DetentionFeeRecord {
    const now = new Date().toISOString();
    return {
      billOfLadingNo: String(data.billOfLadingNo || ''),
      containerNo: String(data.containerNo || ''),
      vesselVoyage: String(data.vesselVoyage || ''),
      portCode: String(data.portCode || ''),
      portName: String(data.portName || ''),
      storageAgentCode: String(data.storageAgentCode || ''),
      storageAgentName: String(data.storageAgentName || ''),
      customerCode: String(data.customerCode || ''),
      customerName: String(data.customerName || ''),
      entryDate: String(data.entryDate || ''),
      exitDate: String(data.exitDate || ''),
      detentionDays: Number(data.detentionDays || 0),
      freeDays: Number(data.freeDays || 0),
      billableDays: Number(data.billableDays || 0),
      currency: String(data.currency || 'CNY'),
      dailyRate: Number(data.dailyRate || 0),
      totalAmount: Number(data.totalAmount || 0),
      detentionReasons: Array.isArray(data.detentionReasons) ? data.detentionReasons : [],
      reasonDescription: String(data.reasonDescription || ''),
      status: data.status || DetentionFeeStatus.IMPORTED,
      isCustomsInspection: Boolean(data.isCustomsInspection),
      isCustomerDelay: Boolean(data.isCustomerDelay),
      requiresManualRemark: this.isJointReasonCase(data),
      manualRemark: data.manualRemark,
      enteredBy: operatorId,
      enteredAt: now,
      createdAt: now,
      updatedAt: now
    };
  }

  processRow(data: Record<string, any>, rowIndex: number, operatorId: string, operatorName: string): ImportRowResult {
    const originalData = { ...data };

    const { missing, invalid } = this.validateRequiredFields(data);
    if (missing.length > 0) {
      return {
        success: false,
        rowIndex,
        originalData,
        errorCode: 'MISSING_FIELDS',
        errorMessage: `缺少必填字段: ${missing.join(', ')}`,
        suggestion: this.getSuggestion('MISSING_FIELDS', data)
      };
    }

    if (invalid.length > 0) {
      return {
        success: false,
        rowIndex,
        originalData,
        errorCode: 'INVALID_FIELD_VALUES',
        errorMessage: `字段值无效: ${invalid.join('; ')}`,
        suggestion: this.getSuggestion('INVALID_FIELD_VALUES', data)
      };
    }

    if (this.checkDuplicate(data)) {
      return {
        success: false,
        rowIndex,
        originalData,
        errorCode: 'DUPLICATE_RECORD',
        errorMessage: '该提单号+箱号+口岸组合的记录已存在，请勿重复导入',
        suggestion: this.getSuggestion('DUPLICATE_RECORD', data)
      };
    }

    if (data.status) {
      const existingRecord = storageService.findByBillOfLadingAndContainer(
        data.billOfLadingNo,
        data.containerNo,
        data.portCode
      );
      const currentStatus = existingRecord?.status;
      if (!this.checkStatusTransition(currentStatus, data.status)) {
        return {
          success: false,
          rowIndex,
          originalData,
          errorCode: 'STATUS_TRANSITION_INVALID',
          errorMessage: `状态从 ${currentStatus || '不存在'} 跳转到 ${data.status} 不符合流程规则`,
          suggestion: this.getSuggestion('STATUS_TRANSITION_INVALID', data)
        };
      }
    }

    const isJointCase = this.isJointReasonCase(data);
    if (isJointCase && !data.manualRemark) {
      const record = this.parseRecord(data, operatorId, operatorName);
      return {
        success: false,
        rowIndex,
        originalData,
        record,
        errorCode: 'JOINT_REASON_REQUIRES_REMARK',
        errorMessage: '海关查验与客户延迟共同导致滞箱，需添加人工备注',
        suggestion: this.getSuggestion('JOINT_REASON_REQUIRES_REMARK', data)
      };
    }

    const record = this.parseRecord(data, operatorId, operatorName);
    const savedRecord = storageService.save(record);

    return {
      success: true,
      rowIndex,
      originalData,
      record: savedRecord
    };
  }

  import(request: ImportRequest): ImportResponse {
    const results: ImportRowResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    const requiresManualReviewResults: ImportRowResult[] = [];

    for (let i = 0; i < request.records.length; i++) {
      const result = this.processRow(request.records[i], i, request.operatorId, request.operatorName);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
        if (result.errorCode === 'JOINT_REASON_REQUIRES_REMARK') {
          requiresManualReviewResults.push(result);
        }
      }
    }

    return {
      success: failedCount === 0,
      totalCount: request.records.length,
      successCount,
      failedCount,
      results,
      requiresManualReviewCount: requiresManualReviewResults.length,
      requiresManualReviewResults
    };
  }
}

export const importService = new ImportService();
