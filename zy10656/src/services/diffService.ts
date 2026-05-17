import {
  ArrivalStatus,
  ArrivalDiffRecord,
  CreateDiffRecordDto,
  UpdateDiffRecordDto,
  ConflictCheckResult,
  ImportResult,
  ImportError
} from '../types';
import { dataStore } from '../store/dataStore';

class DiffService {
  checkConflict(orderNo: string, isResupplied: boolean = false): ConflictCheckResult {
    const openRecords = dataStore.getOpenRecordsByOrderNo(orderNo);
    
    if (isResupplied && openRecords.length > 0) {
      return {
        hasConflict: true,
        type: 'OPEN_RECORD_EXISTS',
        message: `采购单 ${orderNo} 存在未关闭的差异记录（${openRecords.map(r => r.id).join(', ')}），请先关闭后再创建补发记录`,
        existingRecord: openRecords[0]
      };
    }

    if (!isResupplied && openRecords.length > 0) {
      return {
        hasConflict: true,
        type: 'OPEN_RECORD_EXISTS',
        message: `采购单 ${orderNo} 已存在未关闭的差异记录 ${openRecords[0].id}，若为补发请标记 isResupplied=true 并确保原记录已关闭`,
        existingRecord: openRecords[0]
      };
    }

    return { hasConflict: false, message: '无冲突' };
  }

  createRecord(dto: CreateDiffRecordDto, operator: string = 'system'): ArrivalDiffRecord {
    const conflict = this.checkConflict(dto.orderNo, dto.isResupplied);
    if (conflict.hasConflict) {
      throw new Error(`[RULE_CONFLICT] ${conflict.message}`);
    }

    const diffQuantity = (dto.arrivalQuantity || 0) - (dto.inspectionQuantity || 0);
    
    let status: ArrivalStatus;
    if (dto.arrivalQuantity === 0) {
      status = ArrivalStatus.PENDING_ARRIVAL;
    } else if (diffQuantity !== 0) {
      status = ArrivalStatus.DIFF_PENDING_CONFIRM;
    } else {
      status = ArrivalStatus.CONFIRMED;
    }

    const record = dataStore.createDiffRecord({
      ...dto,
      diffQuantity,
      status,
      remarks: dto.remarks || '',
      isResupplied: dto.isResupplied || false
    });

    dataStore.addHistory({
      recordId: record.id,
      action: '创建差异记录',
      newStatus: status,
      operator,
      remark: `初始状态: ${status}`
    });

    return record;
  }

  updateRecord(id: string, dto: UpdateDiffRecordDto, operator: string = 'system'): ArrivalDiffRecord {
    const record = dataStore.getDiffRecord(id);
    if (!record) {
      throw new Error('[RULE_NOT_FOUND] 记录不存在');
    }

    if (record.status === ArrivalStatus.STOCKED) {
      throw new Error('[RULE_STATUS] 已入库记录不可修改');
    }

    const changedFields: string[] = [];
    const updates: Partial<ArrivalDiffRecord> = {};

    if (dto.arrivalQuantity !== undefined && dto.arrivalQuantity !== record.arrivalQuantity) {
      updates.arrivalQuantity = dto.arrivalQuantity;
      changedFields.push('arrivalQuantity');
    }

    if (dto.inspectionQuantity !== undefined && dto.inspectionQuantity !== record.inspectionQuantity) {
      updates.inspectionQuantity = dto.inspectionQuantity;
      changedFields.push('inspectionQuantity');
    }

    if (changedFields.includes('arrivalQuantity') || changedFields.includes('inspectionQuantity')) {
      const newArrival = updates.arrivalQuantity ?? record.arrivalQuantity;
      const newInspection = updates.inspectionQuantity ?? record.inspectionQuantity;
      updates.diffQuantity = newArrival - newInspection;
      changedFields.push('diffQuantity');

      let newStatus: ArrivalStatus | undefined;
      if (newArrival === 0) {
        newStatus = ArrivalStatus.PENDING_ARRIVAL;
      } else if (updates.diffQuantity !== 0) {
        newStatus = ArrivalStatus.DIFF_PENDING_CONFIRM;
      } else {
        newStatus = ArrivalStatus.CONFIRMED;
      }

      if (newStatus !== record.status && this.isValidStatusTransition(record.status, newStatus)) {
        updates.status = newStatus;
        changedFields.push('status');
      }
    }

    if (dto.diffDescription !== undefined && dto.diffDescription !== record.diffDescription) {
      updates.diffDescription = dto.diffDescription;
      changedFields.push('diffDescription');
    }

    if (dto.remarks !== undefined && dto.remarks !== record.remarks) {
      updates.remarks = dto.remarks;
      changedFields.push('remarks');
    }

    if (dto.status !== undefined && dto.status !== record.status) {
      if (!this.isValidStatusTransition(record.status, dto.status)) {
        throw new Error(`[RULE_TRANSITION] 不允许从 ${record.status} 变更为 ${dto.status}`);
      }
      updates.status = dto.status;
      changedFields.push('status');
    }

    if (changedFields.length === 0) {
      return record;
    }

    const updated = dataStore.updateDiffRecord(id, updates)!;

    dataStore.addHistory({
      recordId: id,
      action: '更新差异记录',
      previousStatus: record.status,
      newStatus: updates.status,
      changedFields,
      operator,
      remark: changedFields.length > 0 ? `变更字段: ${changedFields.join(', ')}` : undefined
    });

    return updated;
  }

