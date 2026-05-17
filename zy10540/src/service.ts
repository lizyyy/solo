import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from './database';
import {
  DeviceRebind,
  RebindStatus,
  CreateRebindRequest,
  QueryRebindRequest,
  StatusTransitionRequest,
  ManualFixRequest,
  STATUS_TRANSITIONS
} from './types';

export class DeviceRebindService {
  async createRebind(request: CreateRebindRequest): Promise<DeviceRebind> {
    const id = uuidv4();
    const originalInput = JSON.stringify(request);
    
    const warrantyValid = await this.checkWarranty(request.device_code);
    const rebindHistory = await this.getDeviceHistory(request.device_code);
    
    const sql = `
      INSERT INTO device_rebind (
        id, device_code, old_store_id, old_store_name, new_store_id, new_store_name,
        repair_order_id, rebind_reason, rebind_report, status, warranty_valid,
        created_by, original_input, processing_evidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      request.device_code,
      request.old_store_id,
      request.old_store_name || '',
      request.new_store_id,
      request.new_store_name || '',
      request.repair_order_id || '',
      request.rebind_reason,
      request.rebind_report || '',
      RebindStatus.PENDING,
      warrantyValid,
      request.created_by || '',
      originalInput,
      JSON.stringify({ history_count: rebindHistory.length, warranty_checked: true })
    ];
    
    await runQuery(sql, params);
    await this.addHistory(id, request.device_code, request.old_store_id, request.new_store_id, RebindStatus.PENDING, request.created_by, '创建换绑申请');
    
    return this.getRebindById(id);
  }

  async getRebindById(id: string): Promise<DeviceRebind> {
    const sql = 'SELECT * FROM device_rebind WHERE id = ?';
    return getQuery(sql, [id]);
  }

  async queryRebinds(request: QueryRebindRequest): Promise<{ list: DeviceRebind[], total: number }> {
    let whereClauses: string[] = [];
    let params: any[] = [];
    
    if (request.device_code) {
      whereClauses.push('device_code = ?');
      params.push(request.device_code);
    }
    if (request.old_store_id) {
      whereClauses.push('old_store_id = ?');
      params.push(request.old_store_id);
    }
    if (request.new_store_id) {
      whereClauses.push('new_store_id = ?');
      params.push(request.new_store_id);
    }
    if (request.status) {
      whereClauses.push('status = ?');
      params.push(request.status);
    }
    if (request.repair_order_id) {
      whereClauses.push('repair_order_id = ?');
      params.push(request.repair_order_id);
    }
    if (request.start_date) {
      whereClauses.push('created_at >= ?');
      params.push(request.start_date);
    }
    if (request.end_date) {
      whereClauses.push('created_at <= ?');
      params.push(request.end_date);
    }
    
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    const countSql = `SELECT COUNT(*) as total FROM device_rebind ${whereSql}`;
    const countResult = await getQuery(countSql, params);
    
    const page = request.page || 1;
    const pageSize = request.page_size || 20;
    const offset = (page - 1) * pageSize;
    
    const listSql = `SELECT * FROM device_rebind ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listParams = [...params, pageSize, offset];
    const list = await allQuery(listSql, listParams);
    
    return { list, total: countResult.total };
  }

  async transitionStatus(request: StatusTransitionRequest): Promise<DeviceRebind> {
    const rebind = await this.getRebindById(request.rebind_id);
    if (!rebind) {
      throw new Error('换绑记录不存在');
    }

    if (rebind.status === request.target_status) {
      throw new Error('状态未发生变化，无需重复提交');
    }

    const allowedTransitions = STATUS_TRANSITIONS[rebind.status];
    if (!allowedTransitions.includes(request.target_status)) {
      throw new Error(`不允许从 ${rebind.status} 状态转换到 ${request.target_status} 状态`);
    }

    const duplicateCheckSql = `
      SELECT 1 FROM rebind_history 
      WHERE rebind_id = ? AND status = ? AND operated_at >= datetime('now', '-1 minute')
    `;
    const duplicate = await getQuery(duplicateCheckSql, [request.rebind_id, request.target_status]);
    if (duplicate) {
      throw new Error('该状态转换操作已在1分钟内执行过，请勿重复提交');
    }

    const updateSql = `
      UPDATE device_rebind 
      SET status = ?, updated_at = CURRENT_TIMESTAMP, processing_evidence = ?
      WHERE id = ?
    `;
    const evidence = JSON.stringify({
      previous_status: rebind.status,
      target_status: request.target_status,
      remark: request.remark,
      operator: request.operated_by,
      additional_evidence: request.processing_evidence
    });
    
    await runQuery(updateSql, [request.target_status, evidence, request.rebind_id]);
    await this.addHistory(
      request.rebind_id,
      rebind.device_code,
      rebind.old_store_id,
      rebind.new_store_id,
      request.target_status,
      request.operated_by,
      request.remark || `状态从 ${rebind.status} 变更为 ${request.target_status}`
    );

    return this.getRebindById(request.rebind_id);
  }

