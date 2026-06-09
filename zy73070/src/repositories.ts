import { v4 as uuidv4 } from 'uuid';
import {
  getTable,
  insertOne,
  findByField,
  filterByField,
  updateOne,
  transaction,
  forceFlush,
} from './database';
import {
  WorkOrder,
  RawSensorLog,
  VerdictHistory,
  DuplicateDeviceAlert,
  AuditLog,
  CreateWorkOrderRequest,
  ConclusionType,
} from './types';

export function nowISO(): string {
  return new Date().toISOString();
}

export class WorkOrderRepository {
  create(req: CreateWorkOrderRequest): WorkOrder {
    const now = nowISO();
    const id = uuidv4();
    const conclusion = req.initial_conclusion;

    const record: WorkOrder = {
      id,
      work_order_no: req.work_order_no,
      device_code: req.device_code,
      device_name: req.device_name ?? null,
      temperature_value: req.temperature_value ?? null,
      temperature_threshold: req.temperature_threshold ?? 75.0,
      raw_sensor_log: req.raw_sensor_log ?? null,
      initial_conclusion: conclusion,
      current_conclusion: conclusion,
      status: 'pending',
      is_suspended: 0,
      suspend_reason: null,
      is_rescinded: 0,
      rescind_reason: null,
      rescinded_by: null,
      rescinded_at: null,
      created_by: req.created_by,
      created_at: now,
      updated_at: now,
    };

    return insertOne('work_orders', record) as WorkOrder;
  }

  findById(id: string): WorkOrder | undefined {
    return findByField('work_orders', 'id', id) as WorkOrder | undefined;
  }

  findByNo(workOrderNo: string): WorkOrder | undefined {
    return findByField('work_orders', 'work_order_no', workOrderNo) as WorkOrder | undefined;
  }

  findByDeviceCode(deviceCode: string): WorkOrder[] {
    const rows = filterByField('work_orders', 'device_code', deviceCode) as WorkOrder[];
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  list(options: {
    status?: string;
    suspended?: boolean;
    rescinded?: boolean;
    device_code?: string;
    limit?: number;
    offset?: number;
  } = {}): WorkOrder[] {
    let list = getTable('work_orders') as WorkOrder[];

    if (options.status) list = list.filter(o => o.status === options.status);
    if (options.suspended !== undefined)
      list = list.filter(o => o.is_suspended === (options.suspended ? 1 : 0));
    if (options.rescinded !== undefined)
      list = list.filter(o => o.is_rescinded === (options.rescinded ? 1 : 0));
    if (options.device_code)
      list = list.filter(o => o.device_code.includes(options.device_code!));

    list = list.sort((a, b) => b.created_at.localeCompare(a.created_at));

    if (options.offset) list = list.slice(options.offset);
    if (options.limit) list = list.slice(0, options.limit);

    return list;
  }

  updateConclusion(id: string, conclusion: ConclusionType): void {
    updateOne('work_orders', 'id', id, {
      current_conclusion: conclusion,
      updated_at: nowISO(),
    });
  }

  updateStatus(id: string, status: WorkOrder['status']): void {
    updateOne('work_orders', 'id', id, { status, updated_at: nowISO() });
  }

  suspend(id: string, reason: string): void {
    updateOne('work_orders', 'id', id, {
      is_suspended: 1,
      suspend_reason: reason,
      status: 'pending',
      updated_at: nowISO(),
    });
  }

  resume(id: string): void {
    updateOne('work_orders', 'id', id, {
      is_suspended: 0,
      suspend_reason: null,
      updated_at: nowISO(),
    });
  }

  rescind(id: string, reason: string, rescindedBy: string): void {
    updateOne('work_orders', 'id', id, {
      is_rescinded: 1,
      rescind_reason: reason,
      rescinded_by: rescindedBy,
      rescinded_at: nowISO(),
      status: 'closed',
      updated_at: nowISO(),
    });
  }
}

export class RawSensorLogRepository {
  attach(
    workOrderId: string,
    rawContent: string,
    sourceType: RawSensorLog['source_type'],
    sourceIdentifier?: string,
    isDirty: boolean = false,
    dirtyNotes?: string
  ): RawSensorLog {
    const record: RawSensorLog = {
      id: uuidv4(),
      work_order_id: workOrderId,
      raw_content: rawContent,
      source_type: sourceType,
      source_identifier: sourceIdentifier ?? null,
      received_at: nowISO(),
      is_dirty: isDirty ? 1 : 0,
      dirty_notes: dirtyNotes ?? null,
    };
    return insertOne('raw_sensor_logs', record) as RawSensorLog;
  }

