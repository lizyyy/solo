import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import { SecurityManager } from './security';
import { EquipmentType, RecordStatus, OperationType, UserContext, OperationResult, RentalRecordItem } from './types';
import { PERMISSIONS } from './config';

export class RentalService {
  private security: SecurityManager;
  private user: UserContext;

  constructor(user: UserContext) {
    this.user = user;
    this.security = new SecurityManager(user);
  }

  private checkIdempotency(requestId: string): { isDuplicate: boolean; existingRecord?: any } {
    if (storage.hasRequestId(requestId)) {
      const existingRecord = storage.getRentalRecordByRequestId(requestId);
      return { isDuplicate: true, existingRecord };
    }
    return { isDuplicate: false };
  }

  private createAuditLog(
    operationType: OperationType,
    recordId: string | undefined,
    boothId: string | undefined,
    equipmentId: string | undefined,
    changes: Array<{ field: string; oldValue: any; newValue: any }>
  ): void {
    storage.addAuditLog({
      operationType,
      recordId,
      boothId,
      equipmentId,
      operator: this.user.userName,
      operatorRole: this.user.role,
      changes
    });
  }

  public importEquipment(
    requestId: string,
    equipmentData: Array<{
      type: EquipmentType;
      name: string;
      spec: string;
      totalQuantity: number;
      unit: string;
      pricePerDay?: number;
      supplier?: string;
    }>
  ): OperationResult {
    this.security.checkPermission(PERMISSIONS.EQUIPMENT_IMPORT);

    const idempotency = this.checkIdempotency(requestId);
    if (idempotency.isDuplicate) {
      return {
        success: true,
        data: idempotency.existingRecord,
        requestId,
        isDuplicate: true,
        warnings: ['重复请求，返回已有记录']
      };
    }

    const results = [];
    const warnings: string[] = [];

    for (const item of equipmentData) {
      const existing = storage.getEquipment().find(
        e => e.name === item.name && e.spec === item.spec
      );

      if (existing) {
        const oldQty = existing.totalQuantity;
        const updated = storage.updateEquipment(existing.id, {
          totalQuantity: existing.totalQuantity + item.totalQuantity,
          availableQuantity: existing.availableQuantity + item.totalQuantity
        });
        results.push(updated);
        this.createAuditLog(OperationType.IMPORT, undefined, undefined, existing.id, [
          { field: 'totalQuantity', oldValue: oldQty, newValue: updated?.totalQuantity },
          { field: 'availableQuantity', oldValue: existing.availableQuantity, newValue: updated?.availableQuantity }
        ]);
      } else {
        const newEquipment = storage.addEquipment({
          type: item.type,
          name: item.name,
          spec: item.spec,
          totalQuantity: item.totalQuantity,
          availableQuantity: item.totalQuantity,
          unit: item.unit,
          pricePerDay: item.pricePerDay,
          supplier: item.supplier
        });
        results.push(newEquipment);
        this.createAuditLog(OperationType.IMPORT, undefined, undefined, newEquipment.id, [
          { field: 'created', oldValue: null, newValue: newEquipment.name }
        ]);
      }
    }

    storage.addRequestId(requestId);

    const validResults = results.filter(r => r !== undefined);

    return {
      success: true,
      data: this.security.maskEquipmentList(validResults),
      requestId,
      isDuplicate: false,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  public occupyEquipment(
    requestId: string,
    boothNumber: string,
    companyName: string,
    items: Array<{ equipmentId: string; quantity: number }>,
    requestedBy: string,
    contactPerson?: string,
    contactPhone?: string
  ): OperationResult {
    this.security.checkPermission(PERMISSIONS.RENTAL_CREATE);

    const idempotency = this.checkIdempotency(requestId);
    if (idempotency.isDuplicate) {
      return {
        success: true,
        data: idempotency.existingRecord,
        requestId,
        isDuplicate: true,
        warnings: ['重复请求，返回已有记录']
      };
    }

    let booth = storage.getBoothByNumber(boothNumber);
    if (!booth) {
      booth = storage.addBooth({
        boothNumber,
        companyName,
        contactPerson,
        contactPhone
      });
    }

    const warnings: string[] = [];
    const recordItems: RentalRecordItem[] = [];

    for (const item of items) {
      const equipment = storage.getEquipmentById(item.equipmentId);
      if (!equipment) {
        return {
          success: false,
          error: `设备不存在: ${item.equipmentId}`,
          requestId,
          isDuplicate: false
        };
      }

      if (equipment.availableQuantity < item.quantity) {
        return {
          success: false,
          error: `设备库存不足: ${equipment.name} ${equipment.spec}，可用: ${equipment.availableQuantity}，申请: ${item.quantity}`,
          requestId,
          isDuplicate: false
        };
      }

      if (item.quantity <= 0) {
        warnings.push(`数量必须大于0，跳过: ${equipment.name}`);
        continue;
      }

      recordItems.push({
        equipmentId: item.equipmentId,
        equipmentType: equipment.type,
        equipmentName: equipment.name,
        quantity: item.quantity,
        unit: equipment.unit
      });
    }

    if (recordItems.length === 0) {
      return {
        success: false,
        error: '没有有效的租赁项目',
        requestId,
        isDuplicate: false
      };
    }

    for (const item of recordItems) {
      const equipment = storage.getEquipmentById(item.equipmentId)!;
      storage.updateEquipment(item.equipmentId, {
        availableQuantity: equipment.availableQuantity - item.quantity
      });
    }

    const record = storage.addRentalRecord({
      requestId,
      boothId: booth.id,
      boothNumber: booth.boothNumber,
      items: recordItems,
      status: RecordStatus.CONFIRMED,
      operationType: OperationType.OCCUPY,
      requestedBy,
      requestedAt: dayjs().toISOString(),
      confirmedAt: dayjs().toISOString(),
      createdBy: this.user.userName
    });

    storage.addRequestId(requestId);

    this.createAuditLog(OperationType.OCCUPY, record.id, booth.id, undefined, [
      { field: 'items', oldValue: [], newValue: recordItems }
    ]);

    return {
      success: true,
      data: this.security.maskRentalRecord(record),
      requestId,
      isDuplicate: false,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  public transferEquipment(
    requestId: string,
    fromBoothNumber: string,
    toBoothNumber: string,
    toCompanyName: string,
    items: Array<{ equipmentId: string; quantity: number }>,
    requestedBy: string
  ): OperationResult {
    this.security.checkPermission(PERMISSIONS.TRANSFER_CREATE);

    const idempotency = this.checkIdempotency(requestId);
    if (idempotency.isDuplicate) {
      return {
        success: true,
        data: idempotency.existingRecord,
        requestId,
        isDuplicate: true,
        warnings: ['重复请求，返回已有记录']
      };
    }

    const fromBooth = storage.getBoothByNumber(fromBoothNumber);
    if (!fromBooth) {
      return {
        success: false,
        error: `源展位不存在: ${fromBoothNumber}`,
        requestId,
        isDuplicate: false
      };
    }

    let toBooth = storage.getBoothByNumber(toBoothNumber);
    if (!toBooth) {
      toBooth = storage.addBooth({
        boothNumber: toBoothNumber,
        companyName: toCompanyName
      });
    }

    for (const item of items) {
      const rentedQty = storage.getBoothRentedQuantity(fromBooth.id, item.equipmentId);
      if (rentedQty < item.quantity) {
        return {
          success: false,
          error: `源展位 ${fromBoothNumber} 没有足够的该设备，已租: ${rentedQty}，调拨: ${item.quantity}`,
          requestId,
          isDuplicate: false
        };
      }
    }

    const recordItems: RentalRecordItem[] = [];
    for (const item of items) {
      const equipment = storage.getEquipmentById(item.equipmentId)!;
      recordItems.push({
        equipmentId: item.equipmentId,
        equipmentType: equipment.type,
        equipmentName: equipment.name,
        quantity: item.quantity,
        unit: equipment.unit
      });
    }

    const record = storage.addRentalRecord({
      requestId,
      boothId: toBooth.id,
      boothNumber: toBooth.boothNumber,
      items: recordItems,
      status: RecordStatus.CONFIRMED,
      operationType: OperationType.TRANSFER,
      requestedBy,
      requestedAt: dayjs().toISOString(),
      confirmedAt: dayjs().toISOString(),
      transferFromBoothId: fromBooth.id,
      transferToBoothId: toBooth.id,
      createdBy: this.user.userName
    });

    storage.addRequestId(requestId);

    this.createAuditLog(OperationType.TRANSFER, record.id, toBooth.id, undefined, [
      { field: 'transferFrom', oldValue: fromBoothNumber, newValue: toBoothNumber },
      { field: 'items', oldValue: [], newValue: recordItems }
    ]);

    return {
      success: true,
      data: this.security.maskRentalRecord(record),
      requestId,
      isDuplicate: false
    };
  }

  public returnEquipment(
    requestId: string,
    boothNumber: string,
    items: Array<{ equipmentId: string; quantity: number }>,
    returnedBy: string,
    notes?: string
  ): OperationResult {
    this.security.checkPermission(PERMISSIONS.RENTAL_RETURN);

    const idempotency = this.checkIdempotency(requestId);
    if (idempotency.isDuplicate) {
      return {
        success: true,
        data: idempotency.existingRecord,
        requestId,
        isDuplicate: true,
        warnings: ['重复请求，返回已有记录']
      };
    }

    const booth = storage.getBoothByNumber(boothNumber);
    if (!booth) {
      return {
        success: false,
        error: `展位不存在: ${boothNumber}`,
        requestId,
        isDuplicate: false
      };
    }

    for (const item of items) {
      const rentedQty = storage.getBoothRentedQuantity(booth.id, item.equipmentId);
      if (rentedQty < item.quantity) {
        const equipment = storage.getEquipmentById(item.equipmentId);
        return {
          success: false,
          error: `展位 ${boothNumber} 租赁的 ${equipment?.name || '设备'} 数量不足，已租: ${rentedQty}，归还: ${item.quantity}`,
          requestId,
          isDuplicate: false
        };
      }
    }

    const recordItems: RentalRecordItem[] = [];
    for (const item of items) {
      const equipment = storage.getEquipmentById(item.equipmentId)!;
      recordItems.push({
        equipmentId: item.equipmentId,
        equipmentType: equipment.type,
        equipmentName: equipment.name,
        quantity: item.quantity,
        unit: equipment.unit
      });

      storage.updateEquipment(item.equipmentId, {
        availableQuantity: equipment.availableQuantity + item.quantity
      });
    }

    const record = storage.addRentalRecord({
      requestId,
      boothId: booth.id,
      boothNumber: booth.boothNumber,
      items: recordItems,
      status: RecordStatus.RETURNED,
      operationType: OperationType.RETURN,
      requestedBy: returnedBy,
      requestedAt: dayjs().toISOString(),
      returnedAt: dayjs().toISOString(),
      actualReturnDate: dayjs().toISOString(),
      notes,
      createdBy: this.user.userName
    });

    storage.addRequestId(requestId);

    this.createAuditLog(OperationType.RETURN, record.id, booth.id, undefined, [
      { field: 'items', oldValue: [], newValue: recordItems },
      { field: 'status', oldValue: 'confirmed', newValue: 'returned' }
    ]);

    return {
      success: true,
      data: this.security.maskRentalRecord(record),
      requestId,
      isDuplicate: false
    };
  }

  public reportDamage(
    requestId: string,
    boothNumber: string,
    equipmentId: string,
    damageType: string,
    damageDescription: string,
    damageQuantity: number,
    reportedBy: string
  ): OperationResult {
    this.security.checkPermission(PERMISSIONS.DAMAGE_REPORT);

    const idempotency = this.checkIdempotency(requestId);
    if (idempotency.isDuplicate) {
      return {
        success: true,
        data: idempotency.existingRecord,
        requestId,
        isDuplicate: true,
        warnings: ['重复请求，返回已有记录']
      };
    }

    const booth = storage.getBoothByNumber(boothNumber);
    if (!booth) {
      return {
        success: false,
        error: `展位不存在: ${boothNumber}`,
        requestId,
        isDuplicate: false
      };
    }

    const equipment = storage.getEquipmentById(equipmentId);
    if (!equipment) {
      return {
        success: false,
        error: `设备不存在: ${equipmentId}`,
        requestId,
        isDuplicate: false
      };
    }

    const rentedQty = storage.getBoothRentedQuantity(booth.id, equipmentId);
    if (rentedQty < damageQuantity) {
      return {
        success: false,
        error: `展位 ${boothNumber} 租赁的该设备数量不足，已租: ${rentedQty}，报损: ${damageQuantity}`,
        requestId,
        isDuplicate: false
      };
    }

    storage.updateEquipment(equipmentId, {
      totalQuantity: equipment.totalQuantity - damageQuantity
    });

    const record = storage.addRentalRecord({
      requestId,
      boothId: booth.id,
      boothNumber: booth.boothNumber,
      items: [{
        equipmentId,
        equipmentType: equipment.type,
        equipmentName: equipment.name,
        quantity: damageQuantity,
        unit: equipment.unit
      }],
      status: RecordStatus.DAMAGED,
      operationType: OperationType.DAMAGE,
      requestedBy: reportedBy,
      requestedAt: dayjs().toISOString(),
      damageType,
      damageDescription,
      damageQuantity,
      createdBy: this.user.userName
    });

    storage.addRequestId(requestId);

    this.createAuditLog(OperationType.DAMAGE, record.id, booth.id, equipmentId, [
      { field: 'damageType', oldValue: null, newValue: damageType },
      { field: 'damageQuantity', oldValue: 0, newValue: damageQuantity },
      { field: 'totalQuantity', oldValue: equipment.totalQuantity, newValue: equipment.totalQuantity - damageQuantity }
    ]);

    return {
      success: true,
      data: this.security.maskRentalRecord(record),
      requestId,
      isDuplicate: false
    };
  }

  public getEquipmentList() {
    this.security.checkPermission(PERMISSIONS.EQUIPMENT_VIEW);
    return this.security.maskEquipmentList(storage.getEquipment());
  }

  public getBoothList() {
    this.security.checkPermission(PERMISSIONS.BOOTH_VIEW);
    return this.security.maskBoothList(storage.getBooths());
  }

  public getRentalRecords() {
    this.security.checkPermission(PERMISSIONS.RENTAL_VIEW);
    return this.security.maskRentalRecordList(storage.getRentalRecords());
  }

  public getAuditLogs() {
    this.security.checkPermission(PERMISSIONS.AUDIT_VIEW);
    return this.security.logAuditLogList(storage.getAuditLogs());
  }

  public getRecordById(id: string) {
    this.security.checkPermission(PERMISSIONS.RENTAL_VIEW);
    const record = storage.getRentalRecordById(id);
    return record ? this.security.maskRentalRecord(record) : null;
  }

  public getRecordByRequestId(requestId: string) {
    this.security.checkPermission(PERMISSIONS.RENTAL_VIEW);
    const record = storage.getRentalRecordByRequestId(requestId);
    return record ? this.security.maskRentalRecord(record) : null;
  }

  public getBoothRentalSummary(boothNumber: string) {
    this.security.checkPermission(PERMISSIONS.RENTAL_VIEW);
    const booth = storage.getBoothByNumber(boothNumber);
    if (!booth) {
      return null;
    }

    const records = storage.getRentalRecordsByBoothId(booth.id);
    const summary: Record<string, { type: string; name: string; total: number; returned: number; damaged: number }> = {};

    for (const record of records) {
      for (const item of record.items) {
        if (!summary[item.equipmentId]) {
          summary[item.equipmentId] = {
            type: item.equipmentType,
            name: item.equipmentName,
            total: 0,
            returned: 0,
            damaged: 0
          };
        }

        if (record.operationType === OperationType.OCCUPY || record.operationType === OperationType.TRANSFER) {
          summary[item.equipmentId].total += item.quantity;
        } else if (record.operationType === OperationType.RETURN) {
          summary[item.equipmentId].returned += item.quantity;
        } else if (record.operationType === OperationType.DAMAGE) {
          summary[item.equipmentId].damaged += item.quantity;
        }
      }
    }

    return {
      booth: this.security.maskBooth(booth),
      summary: Object.values(summary).map(s => ({
        ...s,
        current: s.total - s.returned - s.damaged
      }))
    };
  }
}
