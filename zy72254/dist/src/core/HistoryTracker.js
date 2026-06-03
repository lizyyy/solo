"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryTracker = void 0;
exports.compareObstructions = compareObstructions;
exports.createFieldDiff = createFieldDiff;
exports.deepEqual = deepEqual;
exports.describeChange = describeChange;
exports.compareVersions = compareVersions;
const idGenerator_1 = require("../utils/idGenerator");
class HistoryTracker {
    constructor() {
        this.records = [];
        this.snapshots = new Map();
    }
    saveSnapshot(entityId, entity) {
        this.snapshots.set(entityId, JSON.parse(JSON.stringify(entity)));
    }
    getSnapshot(entityId) {
        return this.snapshots.get(entityId);
    }
    clearSnapshot(entityId) {
        this.snapshots.delete(entityId);
    }
    trackChange(params) {
        const record = {
            id: (0, idGenerator_1.generateHistoryId)(),
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            fieldName: params.fieldName,
            oldValue: params.oldValue,
            newValue: params.newValue,
            operator: params.operator,
            timestamp: Date.now(),
            notes: params.notes,
            rollbackAvailable: params.rollbackAvailable ?? true
        };
        this.records.push(record);
        return record;
    }
    trackObstructionUpdate(oldObstruction, newObstruction, operator, notes) {
        const diffs = compareObstructions(oldObstruction, newObstruction);
        const records = [];
        if (!diffs.hasChanges) {
            return records;
        }
        for (const fieldDiff of diffs.fields) {
            if (fieldDiff.changed) {
                const record = this.trackChange({
                    entityType: 'obstruction',
                    entityId: newObstruction.id,
                    action: 'update',
                    fieldName: fieldDiff.field,
                    oldValue: fieldDiff.oldValue,
                    newValue: fieldDiff.newValue,
                    operator,
                    notes
                });
                records.push(record);
            }
        }
        return records;
    }
    getHistory(entityId, entityType) {
        let filtered = [...this.records];
        if (entityId) {
            filtered = filtered.filter(r => r.entityId === entityId);
        }
        if (entityType) {
            filtered = filtered.filter(r => r.entityType === entityType);
        }
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }
    getHistoryWithDiff(entityId) {
        const history = this.getHistory(entityId);
        return history.map(record => ({
            ...record,
            diffDescription: describeChange(record)
        }));
    }
    getChangeSummary(entityId) {
        const history = this.getHistory(entityId);
        if (history.length === 0) {
            return {
                changedFields: [],
                lastModified: 0,
                lastOperator: '',
                changeCount: 0
            };
        }
        const changedFields = new Set();
        for (const record of history) {
            if (record.fieldName) {
                changedFields.add(record.fieldName);
            }
        }
        return {
            changedFields: Array.from(changedFields),
            lastModified: history[0].timestamp,
            lastOperator: history[0].operator,
            changeCount: history.length
        };
    }
    canRollback(recordId) {
        const record = this.records.find(r => r.id === recordId);
        return record?.rollbackAvailable ?? false;
    }
    getRollbackValue(recordId) {
        const record = this.records.find(r => r.id === recordId);
        return record?.oldValue;
    }
    markRollbackUsed(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (record) {
            record.rollbackAvailable = false;
        }
    }
    getAllRecords() {
        return [...this.records];
    }
}
exports.HistoryTracker = HistoryTracker;
function compareObstructions(a, b) {
    const fields = [];
    fields.push(createFieldDiff('canonicalName', a.canonicalName, b.canonicalName));
    fields.push(createFieldDiff('status', a.status, b.status));
    fields.push(createFieldDiff('notes', a.notes, b.notes));
    fields.push(createFieldDiff('hazardLevel', a.hazardLevel, b.hazardLevel));
    fields.push(createFieldDiff('isOnEvacuationRoute', a.isOnEvacuationRoute, b.isOnEvacuationRoute));
    fields.push(createFieldDiff('aliases', a.aliases, b.aliases));
    fields.push(createFieldDiff('cadLayers', a.cadLayers, b.cadLayers));
    fields.push(createFieldDiff('rangefinderRecords', a.rangefinderRecords, b.rangefinderRecords));
    fields.push(createFieldDiff('position', a.position, b.position));
    fields.push(createFieldDiff('boundingBox', a.boundingBox, b.boundingBox));
    fields.push(createFieldDiff('conflictInfo', a.conflictInfo, b.conflictInfo));
    return {
        entityId: b.id,
        entityType: 'obstruction',
        fields,
        hasChanges: fields.some(f => f.changed)
    };
}
function createFieldDiff(field, oldValue, newValue) {
    const changed = !deepEqual(oldValue, newValue);
    return { field, oldValue, newValue, changed };
}
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (typeof a !== typeof b)
        return false;
    if (a === null || b === null)
        return a === b;
    if (typeof a === 'object' && typeof b === 'object') {
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            for (let i = 0; i < a.length; i++) {
                if (!deepEqual(a[i], b[i]))
                    return false;
            }
            return true;
        }
        if (!Array.isArray(a) && !Array.isArray(b)) {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length)
                return false;
            for (const key of keysA) {
                if (!deepEqual(a[key], b[key]))
                    return false;
            }
            return true;
        }
        return false;
    }
    return false;
}
function describeChange(record) {
    const fieldName = record.fieldName || record.action;
    switch (record.action) {
        case 'create':
            return `创建了新${getEntityTypeName(record.entityType)}`;
        case 'delete':
            return `删除了${getEntityTypeName(record.entityType)}`;
        case 'merge':
            return `合并了${getEntityTypeName(record.entityType)}`;
        case 'import':
            return `导入了${getEntityTypeName(record.entityType)}数据`;
        case 'update':
            return `修改了${getFieldDisplayName(fieldName)}：${formatValue(record.oldValue)} → ${formatValue(record.newValue)}`;
        default:
            return `${record.action}操作`;
    }
}
function getEntityTypeName(type) {
    const names = {
        obstruction: '障碍物',
        cad_layer: 'CAD图层',
        rangefinder: '测距仪记录',
        route: '疏散路线'
    };
    return names[type] || type;
}
function getFieldDisplayName(field) {
    const names = {
        canonicalName: '标准名称',
        status: '状态',
        notes: '备注',
        hazardLevel: '危险等级',
        isOnEvacuationRoute: '是否在疏散路线上',
        aliases: '别名列表',
        cadLayers: '关联CAD图层',
        rangefinderRecords: '测距仪记录',
        position: '位置坐标',
        boundingBox: '边界框',
        conflictInfo: '冲突信息'
    };
    return names[field] || field;
}
function formatValue(value) {
    if (value === null || value === undefined) {
        return '（空）';
    }
    if (typeof value === 'string') {
        return value.length > 50 ? value.substring(0, 47) + '...' : value;
    }
    if (Array.isArray(value)) {
        return `[共${value.length}项]`;
    }
    if (typeof value === 'object') {
        return '（对象）';
    }
    return String(value);
}
function compareVersions(oldVersion, newVersion) {
    const changes = [];
    const readableDiff = [];
    const oldObj = oldVersion;
    const newObj = newVersion;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
        if (!deepEqual(oldObj[key], newObj[key])) {
            changes.push({ field: key, old: oldObj[key], new: newObj[key] });
            readableDiff.push(`${getFieldDisplayName(key)}: ${formatValue(oldObj[key])} → ${formatValue(newObj[key])}`);
        }
    }
    return {
        changed: changes.length > 0,
        changes,
        readableDiff
    };
}
//# sourceMappingURL=HistoryTracker.js.map