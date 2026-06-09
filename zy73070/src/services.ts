import db from './database';
import {
  WorkOrderRepository,
  RawSensorLogRepository,
  VerdictHistoryRepository,
  DuplicateDeviceAlertRepository,
  AuditLogRepository,
  nowISO,
} from './repositories';
import {
  CreateWorkOrderRequest,
  ChangeVerdictRequest,
  SupplementMaterialRequest,
  ResolveDuplicateRequest,
  RescindWorkOrderRequest,
  WorkOrder,
  RawSensorLog,
  VerdictHistory,
  DuplicateDeviceAlert,
  ConclusionType,
} from './types';

const woRepo = new WorkOrderRepository();
const logRepo = new RawSensorLogRepository();
const historyRepo = new VerdictHistoryRepository();
const dupRepo = new DuplicateDeviceAlertRepository();
const auditRepo = new AuditLogRepository();

export class WorkOrderService {
  createWorkOrder(req: CreateWorkOrderRequest): {
    work_order: WorkOrder;
    raw_logs: RawSensorLog[];
    duplicate_alert: DuplicateDeviceAlert | null;
  } {
    const tx = db.transaction(() => {
      if (req.temperature_value != null && req.temperature_threshold != null) {
        const calcConclusion = this.calcConclusionByTemp(
          req.temperature_value,
          req.temperature_threshold
        );
        if (calcConclusion !== req.initial_conclusion) {
          req.initial_conclusion = calcConclusion;
        }
      }

      const workOrder = woRepo.create(req);

      const rawLogs: RawSensorLog[] = [];
      if (req.raw_sensor_log && req.raw_sensor_log.trim().length > 0) {
        const dirtyInfo = this.detectDirtyData(req.raw_sensor_log);
        const log = logRepo.attach(
          workOrder.id,
          req.raw_sensor_log,
          'manual_import',
          `inline_create_${workOrder.work_order_no}`,
          dirtyInfo.isDirty,
          dirtyInfo.notes
        );
        rawLogs.push(log);

        auditRepo.create({
          work_order_id: workOrder.id,
          action_type: 'raw_log_attached',
          actor_id: req.created_by,
          actor_name: req.created_by_name,
          old_values: null,
          new_values: JSON.stringify({
            source_type: 'manual_import',
            is_dirty: dirtyInfo.isDirty,
            dirty_notes: dirtyInfo.notes,
          }),
          change_source: 'ui',
          ip_address: null,
          user_agent: null,
        });
      }

      if (req.sensor_sources && req.sensor_sources.length > 0) {
        for (const src of req.sensor_sources) {
          const dirtyInfo = src.is_dirty
            ? { isDirty: true, notes: src.dirty_notes ?? '人工标记为脏数据' }
            : this.detectDirtyData(src.raw_content);
          const log = logRepo.attach(
            workOrder.id,
            src.raw_content,
            src.source_type,
            src.source_identifier,
            dirtyInfo.isDirty,
            dirtyInfo.notes
          );
          rawLogs.push(log);

          auditRepo.create({
            work_order_id: workOrder.id,
            action_type: 'raw_log_attached',
            actor_id: req.created_by,
            actor_name: req.created_by_name,
            old_values: null,
            new_values: JSON.stringify({
              source_type: src.source_type,
              source_identifier: src.source_identifier,
              is_dirty: dirtyInfo.isDirty,
              dirty_notes: dirtyInfo.notes,
            }),
            change_source: 'api',
            ip_address: null,
            user_agent: null,
          });
        }
      }

      auditRepo.create({
        work_order_id: workOrder.id,
        action_type: 'work_order_created',
        actor_id: req.created_by,
        actor_name: req.created_by_name,
        old_values: null,
        new_values: JSON.stringify({
          work_order_no: workOrder.work_order_no,
          device_code: workOrder.device_code,
          initial_conclusion: workOrder.initial_conclusion,
        }),
        change_source: 'ui',
        ip_address: null,
        user_agent: null,
      });

      let duplicateAlert: DuplicateDeviceAlert | null = null;
      const duplicates = this.detectDuplicateDevice(workOrder.device_code, workOrder.id);
      if (duplicates.length > 0) {
        duplicateAlert = dupRepo.create(workOrder.id, workOrder.device_code, duplicates);
        woRepo.suspend(
          workOrder.id,
          `设备编号重复，与工单 ${duplicates.join(', ')} 冲突，需现场老师确认。`
        );
        auditRepo.create({
          work_order_id: workOrder.id,
          action_type: 'duplicate_detected',
          actor_id: 'system',
          actor_name: '系统自动检测',
          old_values: JSON.stringify({ is_suspended: 0 }),
          new_values: JSON.stringify({
            is_suspended: 1,
            duplicate_with: duplicates,
            duplicate_device_code: workOrder.device_code,
          }),
          change_source: 'system',
          ip_address: null,
          user_agent: null,
        });
      }

      const refreshed = woRepo.findById(workOrder.id) as WorkOrder;
      return { work_order: refreshed, raw_logs: rawLogs, duplicate_alert: duplicateAlert };
    });

    return tx;
  }