  findById(id: string): RawSensorLog | undefined {
    return findByField('raw_sensor_logs', 'id', id) as RawSensorLog | undefined;
  }

  findByWorkOrder(workOrderId: string): RawSensorLog[] {
    const rows = filterByField('raw_sensor_logs', 'work_order_id', workOrderId) as RawSensorLog[];
    return rows.sort((a, b) => a.received_at.localeCompare(b.received_at));
  }
}

export class VerdictHistoryRepository {
  create(entry: Omit<VerdictHistory, 'id' | 'changed_at'>): VerdictHistory {
    const record: VerdictHistory = {
      id: uuidv4(),
      work_order_id: entry.work_order_id,
      sequence_no: entry.sequence_no,
      old_conclusion: entry.old_conclusion ?? null,
      new_conclusion: entry.new_conclusion,
      change_reason: entry.change_reason,
      operator_id: entry.operator_id,
      operator_name: entry.operator_name,
      supplementary_material: entry.supplementary_material ?? null,
      previous_material_snapshot: entry.previous_material_snapshot ?? null,
      remark: entry.remark ?? null,
      changed_at: nowISO(),
    };
    return insertOne('verdict_histories', record) as VerdictHistory;
  }

  findById(id: string): VerdictHistory | undefined {
    return findByField('verdict_histories', 'id', id) as VerdictHistory | undefined;
  }

  findByWorkOrder(workOrderId: string): VerdictHistory[] {
    const rows = filterByField('verdict_histories', 'work_order_id', workOrderId) as VerdictHistory[];
    return rows.sort((a, b) => a.sequence_no - b.sequence_no);
  }

  getNextSequence(workOrderId: string): number {
    const records = filterByField('verdict_histories', 'work_order_id', workOrderId) as VerdictHistory[];
    if (records.length === 0) return 1;
    return Math.max(...records.map(r => r.sequence_no)) + 1;
  }
}

export class DuplicateDeviceAlertRepository {
  create(
    workOrderId: string,
    deviceCode: string,
    conflictingIds: string[]
  ): DuplicateDeviceAlert {
    const record: DuplicateDeviceAlert = {
      id: uuidv4(),
      work_order_id: workOrderId,
      duplicate_device_code: deviceCode,
      conflicting_work_order_ids: JSON.stringify(conflictingIds),
      detected_at: nowISO(),
      resolved_at: null,
      resolved_by: null,
      resolution_type: null,
      resolution_note: null,
    };
    return insertOne('duplicate_device_alerts', record) as DuplicateDeviceAlert;
  }

  findById(id: string): DuplicateDeviceAlert | undefined {
    return findByField('duplicate_device_alerts', 'id', id) as DuplicateDeviceAlert | undefined;
  }

  findByDeviceCode(deviceCode: string): DuplicateDeviceAlert[] {
    const rows = filterByField('duplicate_device_alerts', 'duplicate_device_code', deviceCode) as DuplicateDeviceAlert[];
    return rows.sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  }

  listUnresolved(): DuplicateDeviceAlert[] {
    const all = getTable('duplicate_device_alerts') as DuplicateDeviceAlert[];
    return all
      .filter(a => a.resolved_at === null)
      .sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  }

  resolve(
    id: string,
    resolutionType: DuplicateDeviceAlert['resolution_type'],
    note: string,
    resolvedBy: string
  ): void {
    updateOne('duplicate_device_alerts', 'id', id, {
      resolution_type: resolutionType,
      resolution_note: note,
      resolved_by: resolvedBy,
      resolved_at: nowISO(),
    });
  }
}

export class AuditLogRepository {
  create(entry: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
    const record: AuditLog = {
      id: uuidv4(),
      work_order_id: entry.work_order_id ?? null,
      action_type: entry.action_type,
      actor_id: entry.actor_id,
      actor_name: entry.actor_name,
      old_values: entry.old_values ?? null,
      new_values: entry.new_values ?? null,
      change_source: entry.change_source,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      created_at: nowISO(),
    };
    return insertOne('audit_logs', record) as AuditLog;
  }

  findByWorkOrder(workOrderId: string): AuditLog[] {
    const rows = filterByField('audit_logs', 'work_order_id', workOrderId) as AuditLog[];
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  listAll(limit: number = 100): AuditLog[] {
    const all = getTable('audit_logs') as AuditLog[];
    return all.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }
}

export { transaction, forceFlush };