  private isValidStatusTransition(from: ArrivalStatus, to: ArrivalStatus): boolean {
    const transitions: Record<ArrivalStatus, ArrivalStatus[]> = {
      [ArrivalStatus.PENDING_ARRIVAL]: [ArrivalStatus.DIFF_PENDING_CONFIRM, ArrivalStatus.CONFIRMED],
      [ArrivalStatus.DIFF_PENDING_CONFIRM]: [ArrivalStatus.CONFIRMED, ArrivalStatus.STOCKED],
      [ArrivalStatus.CONFIRMED]: [ArrivalStatus.STOCKED],
      [ArrivalStatus.STOCKED]: []
    };
    return transitions[from]?.includes(to) || false;
  }

  getRecord(id: string): ArrivalDiffRecord | undefined {
    return dataStore.getDiffRecord(id);
  }

  getAllRecords(): ArrivalDiffRecord[] {
    return dataStore.getAllDiffRecords();
  }

  getHistory(recordId: string) {
    return dataStore.getHistoryByRecordId(recordId);
  }

  validateImportRow(row: Record<string, any>, index: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!row.orderNo) {
      errors.push('[RULE_ORDER_NO] 采购单号不能为空');
    }

    if (row.arrivalQuantity === undefined || row.arrivalQuantity === '') {
      errors.push('[RULE_ARRIVAL] 到货数量不能为空');
    } else if (isNaN(Number(row.arrivalQuantity)) || Number(row.arrivalQuantity) < 0) {
      errors.push('[RULE_ARRIVAL] 到货数量必须为非负数字');
    }

    if (row.inspectionQuantity === undefined || row.inspectionQuantity === '') {
      errors.push('[RULE_INSPECTION] 质检数量不能为空');
    } else if (isNaN(Number(row.inspectionQuantity)) || Number(row.inspectionQuantity) < 0) {
      errors.push('[RULE_INSPECTION] 质检数量必须为非负数字');
    }

    if (!row.diffDescription) {
      errors.push('[RULE_DIFF_DESC] 差异说明不能为空');
    }

    if (!row.supplierId) {
      errors.push('[RULE_SUPPLIER_ID] 供应商ID不能为空');
    }

    if (!row.supplierName) {
      errors.push('[RULE_SUPPLIER_NAME] 供应商名称不能为空');
    }

    if (!row.materialId) {
      errors.push('[RULE_MATERIAL_ID] 物料ID不能为空');
    }

    if (!row.materialName) {
      errors.push('[RULE_MATERIAL_NAME] 物料名称不能为空');
    }

    return { valid: errors.length === 0, errors };
  }

  batchImport(rows: Record<string, any>[], operator: string = 'system'): ImportResult {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    rows.forEach((row, index) => {
      const validation = this.validateImportRow(row, index + 1);
      
      if (!validation.valid) {
        result.failed++;
        result.errors.push({
          row: index + 1,
          data: row,
          errors: validation.errors
        });
        return;
      }

      try {
        this.createRecord({
          orderNo: String(row.orderNo),
          arrivalQuantity: Number(row.arrivalQuantity),
          inspectionQuantity: Number(row.inspectionQuantity),
          diffDescription: String(row.diffDescription),
          supplierId: String(row.supplierId),
          supplierName: String(row.supplierName),
          materialId: String(row.materialId),
          materialName: String(row.materialName),
          unit: String(row.unit || '个'),
          orderQuantity: Number(row.orderQuantity || row.arrivalQuantity || 0),
          remarks: row.remarks ? String(row.remarks) : '',
          isResupplied: Boolean(row.isResupplied || false),
          originalRecordId: row.originalRecordId ? String(row.originalRecordId) : undefined
        }, operator);
        result.success++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({
          row: index + 1,
          data: row,
          errors: [err.message]
        });
      }
    });

    return result;
  }

  exportRecords(records?: ArrivalDiffRecord[]): any[] {
    const data = records || this.getAllRecords();
    return data.map(r => ({
      id: r.id,
      采购单号: r.orderNo,
      供应商: r.supplierName,
      物料名称: r.materialName,
      订购数量: r.orderQuantity,
      到货数量: r.arrivalQuantity,
      质检数量: r.inspectionQuantity,
      差异数量: r.diffQuantity,
      差异说明: r.diffDescription,
      状态: r.status,
      备注: r.remarks,
      是否补发: r.isResupplied ? '是' : '否',
      创建时间: r.createdAt.toISOString(),
      更新时间: r.updatedAt.toISOString()
    }));
  }
}

export const diffService = new DiffService();