  changeVerdict(req: ChangeVerdictRequest): {
    work_order: WorkOrder;
    verdict_history: VerdictHistory;
  } {
    const tx = db.transaction(() => {
      const order = woRepo.findById(req.work_order_id);
      if (!order) {
        throw new Error(`工单不存在: ${req.work_order_id}`);
      }
      if (order.is_suspended) {
        throw new Error('工单处于挂起状态，需先解决设备重复或其他挂起原因后再改判。');
      }
      if (order.is_rescinded) {
        throw new Error('工单已撤回，不可改判。');
      }
      if (order.current_conclusion === req.new_conclusion && !req.supplementary_material) {
        throw new Error('结论未变化且未提供新材料，无需改判。');
      }

      const oldConclusion = order.current_conclusion;
      const prevLogs = logRepo.findByWorkOrder(order.id);
      const prevSnapshot = JSON.stringify({
        temperature_value: order.temperature_value,
        raw_log_count: prevLogs.length,
        raw_log_ids: prevLogs.map(l => l.id),
        previous_conclusion: oldConclusion,
      });

      woRepo.updateConclusion(order.id, req.new_conclusion);

      const seqNo = historyRepo.getNextSequence(order.id);
      const historyEntry = historyRepo.create({
        work_order_id: order.id,
        sequence_no: seqNo,
        old_conclusion: oldConclusion,
        new_conclusion: req.new_conclusion,
        change_reason: req.change_reason,
        operator_id: req.operator_id,
        operator_name: req.operator_name,
        supplementary_material: req.supplementary_material ?? null,
        previous_material_snapshot: prevSnapshot,
        remark: req.remark ?? null,
      });

      auditRepo.create({
        work_order_id: order.id,
        action_type: 'verdict_changed',
        actor_id: req.operator_id,
        actor_name: req.operator_name,
        old_values: JSON.stringify({
          conclusion: oldConclusion,
          status: order.status,
        }),
        new_values: JSON.stringify({
          conclusion: req.new_conclusion,
          change_reason: req.change_reason,
          supplementary_material: !!req.supplementary_material,
          sequence_no: seqNo,
        }),
        change_source: 'ui',
        ip_address: null,
        user_agent: null,
      });

      const updated = woRepo.findById(order.id) as WorkOrder;
      return { work_order: updated, verdict_history: historyEntry };
    });

    return tx;
  }

