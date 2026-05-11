import { v4 as uuidv4 } from 'uuid';
import { 
  ReissueOrder, 
  ReissueStatus, 
  User, 
  FailedOperation,
  OperationType
} from '../../shared/types';
import { getDatabase } from '../database';
import { changeOrderStatus, getOrderById } from './reorderService';
import { createAuditLog } from './auditService';
import { MAX_RETRY_COUNT } from '../../shared/constants';

export function batchChangeStatus(
  orderIds: string[],
  newStatus: ReissueStatus,
  changeReason: string | null,
  operator: User
): { success: string[]; failed: Array<{ orderId: string; error: string }> } {
  const success: string[] = [];
  const failed: Array<{ orderId: string; error: string }> = [];
  
  orderIds.forEach(orderId => {
    try {
      changeOrderStatus(orderId, newStatus, changeReason, operator);
      success.push(orderId);
    } catch (error: any) {
      failed.push({ orderId, error: error.message });
      recordFailedOperation(orderId, 'status_change', error.message);
    }
  });
  
  createAuditLog({
    operationType: OperationType.UPDATE,
    targetType: 'order',
    targetId: null,
    userId: operator.id,
    userName: operator.name,
    detail: `批量更新订单状态: ${newStatus}, 成功: ${success.length}, 失败: ${failed.length}`,
    success: failed.length === 0,
    errorMessage: failed.length > 0 ? `有 ${failed.length} 个订单更新失败` : undefined
  });
  
  return { success, failed };
}

export function batchAssignOrders(
  orderIds: string[],
  assigneeId: string,
  assigneeName: string,
  operator: User
): { success: string[]; failed: Array<{ orderId: string; error: string }> } {
  const db = getDatabase();
  const now = new Date().toISOString();
  const success: string[] = [];
  const failed: Array<{ orderId: string; error: string }> = [];
  
  const stmt = db.prepare(`
    UPDATE reissue_orders 
    SET assignee_id = ?, assignee_name = ?, updated_at = ?
    WHERE id = ?
  `);
  
  orderIds.forEach(orderId => {
    try {
      const order = getOrderById(orderId);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      stmt.run(assigneeId, assigneeName, now, orderId);
      success.push(orderId);
    } catch (error: any) {
      failed.push({ orderId, error: error.message });
    }
  });
  
  createAuditLog({
    operationType: OperationType.UPDATE,
    targetType: 'order',
    targetId: null,
    userId: operator.id,
    userName: operator.name,
    detail: `批量分配订单: ${assigneeName}, 成功: ${success.length}, 失败: ${failed.length}`,
    success: failed.length === 0,
    errorMessage: failed.length > 0 ? `有 ${failed.length} 个订单分配失败` : undefined
  });
  
  return { success, failed };
}

export function recordFailedOperation(
  targetId: string,
  operationType: string,
  errorMessage: string
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const existing = db.prepare(`
    SELECT id, retry_count as retryCount FROM failed_operations 
    WHERE target_id = ? AND operation_type = ?
  `).get(targetId, operationType) as any;
  
  if (existing) {
    const newRetryCount = existing.retryCount + 1;
    db.prepare(`
      UPDATE failed_operations 
      SET retry_count = ?, last_attempt_at = ?, error_message = ?
      WHERE id = ?
    `).run(newRetryCount, now, errorMessage, existing.id);
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO failed_operations (
        id, operation_type, target_id, error_message,
        retry_count, max_retries, last_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, operationType, targetId, errorMessage, MAX_RETRY_COUNT, now, now);
  }
}

export function listFailedOperations(): FailedOperation[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT 
      id, operation_type as operationType, target_id as targetId,
      error_message as errorMessage, retry_count as retryCount,
      max_retries as maxRetries, last_attempt_at as lastAttemptAt,
      created_at as createdAt
    FROM failed_operations
    ORDER BY last_attempt_at DESC
  `).all() as any[];
  
  return rows.map(row => ({
    ...row,
    retryCount: Number(row.retryCount),
    maxRetries: Number(row.maxRetries)
  }));
}

export function retryFailedOperation(failedOpId: string, operator: User): { success: boolean; message: string } {
  const db = getDatabase();
  const failedOp = db.prepare(`
    SELECT * FROM failed_operations WHERE id = ?
  `).get(failedOpId) as any;
  
  if (!failedOp) {
    return { success: false, message: '失败操作记录不存在' };
  }
  
  try {
    if (failedOp.operation_type === 'status_change') {
      const order = getOrderById(failedOp.target_id);
      if (!order) {
        throw new Error('订单不存在');
      }
      
      if (order.status === ReissueStatus.FAILED) {
        changeOrderStatus(failedOp.target_id, ReissueStatus.PROCESSING, '重试处理', operator);
      } else {
        return { success: false, message: '订单状态不是失败状态，无法重试' };
      }
    }
    
    db.prepare('DELETE FROM failed_operations WHERE id = ?').run(failedOpId);
    
    createAuditLog({
      operationType: OperationType.RETRY,
      targetType: 'failed_operation',
      targetId: failedOpId,
      userId: operator.id,
      userName: operator.name,
      detail: `重试失败操作: ${failedOp.operation_type}`,
      success: true
    });
    
    return { success: true, message: '重试成功' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export function clearFailedOperation(failedOpId: string, operator: User): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM failed_operations WHERE id = ?').run(failedOpId);
  
  if (result.changes > 0) {
    createAuditLog({
      operationType: OperationType.DELETE,
      targetType: 'failed_operation',
      targetId: failedOpId,
      userId: operator.id,
      userName: operator.name,
      detail: `清除失败操作记录`,
      success: true
    });
    return true;
  }
  
  return false;
}
