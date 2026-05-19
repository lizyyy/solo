"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RentalService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const storage_1 = require("./storage");
const security_1 = require("./security");
const types_1 = require("./types");
const config_1 = require("./config");
class RentalService {
    constructor(user) {
        this.user = user;
        this.security = new security_1.SecurityManager(user);
    }
    checkIdempotency(requestId) {
        if (storage_1.storage.hasRequestId(requestId)) {
            const existingRecord = storage_1.storage.getRentalRecordByRequestId(requestId);
            return { isDuplicate: true, existingRecord };
        }
        return { isDuplicate: false };
    }
    createAuditLog(operationType, recordId, boothId, equipmentId, changes) {
        storage_1.storage.addAuditLog({
            operationType,
            recordId,
            boothId,
            equipmentId,
            operator: this.user.userName,
            operatorRole: this.user.role,
            changes
        });
    }
    importEquipment(requestId, equipmentData) {
        this.security.checkPermission(config_1.PERMISSIONS.EQUIPMENT_IMPORT);
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
        const warnings = [];
        for (const item of equipmentData) {
            const existing = storage_1.storage.getEquipment().find(e => e.name === item.name && e.spec === item.spec);
            if (existing) {
                const oldQty = existing.totalQuantity;
                const updated = storage_1.storage.updateEquipment(existing.id, {
                    totalQuantity: existing.totalQuantity + item.totalQuantity,
                    availableQuantity: existing.availableQuantity + item.totalQuantity
                });
                results.push(updated);
                this.createAuditLog(types_1.OperationType.IMPORT, undefined, undefined, existing.id, [
                    { field: 'totalQuantity', oldValue: oldQty, newValue: updated?.totalQuantity },
                    { field: 'availableQuantity', oldValue: existing.availableQuantity, newValue: updated?.availableQuantity }
                ]);
            }
            else {
                const newEquipment = storage_1.storage.addEquipment({
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
                this.createAuditLog(types_1.OperationType.IMPORT, undefined, undefined, newEquipment.id, [
                    { field: 'created', oldValue: null, newValue: newEquipment.name }
                ]);
            }
        }
        storage_1.storage.addRequestId(requestId);
        const validResults = results.filter(r => r !== undefined);
        return {
            success: true,
            data: this.security.maskEquipmentList(validResults),
            requestId,
            isDuplicate: false,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
    occupyEquipment(requestId, boothNumber, companyName, items, requestedBy, contactPerson, contactPhone) {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_CREATE);
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
        let booth = storage_1.storage.getBoothByNumber(boothNumber);
        if (!booth) {
            booth = storage_1.storage.addBooth({
                boothNumber,
                companyName,
                contactPerson,
                contactPhone
            });
        }
        const warnings = [];
        const recordItems = [];
        for (const item of items) {
            const equipment = storage_1.storage.getEquipmentById(item.equipmentId);
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
            const equipment = storage_1.storage.getEquipmentById(item.equipmentId);
            storage_1.storage.updateEquipment(item.equipmentId, {
                availableQuantity: equipment.availableQuantity - item.quantity
            });
        }
        const record = storage_1.storage.addRentalRecord({
            requestId,
            boothId: booth.id,
            boothNumber: booth.boothNumber,
            items: recordItems,
            status: types_1.RecordStatus.CONFIRMED,
            operationType: types_1.OperationType.OCCUPY,
            requestedBy,
            requestedAt: (0, dayjs_1.default)().toISOString(),
            confirmedAt: (0, dayjs_1.default)().toISOString(),
            createdBy: this.user.userName
        });
        storage_1.storage.addRequestId(requestId);
        this.createAuditLog(types_1.OperationType.OCCUPY, record.id, booth.id, undefined, [
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
    transferEquipment(requestId, fromBoothNumber, toBoothNumber, toCompanyName, items, requestedBy) {
        this.security.checkPermission(config_1.PERMISSIONS.TRANSFER_CREATE);
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
        const fromBooth = storage_1.storage.getBoothByNumber(fromBoothNumber);
        if (!fromBooth) {
            return {
                success: false,
                error: `源展位不存在: ${fromBoothNumber}`,
                requestId,
                isDuplicate: false
            };
        }
        let toBooth = storage_1.storage.getBoothByNumber(toBoothNumber);
        if (!toBooth) {
            toBooth = storage_1.storage.addBooth({
                boothNumber: toBoothNumber,
                companyName: toCompanyName
            });
        }
        for (const item of items) {
            const rentedQty = storage_1.storage.getBoothRentedQuantity(fromBooth.id, item.equipmentId);
            if (rentedQty < item.quantity) {
                return {
                    success: false,
                    error: `源展位 ${fromBoothNumber} 没有足够的该设备，已租: ${rentedQty}，调拨: ${item.quantity}`,
                    requestId,
                    isDuplicate: false
                };
            }
        }
        const recordItems = [];
        for (const item of items) {
            const equipment = storage_1.storage.getEquipmentById(item.equipmentId);
            recordItems.push({
                equipmentId: item.equipmentId,
                equipmentType: equipment.type,
                equipmentName: equipment.name,
                quantity: item.quantity,
                unit: equipment.unit
            });
        }
        const record = storage_1.storage.addRentalRecord({
            requestId,
            boothId: toBooth.id,
            boothNumber: toBooth.boothNumber,
            items: recordItems,
            status: types_1.RecordStatus.CONFIRMED,
            operationType: types_1.OperationType.TRANSFER,
            requestedBy,
            requestedAt: (0, dayjs_1.default)().toISOString(),
            confirmedAt: (0, dayjs_1.default)().toISOString(),
            transferFromBoothId: fromBooth.id,
            transferToBoothId: toBooth.id,
            createdBy: this.user.userName
        });
        storage_1.storage.addRequestId(requestId);
        this.createAuditLog(types_1.OperationType.TRANSFER, record.id, toBooth.id, undefined, [
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
    returnEquipment(requestId, boothNumber, items, returnedBy, notes) {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_RETURN);
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
        const booth = storage_1.storage.getBoothByNumber(boothNumber);
        if (!booth) {
            return {
                success: false,
                error: `展位不存在: ${boothNumber}`,
                requestId,
                isDuplicate: false
            };
        }
        for (const item of items) {
            const rentedQty = storage_1.storage.getBoothRentedQuantity(booth.id, item.equipmentId);
            if (rentedQty < item.quantity) {
                const equipment = storage_1.storage.getEquipmentById(item.equipmentId);
                return {
                    success: false,
                    error: `展位 ${boothNumber} 租赁的 ${equipment?.name || '设备'} 数量不足，已租: ${rentedQty}，归还: ${item.quantity}`,
                    requestId,
                    isDuplicate: false
                };
            }
        }
        const recordItems = [];
        for (const item of items) {
            const equipment = storage_1.storage.getEquipmentById(item.equipmentId);
            recordItems.push({
                equipmentId: item.equipmentId,
                equipmentType: equipment.type,
                equipmentName: equipment.name,
                quantity: item.quantity,
                unit: equipment.unit
            });
            storage_1.storage.updateEquipment(item.equipmentId, {
                availableQuantity: equipment.availableQuantity + item.quantity
            });
        }
        const record = storage_1.storage.addRentalRecord({
            requestId,
            boothId: booth.id,
            boothNumber: booth.boothNumber,
            items: recordItems,
            status: types_1.RecordStatus.RETURNED,
            operationType: types_1.OperationType.RETURN,
            requestedBy: returnedBy,
            requestedAt: (0, dayjs_1.default)().toISOString(),
            returnedAt: (0, dayjs_1.default)().toISOString(),
            actualReturnDate: (0, dayjs_1.default)().toISOString(),
            notes,
            createdBy: this.user.userName
        });
        storage_1.storage.addRequestId(requestId);
        this.createAuditLog(types_1.OperationType.RETURN, record.id, booth.id, undefined, [
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
    reportDamage(requestId, boothNumber, equipmentId, damageType, damageDescription, damageQuantity, reportedBy) {
        this.security.checkPermission(config_1.PERMISSIONS.DAMAGE_REPORT);
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
        const booth = storage_1.storage.getBoothByNumber(boothNumber);
        if (!booth) {
            return {
                success: false,
                error: `展位不存在: ${boothNumber}`,
                requestId,
                isDuplicate: false
            };
        }
        const equipment = storage_1.storage.getEquipmentById(equipmentId);
        if (!equipment) {
            return {
                success: false,
                error: `设备不存在: ${equipmentId}`,
                requestId,
                isDuplicate: false
            };
        }
        const rentedQty = storage_1.storage.getBoothRentedQuantity(booth.id, equipmentId);
        if (rentedQty < damageQuantity) {
            return {
                success: false,
                error: `展位 ${boothNumber} 租赁的该设备数量不足，已租: ${rentedQty}，报损: ${damageQuantity}`,
                requestId,
                isDuplicate: false
            };
        }
        storage_1.storage.updateEquipment(equipmentId, {
            totalQuantity: equipment.totalQuantity - damageQuantity
        });
        const record = storage_1.storage.addRentalRecord({
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
            status: types_1.RecordStatus.DAMAGED,
            operationType: types_1.OperationType.DAMAGE,
            requestedBy: reportedBy,
            requestedAt: (0, dayjs_1.default)().toISOString(),
            damageType,
            damageDescription,
            damageQuantity,
            createdBy: this.user.userName
        });
        storage_1.storage.addRequestId(requestId);
        this.createAuditLog(types_1.OperationType.DAMAGE, record.id, booth.id, equipmentId, [
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
    getEquipmentList() {
        this.security.checkPermission(config_1.PERMISSIONS.EQUIPMENT_VIEW);
        return this.security.maskEquipmentList(storage_1.storage.getEquipment());
    }
    getBoothList() {
        this.security.checkPermission(config_1.PERMISSIONS.BOOTH_VIEW);
        return this.security.maskBoothList(storage_1.storage.getBooths());
    }
    getRentalRecords() {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_VIEW);
        return this.security.maskRentalRecordList(storage_1.storage.getRentalRecords());
    }
    getAuditLogs() {
        this.security.checkPermission(config_1.PERMISSIONS.AUDIT_VIEW);
        return this.security.logAuditLogList(storage_1.storage.getAuditLogs());
    }
    getRecordById(id) {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_VIEW);
        const record = storage_1.storage.getRentalRecordById(id);
        return record ? this.security.maskRentalRecord(record) : null;
    }
    getRecordByRequestId(requestId) {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_VIEW);
        const record = storage_1.storage.getRentalRecordByRequestId(requestId);
        return record ? this.security.maskRentalRecord(record) : null;
    }
    getBoothRentalSummary(boothNumber) {
        this.security.checkPermission(config_1.PERMISSIONS.RENTAL_VIEW);
        const booth = storage_1.storage.getBoothByNumber(boothNumber);
        if (!booth) {
            return null;
        }
        const records = storage_1.storage.getRentalRecordsByBoothId(booth.id);
        const summary = {};
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
                if (record.operationType === types_1.OperationType.OCCUPY || record.operationType === types_1.OperationType.TRANSFER) {
                    summary[item.equipmentId].total += item.quantity;
                }
                else if (record.operationType === types_1.OperationType.RETURN) {
                    summary[item.equipmentId].returned += item.quantity;
                }
                else if (record.operationType === types_1.OperationType.DAMAGE) {
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
exports.RentalService = RentalService;