  supplementMaterial(req: SupplementMaterialRequest): {
    work_order: WorkOrder;
    verdict_history: VerdictHistory | null;
    raw_log: RawSensorLog | null;
  } {
    const tx = db.transaction(() => {
      const order = woRepo.findById(req.work_order_id);
      if (!order) {
        throw new Error(`工单不存在: ${req.work_order_id}`);
      }
      if (order.is_rescinded) {
        throw new Error('工单已撤回，不可补录。');
      }

      const newMaterial = req.supplementary_material;
      const dirtyInfo = this.detectDirtyData(newMaterial);

      let attachedLog: RawSensorLog | null = null;
      if (newMaterial && newMaterial.trim().length > 0) {
        attachedLog = logRepo.attach(
          order.id,
          newMaterial,
          'manual_import',
          `supplement_${order.work_order_no}_${Date.now()}`,
          dirtyInfo.isDirty,
          dirtyInfo.notes
        );
        auditRepo.create({
          work_order_id: order.id,
          action_type: 'material_supplemented',
          actor_id: req.operator_id,
          actor_name: req.operator_name,
          old_values: null,
          new_values: JSON.stringify({
            material_length: newMaterial.length,
            is_dirty: dirtyInfo.isDirty,
            source: 'supplement',
          }),
          change_source: 'ui',
          ip_address: null,
          user_agent: null,
        });
      }

      let historyEntry: VerdictHistory | null = null;
      if (req.new_conclusion && req.new_conclusion !== order.current_conclusion) {
        if (order.is_suspended) {
          throw new Error('工单处于挂起状态，需先解除挂起才能改判结论。');
        }
        if (!req.change_reason) {
          throw new Error('补录后结论变化必须提供改判原因。');
        }

        const oldConclusion = order.current_conclusion;
        const prevLogs = logRepo.findByWorkOrder(order.id);
        const prevSnapshot = JSON.stringify({
          temperature_value: order.temperature_value,
          raw_log_count: prevLogs.length - (attachedLog ? 1 : 0),
          previous_conclusion: oldConclusion,
          new_material_added: !!attachedLog,
          old_material_sha256: this.sha256Of(
            prevLogs
              .filter(l => l.id !== attachedLog?.id)
              .map(l => l.raw_content)
              .join('\n')
          ),
        });

        woRepo.updateConclusion(order.id, req.new_conclusion);

        const seqNo = historyRepo.getNextSequence(order.id);
        historyEntry = historyRepo.create({
          work_order_id: order.id,
          sequence_no: seqNo,
          old_conclusion: oldConclusion,
          new_conclusion: req.new_conclusion,
          change_reason: req.change_reason,
          operator_id: req.operator_id,
          operator_name: req.operator_name,
          supplementary_material: newMaterial,
          previous_material_snapshot: prevSnapshot,
          remark: req.remark ?? null,
        });

        auditRepo.create({
          work_order_id: order.id,
          action_type: 'verdict_changed',
          actor_id: req.operator_id,
          actor_name: req.operator_name,
          old_values: JSON.stringify({
            conclusion: oldConclusion,
            triggered_by: 'material_supplement',
          }),
          new_values: JSON.stringify({
            conclusion: req.new_conclusion,
            change_reason: req.change_reason,
            sequence_no: seqNo,
          }),
          change_source: 'ui',
          ip_address: null,
          user_agent: null,
        });
      }

      const updated = woRepo.findById(order.id) as WorkOrder;
      return { work_order: updated, verdict_history: historyEntry, raw_log: attachedLog };
    });

    return tx;
  }

  resolveDuplicate(req: ResolveDuplicateRequest): {
    alert: DuplicateDeviceAlert;
    work_order: WorkOrder;
  } {
    const tx = db.transaction(() => {
      const alert = dupRepo.findById(req.alert_id);
      if (!alert) {
        throw new Error(`重复告警不存在: ${req.alert_id}`);
      }
      if (alert.resolved_at) {
        throw new Error('该重复告警已处理，不可重复处理。');
      }

      dupRepo.resolve(alert.id, req.resolution_type, req.resolution_note, req.resolved_by);

      let order = woRepo.findById(alert.work_order_id) as WorkOrder;

      if (req.resolution_type === 'mark_invalid') {
        woRepo.updateConclusion(order.id, 'duplicate_device');
        woRepo.updateStatus(order.id, 'closed');
        auditRepo.create({
          work_order_id: order.id,
          action_type: 'work_order_suspended',
          actor_id: req.resolved_by,
          actor_name: req.resolved_by_name,
          old_values: JSON.stringify({ is_suspended: 1 }),
          new_values: JSON.stringify({
            is_suspended: 0,
            resolution_type: 'mark_invalid',
            conclusion: 'duplicate_device',
          }),
          change_source: 'ui',
          ip_address: null,
          user_agent: null,
        });
      } else {
        woRepo.resume(order.id);
        auditRepo.create({
          work_order_id: order.id,
          action_type: 'duplicate_resolved',
          actor_id: req.resolved_by,
          actor_name: req.resolved_by_name,
          old_values: JSON.stringify({ is_suspended: 1 }),
          new_values: JSON.stringify({
            is_suspended: 0,
            resolution_type: req.resolution_type,
            resolution_note: req.resolution_note,
          }),
          change_source: 'ui',
          ip_address: null,
          user_agent: null,
        });
      }

      order = woRepo.findById(alert.work_order_id) as WorkOrder;
      const updatedAlert = dupRepo.findById(alert.id) as DuplicateDeviceAlert;

      return { alert: updatedAlert, work_order: order };
    });

    return tx;
  }

