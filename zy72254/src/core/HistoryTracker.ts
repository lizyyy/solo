import { HistoryRecord, Obstruction, CADLayerInfo, RangefinderRecord, EvacuationRoute } from '../types';
import { generateHistoryId } from '../utils/idGenerator';

export interface FieldDiff<T = unknown> {
  field: string;
  oldValue: T;
  newValue: T;
  changed: boolean;
}

export interface EntityDiff {
  entityId: string;
  entityType: 'obstruction' | 'cad_layer' | 'rangefinder' | 'route';
  fields: FieldDiff[];
  hasChanges: boolean;
}

export type TrackableEntity = Obstruction | CADLayerInfo | RangefinderRecord | EvacuationRoute;

export class HistoryTracker {
  private records: HistoryRecord[] = [];
  private snapshots: Map<string, TrackableEntity> = new Map();

  saveSnapshot(entityId: string, entity: TrackableEntity): void {
    this.snapshots.set(entityId, JSON.parse(JSON.stringify(entity)));
  }

  getSnapshot(entityId: string): TrackableEntity | undefined {
    return this.snapshots.get(entityId);
  }

  clearSnapshot(entityId: string): void {
    this.snapshots.delete(entityId);
  }

  trackChange<T>(params: {
    entityType: 'obstruction' | 'cad_layer' | 'rangefinder' | 'route';
    entityId: string;
    action: 'create' | 'update' | 'delete' | 'merge' | 'import';
    fieldName?: string;
    oldValue: T;
    newValue: T;
    operator: string;
    notes?: string;
    rollbackAvailable?: boolean;
  }): HistoryRecord<T> {
    const record: HistoryRecord<T> = {
      id: generateHistoryId(),
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

    this.records.push(record as HistoryRecord);
    return record;
  }

  trackObstructionUpdate(
    oldObstruction: Obstruction,
    newObstruction: Obstruction,
    operator: string,
    notes?: string
  ): HistoryRecord[] {
    const diffs = compareObstructions(oldObstruction, newObstruction);
    const records: HistoryRecord[] = [];

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
        records.push(record as HistoryRecord);
      }
    }

    return records;
  }

  getHistory(entityId?: string, entityType?: string): HistoryRecord[] {
    let filtered = [...this.records];

    if (entityId) {
      filtered = filtered.filter(r => r.entityId === entityId);
    }

    if (entityType) {
      filtered = filtered.filter(r => r.entityType === entityType);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getHistoryWithDiff(entityId: string): Array<HistoryRecord & { diffDescription: string }> {
    const history = this.getHistory(entityId);

    return history.map(record => ({
      ...record,
      diffDescription: describeChange(record)
    }));
  }

  getChangeSummary(entityId: string): {
    changedFields: string[];
    lastModified: number;
    lastOperator: string;
    changeCount: number;
  } {
    const history = this.getHistory(entityId);

    if (history.length === 0) {
      return {
        changedFields: [],
        lastModified: 0,
        lastOperator: '',
        changeCount: 0
      };
    }

    const changedFields = new Set<string>();
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

  canRollback(recordId: string): boolean {
    const record = this.records.find(r => r.id === recordId);
    return record?.rollbackAvailable ?? false;
  }

  getRollbackValue(recordId: string): unknown {
    const record = this.records.find(r => r.id === recordId);
    return record?.oldValue;
  }

  markRollbackUsed(recordId: string): void {
    const record = this.records.find(r => r.id === recordId);
    if (record) {
      record.rollbackAvailable = false;
    }
  }

  getAllRecords(): HistoryRecord[] {
    return [...this.records];
  }
}

export function compareObstructions(a: Obstruction, b: Obstruction): EntityDiff {
  const fields: FieldDiff[] = [];

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

export function createFieldDiff<T>(
  field: string,
  oldValue: T,
  newValue: T
): FieldDiff<T> {
  const changed = !deepEqual(oldValue, newValue);
  return { field, oldValue, newValue, changed };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;

  if (a === null || b === null) return a === b;

  if (typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (!Array.isArray(a) && !Array.isArray(b)) {
      const keysA = Object.keys(a as Record<string, unknown>);
      const keysB = Object.keys(b as Record<string, unknown>);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )) return false;
      }
      return true;
    }

    return false;
  }

  return false;
}

export function describeChange(record: HistoryRecord): string {
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

function getEntityTypeName(type: string): string {
  const names: Record<string, string> = {
    obstruction: '障碍物',
    cad_layer: 'CAD图层',
    rangefinder: '测距仪记录',
    route: '疏散路线'
  };
  return names[type] || type;
}

function getFieldDisplayName(field: string): string {
  const names: Record<string, string> = {
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

function formatValue(value: unknown): string {
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

export function compareVersions<T extends TrackableEntity>(
  oldVersion: T,
  newVersion: T
): {
  changed: boolean;
  changes: Array<{ field: string; old: unknown; new: unknown }>;
  readableDiff: string[];
} {
  const changes: Array<{ field: string; old: unknown; new: unknown }> = [];
  const readableDiff: string[] = [];

  const oldObj = oldVersion as unknown as Record<string, unknown>;
  const newObj = newVersion as unknown as Record<string, unknown>;

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (!deepEqual(oldObj[key], newObj[key])) {
      changes.push({ field: key, old: oldObj[key], new: newObj[key] });
      readableDiff.push(
        `${getFieldDisplayName(key)}: ${formatValue(oldObj[key])} → ${formatValue(newObj[key])}`
      );
    }
  }

  return {
    changed: changes.length > 0,
    changes,
    readableDiff
  };
}