  async handleException(rebindId: string, exceptionReason: string, operatedBy: string): Promise<DeviceRebind> {
    const rebind = await this.getRebindById(rebindId);
    if (!rebind) {
      throw new Error('换绑记录不存在');
    }

    const updateSql = `
      UPDATE device_rebind 
      SET status = ?, exception_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await runQuery(updateSql, [RebindStatus.EXCEPTION, exceptionReason, rebindId]);
    await this.addHistory(
      rebindId,
      rebind.device_code,
      rebind.old_store_id,
      rebind.new_store_id,
      RebindStatus.EXCEPTION,
      operatedBy,
      `异常处理: ${exceptionReason}`
    );

    return this.getRebindById(rebindId);
  }

  async manualFix(request: ManualFixRequest): Promise<DeviceRebind> {
    const rebind = await this.getRebindById(request.rebind_id);
    if (!rebind) {
      throw new Error('换绑记录不存在');
    }

    const originalData = { ...rebind };
    const updateFields: string[] = [];
    const updateParams: any[] = [];

    if (request.device_code !== undefined) {
      updateFields.push('device_code = ?');
      updateParams.push(request.device_code);
    }
    if (request.old_store_id !== undefined) {
      updateFields.push('old_store_id = ?');
      updateParams.push(request.old_store_id);
    }
    if (request.old_store_name !== undefined) {
      updateFields.push('old_store_name = ?');
      updateParams.push(request.old_store_name);
    }
    if (request.new_store_id !== undefined) {
      updateFields.push('new_store_id = ?');
      updateParams.push(request.new_store_id);
    }
    if (request.new_store_name !== undefined) {
      updateFields.push('new_store_name = ?');
      updateParams.push(request.new_store_name);
    }
    if (request.repair_order_id !== undefined) {
      updateFields.push('repair_order_id = ?');
      updateParams.push(request.repair_order_id);
    }
    if (request.rebind_reason !== undefined) {
      updateFields.push('rebind_reason = ?');
      updateParams.push(request.rebind_reason);
    }
    if (request.rebind_report !== undefined) {
      updateFields.push('rebind_report = ?');
      updateParams.push(request.rebind_report);
    }

    updateFields.push('status = ?');
    updateParams.push(RebindStatus.MANUAL_FIXED);
    updateFields.push('processing_evidence = ?');
    updateParams.push(JSON.stringify({
      original_data: originalData,
      fix_remark: request.fix_remark,
      operated_by: request.operated_by
    }));
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(request.rebind_id);

    const updateSql = `UPDATE device_rebind SET ${updateFields.join(', ')} WHERE id = ?`;
    await runQuery(updateSql, updateParams);

    await this.addHistory(
      request.rebind_id,
      request.device_code || rebind.device_code,
      request.old_store_id || rebind.old_store_id,
      request.new_store_id || rebind.new_store_id,
      RebindStatus.MANUAL_FIXED,
      request.operated_by,
      `人工修正: ${request.fix_remark}`
    );

    return this.getRebindById(request.rebind_id);
  }

  async exportRebinds(request: QueryRebindRequest): Promise<DeviceRebind[]> {
    const result = await this.queryRebinds({ ...request, page: 1, page_size: 10000 });
    return result.list;
  }

  async getDeviceHistory(deviceCode: string): Promise<any[]> {
    const sql = 'SELECT * FROM device_rebind WHERE device_code = ? ORDER BY created_at DESC';
    return allQuery(sql, [deviceCode]);
  }

  async getRebindHistory(rebindId: string): Promise<any[]> {
    const sql = 'SELECT * FROM rebind_history WHERE rebind_id = ? ORDER BY operated_at DESC';
    return allQuery(sql, [rebindId]);
  }

  private async checkWarranty(deviceCode: string): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count 
      FROM device_rebind 
      WHERE device_code = ? AND status IN ('approved', 'completed', 'manual_fixed')
    `;
    const result = await getQuery(sql, [deviceCode]);
    return result.count < 3;
  }

  private async addHistory(
    rebindId: string, deviceCode: string, oldStoreId: string, newStoreId: string, status: RebindStatus, operatedBy?: string, remark?: string): Promise<void> {
    const id = uuidv4();
    const sql = `
      INSERT INTO rebind_history (id, rebind_id, device_code, old_store_id, new_store_id, status, operated_by, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(sql, [id, rebindId, deviceCode, oldStoreId, newStoreId, status, operatedBy || '', remark || '']);
  }
}

export const deviceRebindService = new DeviceRebindService();