  rescindWorkOrder(req: RescindWorkOrderRequest): WorkOrder {
    const tx = db.transaction(() => {
      const order = woRepo.findById(req.work_order_id);
      if (!order) {
        throw new Error(`工单不存在: ${req.work_order_id}`);
      }
      if (order.is_rescinded) {
        throw new Error('工单已撤回，不可重复撤回。');
      }

      woRepo.rescind(order.id, req.rescind_reason, req.rescinded_by);

      auditRepo.create({
        work_order_id: order.id,
        action_type: 'work_order_rescinded',
        actor_id: req.rescinded_by,
        actor_name: req.rescinded_by_name,
        old_values: JSON.stringify({
          is_rescinded: 0,
          status: order.status,
          current_conclusion: order.current_conclusion,
        }),
        new_values: JSON.stringify({
          is_rescinded: 1,
          status: 'closed',
          rescind_reason: req.rescind_reason,
        }),
        change_source: 'ui',
        ip_address: null,
        user_agent: null,
      });

      return woRepo.findById(order.id) as WorkOrder;
    });

    return tx;
  }

  getWorkOrderDetail(id: string): {
    work_order: WorkOrder;
    raw_logs: RawSensorLog[];
    verdict_histories: VerdictHistory[];
    duplicate_alerts: DuplicateDeviceAlert[];
    audit_logs: any[];
  } {
    const order = woRepo.findById(id);
    if (!order) {
      throw new Error(`工单不存在: ${id}`);
    }
    return {
      work_order: order,
      raw_logs: logRepo.findByWorkOrder(id),
      verdict_histories: historyRepo.findByWorkOrder(id),
      duplicate_alerts: dupRepo.findByDeviceCode(order.device_code),
      audit_logs: auditRepo.findByWorkOrder(id),
    };
  }

  listWorkOrders(options?: any) {
    return woRepo.list(options);
  }

  listUnresolvedDuplicates() {
    return dupRepo.listUnresolved();
  }

  listAuditLogs(limit: number = 100) {
    return auditRepo.listAll(limit);
  }

  private calcConclusionByTemp(value: number, threshold: number): ConclusionType {
    if (value >= threshold * 1.1) {
      return 'overheat_alarm';
    } else if (value >= threshold) {
      return 'overheat_warning';
    } else if (value < threshold * 0.3) {
      return 'sensor_fault';
    } else {
      return 'normal';
    }
  }

  private detectDirtyData(content: string): { isDirty: boolean; notes: string } {
    const notes: string[] = [];
    if (!content || content.trim().length === 0) {
      return { isDirty: true, notes: '内容为空' };
    }
    if (content.includes('null') || content.includes('undefined')) {
      notes.push('包含 null/undefined 关键字');
    }
    if (content.includes('NaN')) {
      notes.push('包含 NaN 非数值标记');
    }
    if (/[^\x00-\x7F]/.test(content) === false && content.length < 10) {
      notes.push('内容过短（<10 ASCII字符），可能不完整');
    }
    const timeMatches = content.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g) || [];
    if (timeMatches.length === 0) {
      notes.push('未检测到时间戳，可能缺少采集时间');
    }
    const tempPattern = /(-?\d+(\.\d+)?)\s*[°º]?\s*[CF]/i;
    if (!tempPattern.test(content) && !/温度|temp/i.test(content)) {
      notes.push('未检测到温度数值或温度关键字');
    }
    return {
      isDirty: notes.length > 0,
      notes: notes.length > 0 ? notes.join('; ') : '',
    };
  }

  private detectDuplicateDevice(deviceCode: string, excludeId: string): string[] {
    const existing = woRepo.findByDeviceCode(deviceCode);
    return existing
      .filter(o => o.id !== excludeId && !o.is_rescinded)
      .map(o => o.work_order_no);
  }

  private sha256Of(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `fake_sha256_${Math.abs(hash)}_${text.length}`;
  }
}

export const workOrderService = new WorkOrderService();
