import { PreparationDAO } from '../database/dao';
import { DataValidator } from './validator';
import {
  InspectionOrder,
  RepairQuote,
  PhotoInventory,
  PreparationStatus,
  RecordSource,
  UserRole,
  AuditLog,
  FieldChange,
  ValidationError,
  PreparationLedger,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class PreparationService {
  private dao: PreparationDAO;

  constructor(dao: PreparationDAO) {
    this.dao = dao;
  }

  private calculateFieldChanges(oldObj: any, newObj: any, sensitiveFields: Set<string>): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    
    for (const key of allKeys) {
      if (['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'source'].includes(key)) {
        continue;
      }
      
      const oldVal = oldObj?.[key];
      const newVal = newObj?.[key];
      
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field: key,
          oldValue: oldVal,
          newValue: newVal,
          isSensitive: sensitiveFields.has(key)
        });
      }
    }
    
    return changes;
  }

  private async recordAuditLog(
    requestId: string,
    source: RecordSource,
    action: string,
    oldStatus: PreparationStatus | undefined,
    newStatus: PreparationStatus,
    operatorId: string,
    operatorName: string,
    operatorRole: UserRole,
    changeReason: string,
    fieldChanges?: FieldChange[],
    ipAddress?: string
  ): Promise<AuditLog> {
    return this.dao.createAuditLog({
      requestId,
      source,
      action,
      oldStatus,
      newStatus,
      operatorId,
      operatorName,
      operatorRole,
      changeReason,
      fieldChanges,
      timestamp: Date.now(),
      ipAddress
    });
  }

  async submitInspectionOrder(
    data: Omit<InspectionOrder, 'id' | 'createdAt' | 'updatedAt' | 'source'>,
    operator: { id: string; name: string; role: UserRole },
    changeReason: string = '提交检测单',
    ipAddress?: string
  ): Promise<{
    success: boolean;
    data?: InspectionOrder;
    errors?: ValidationError[];
    isUpdate: boolean;
  }> {
    const validation = DataValidator.validateInspectionOrder(data);
    if (!validation.valid) {
      await this.dao.createFailedRecord({
        requestId: data.requestId,
        source: RecordSource.INSPECTION,
        rawData: JSON.stringify(data),
        errorType: 'validation',
        errorMessage: '数据验证失败',
        validationErrors: validation.errors,
        receivedAt: Date.now(),
        operatorId: operator.id,
        resolved: false
      });
      
      return { success: false, errors: validation.errors, isUpdate: false };
    }

    const existing = await this.dao.getInspectionOrderByRequestId(data.requestId);
    
    if (existing) {
      const statusCheck = DataValidator.validateStatusTransition(existing.status, data.status);
      if (!statusCheck.valid) {
        return {
          success: false,
          errors: [{ field: 'status', message: statusCheck.message!, rule: 'status.transition' }],
          isUpdate: true
        };
      }
    }

    const sensitiveFields = new Set(['inspectorName', 'remarks']);
    const fieldChanges = existing
      ? this.calculateFieldChanges(existing, data, sensitiveFields)
      : [];

    const orderData = {
      ...data,
      source: RecordSource.INSPECTION as const,
      createdBy: existing?.createdBy || operator.id,
      updatedBy: operator.id
    };

    const result = await this.dao.upsertInspectionOrder(orderData);

    await this.recordAuditLog(
      data.requestId,
      RecordSource.INSPECTION,
      existing ? 'update' : 'create',
      existing?.status,
      data.status,
      operator.id,
      operator.name,
      operator.role,
      changeReason,
      fieldChanges.length > 0 ? fieldChanges : undefined,
      ipAddress
    );

    return { success: true, data: result, isUpdate: !!existing };
  }

  async submitRepairQuote(
    data: Omit<RepairQuote, 'id' | 'createdAt' | 'updatedAt' | 'source'>,
    operator: { id: string; name: string; role: UserRole },
    changeReason: string = '提交维修报价',
    ipAddress?: string
  ): Promise<{
    success: boolean;
    data?: RepairQuote;
    errors?: ValidationError[];
    isUpdate: boolean;
  }> {
    const validation = DataValidator.validateRepairQuote(data);
    if (!validation.valid) {
      await this.dao.createFailedRecord({
        requestId: data.requestId,
        source: RecordSource.REPAIR_QUOTE,
        rawData: JSON.stringify(data),
        errorType: 'validation',
        errorMessage: '数据验证失败',
        validationErrors: validation.errors,
        receivedAt: Date.now(),
        operatorId: operator.id,
        resolved: false
      });
      
      return { success: false, errors: validation.errors, isUpdate: false };
    }

    const existing = await this.dao.getRepairQuoteByRequestId(data.requestId);
    
    if (existing) {
      const statusCheck = DataValidator.validateStatusTransition(existing.status, data.status);
      if (!statusCheck.valid) {
        return {
          success: false,
          errors: [{ field: 'status', message: statusCheck.message!, rule: 'status.transition' }],
          isUpdate: true
        };
      }
    }

    const sensitiveFields = new Set(['quoteManager', 'repairShop', 'remarks']);
    const fieldChanges = existing
      ? this.calculateFieldChanges(existing, data, sensitiveFields)
      : [];

    const quoteData = {
      ...data,
      source: RecordSource.REPAIR_QUOTE as const,
      createdBy: existing?.createdBy || operator.id,
      updatedBy: operator.id
    };

    const result = await this.dao.upsertRepairQuote(quoteData);

    await this.recordAuditLog(
      data.requestId,
      RecordSource.REPAIR_QUOTE,
      existing ? 'update' : 'create',
      existing?.status,
      data.status,
      operator.id,
      operator.name,
      operator.role,
      changeReason,
      fieldChanges.length > 0 ? fieldChanges : undefined,
      ipAddress
    );

    return { success: true, data: result, isUpdate: !!existing };
  }

  async submitPhotoInventory(
    data: Omit<PhotoInventory, 'id' | 'createdAt' | 'updatedAt' | 'source'>,
    operator: { id: string; name: string; role: UserRole },
    changeReason: string = '提交照片清单',
    ipAddress?: string
  ): Promise<{
    success: boolean;
    data?: PhotoInventory;
    errors?: ValidationError[];
    isUpdate: boolean;
  }> {
    const validation = DataValidator.validatePhotoInventory(data);
    if (!validation.valid) {
      await this.dao.createFailedRecord({
        requestId: data.requestId,
        source: RecordSource.PHOTO,
        rawData: JSON.stringify(data),
        errorType: 'validation',
        errorMessage: '数据验证失败',
        validationErrors: validation.errors,
        receivedAt: Date.now(),
        operatorId: operator.id,
        resolved: false
      });
      
      return { success: false, errors: validation.errors, isUpdate: false };
    }

    const existing = await this.dao.getPhotoInventoryByRequestId(data.requestId);
    
    if (existing) {
      const statusCheck = DataValidator.validateStatusTransition(existing.status, data.status);
      if (!statusCheck.valid) {
        return {
          success: false,
          errors: [{ field: 'status', message: statusCheck.message!, rule: 'status.transition' }],
          isUpdate: true
        };
      }
    }

    const sensitiveFields = new Set(['uploader', 'remarks']);
    const fieldChanges = existing
      ? this.calculateFieldChanges(existing, data, sensitiveFields)
      : [];

    const inventoryData = {
      ...data,
      source: RecordSource.PHOTO as const,
      createdBy: existing?.createdBy || operator.id,
      updatedBy: operator.id
    };

    const result = await this.dao.upsertPhotoInventory(inventoryData);

    await this.recordAuditLog(
      data.requestId,
      RecordSource.PHOTO,
      existing ? 'update' : 'create',
      existing?.status,
      data.status,
      operator.id,
      operator.name,
      operator.role,
      changeReason,
      fieldChanges.length > 0 ? fieldChanges : undefined,
      ipAddress
    );

    return { success: true, data: result, isUpdate: !!existing };
  }

  async getLedgerByRequestId(requestId: string): Promise<PreparationLedger | null> {
    const [inspection, repair, photo, auditLogs] = await Promise.all([
      this.dao.getInspectionOrderByRequestId(requestId),
      this.dao.getRepairQuoteByRequestId(requestId),
      this.dao.getPhotoInventoryByRequestId(requestId),
      this.dao.getAuditLogsByRequestId(requestId)
    ]);

    if (!inspection && !repair && !photo) {
      return null;
    }

    const allRecords = [inspection, repair, photo].filter(Boolean);
    const latestRecord = allRecords.sort((a, b) => b!.updatedAt - a!.updatedAt)[0]!;

    return {
      requestId,
      vin: latestRecord.vin,
      plateNumber: latestRecord.plateNumber,
      brand: (inspection || repair)?.brand || '',
      model: (inspection || repair)?.model || '',
      inspectionOrder: inspection || undefined,
      repairQuote: repair || undefined,
      photoInventory: photo || undefined,
      currentStatus: latestRecord.status,
      totalInspectionCost: inspection?.totalCost || 0,
      totalRepairCost: repair?.totalCost || 0,
      photoCount: photo?.photos.length || 0,
      responsiblePerson: latestRecord.updatedBy,
      lastUpdated: latestRecord.updatedAt,
      auditTrail: auditLogs
    };
  }

  async getLedgers(
    params: PaginationParams & { status?: PreparationStatus; vin?: string }
  ): Promise<PaginatedResponse<PreparationLedger>> {
    const [inspections, repairs, photos] = await Promise.all([
      this.dao.getInspectionOrders({ ...params, pageSize: 1000 }),
      this.dao.getRepairQuotes({ ...params, pageSize: 1000 }),
      this.dao.getPhotoInventories({ ...params, pageSize: 1000 })
    ]);

    const requestIdMap = new Map<string, {
      inspection?: InspectionOrder;
      repair?: RepairQuote;
      photo?: PhotoInventory;
      latestUpdate: number;
    }>();

    for (const item of inspections.items) {
      const existing = requestIdMap.get(item.requestId) || { latestUpdate: 0 };
      existing.inspection = item;
      existing.latestUpdate = Math.max(existing.latestUpdate, item.updatedAt);
      requestIdMap.set(item.requestId, existing);
    }

    for (const item of repairs.items) {
      const existing = requestIdMap.get(item.requestId) || { latestUpdate: 0 };
      existing.repair = item;
      existing.latestUpdate = Math.max(existing.latestUpdate, item.updatedAt);
      requestIdMap.set(item.requestId, existing);
    }

    for (const item of photos.items) {
      const existing = requestIdMap.get(item.requestId) || { latestUpdate: 0 };
      existing.photo = item;
      existing.latestUpdate = Math.max(existing.latestUpdate, item.updatedAt);
      requestIdMap.set(item.requestId, existing);
    }

    const ledgers = Array.from(requestIdMap.entries())
      .map(([requestId, data]) => {
        const latest = [data.inspection, data.repair, data.photo]
          .filter(Boolean)
          .sort((a, b) => b!.updatedAt - a!.updatedAt)[0]!;

        return {
          requestId,
          vin: latest.vin,
          plateNumber: latest.plateNumber,
          brand: (data.inspection || data.repair)?.brand || '',
          model: (data.inspection || data.repair)?.model || '',
          inspectionOrder: data.inspection,
          repairQuote: data.repair,
          photoInventory: data.photo,
          currentStatus: latest.status,
          totalInspectionCost: data.inspection?.totalCost || 0,
          totalRepairCost: data.repair?.totalCost || 0,
          photoCount: data.photo?.photos.length || 0,
          responsiblePerson: latest.updatedBy,
          lastUpdated: data.latestUpdate,
          auditTrail: []
        } as PreparationLedger;
      })
      .sort((a, b) => b.lastUpdated - a.lastUpdated);

    const total = ledgers.length;
    const offset = (params.page - 1) * params.pageSize;
    const paginatedItems = ledgers.slice(offset, offset + params.pageSize);

    return {
      items: paginatedItems,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize)
    };
  }

  async changeStatus(
    requestId: string,
    source: RecordSource,
    newStatus: PreparationStatus,
    operator: { id: string; name: string; role: UserRole },
    changeReason: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message?: string }> {
    let existing: InspectionOrder | RepairQuote | PhotoInventory | undefined;
    
    switch (source) {
      case RecordSource.INSPECTION:
        existing = await this.dao.getInspectionOrderByRequestId(requestId);
        break;
      case RecordSource.REPAIR_QUOTE:
        existing = await this.dao.getRepairQuoteByRequestId(requestId);
        break;
      case RecordSource.PHOTO:
        existing = await this.dao.getPhotoInventoryByRequestId(requestId);
        break;
    }

    if (!existing) {
      return { success: false, message: '记录不存在' };
    }

    const statusCheck = DataValidator.validateStatusTransition(existing.status, newStatus);
    if (!statusCheck.valid) {
      return { success: false, message: statusCheck.message };
    }

    const updatedRecord = {
      ...existing,
      status: newStatus,
      updatedBy: operator.id
    };

    switch (source) {
      case RecordSource.INSPECTION:
        await this.dao.upsertInspectionOrder(updatedRecord as any);
        break;
      case RecordSource.REPAIR_QUOTE:
        await this.dao.upsertRepairQuote(updatedRecord as any);
        break;
      case RecordSource.PHOTO:
        await this.dao.upsertPhotoInventory(updatedRecord as any);
        break;
    }

    await this.recordAuditLog(
      requestId,
      source,
      'status_change',
      existing.status,
      newStatus,
      operator.id,
      operator.name,
      operator.role,
      changeReason,
      undefined,
      ipAddress
    );

    return { success: true };
  }

  getInspectionOrder(requestId: string) {
    return this.dao.getInspectionOrderByRequestId(requestId);
  }

  getRepairQuote(requestId: string) {
    return this.dao.getRepairQuoteByRequestId(requestId);
  }

  getPhotoInventory(requestId: string) {
    return this.dao.getPhotoInventoryByRequestId(requestId);
  }

  getAuditLogs(requestId: string) {
    return this.dao.getAuditLogsByRequestId(requestId);
  }

  getFailedRecords(params: any) {
    return this.dao.getFailedRecords(params);
  }

  resolveFailedRecord(id: string, resolutionNote: string, operatorId: string) {
    return this.dao.resolveFailedRecord(id, resolutionNote, operatorId);
  }
}

export default PreparationService;
