import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import { runQuery, getQuery, allQuery } from '../database';
import { LockRecord } from '../models/types';
import { createOperationLog } from './operationLog.service';
import { getSlotById, updateSlotAvailability } from './slot.service';
import { createConflictRecord } from './conflict.service';

export const LOCK_TIMEOUT_MINUTES = 15;

export async function createLock(lockData: {
  slot_id: string;
  patient_id: string;
  patient_name: string;
  operator_id?: string;
  operator_name?: string;
  lock_type?: 'temporary' | 'permanent';
}): Promise<LockRecord> {
  const slot = await getSlotById(lockData.slot_id);
  if (!slot) throw new Error('号源不存在');
  
  if (slot.available_count <= 0) {
    throw new Error('号源已约满');
  }
  
  const existingLock = await getQuery(
    'SELECT * FROM lock_records WHERE slot_id = ? AND patient_id = ? AND status = "locked"',
    [lockData.slot_id, lockData.patient_id]
  );
  if (existingLock) {
    await createConflictRecord({
      slot_id: lockData.slot_id,
      patient_id: lockData.patient_id,
      patient_name: lockData.patient_name,
      conflict_type: 'dup_patient',
      description: '该患者已锁定此号源'
    });
    throw new Error('该患者已锁定此号源，请勿重复操作');
  }
  
  const id = uuidv4();
  const expires_at = lockData.lock_type === 'permanent' 
    ? addMinutes(new Date(), 1440).toISOString()
    : addMinutes(new Date(), LOCK_TIMEOUT_MINUTES).toISOString();
  
  try {
    await runQuery('BEGIN TRANSACTION');
    
    await runQuery(
      `INSERT INTO lock_records (
        id, slot_id, patient_id, patient_name, operator_id, operator_name,
        lock_type, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'locked', ?)`,
      [
        id,
        lockData.slot_id,
        lockData.patient_id,
        lockData.patient_name,
        lockData.operator_id,
        lockData.operator_name,
        lockData.lock_type || 'temporary',
        expires_at
      ]
    );
    
    await runQuery(
      'UPDATE department_slots SET available_count = available_count - 1, locked_count = locked_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [lockData.slot_id]
    );
    
    await runQuery('COMMIT');
    
    const lock = await getQuery('SELECT * FROM lock_records WHERE id = ?', [id]);
    await updateSlotAvailability(lockData.slot_id);
    
    await createOperationLog({
      operation_type: 'create_lock',
      entity_type: 'lock',
      entity_id: id,
      operator_id: lockData.operator_id,
      operator_name: lockData.operator_name,
      after_state: lock,
      result: 'success'
    });
    
    return lock;
  } catch (error) {
    await runQuery('ROLLBACK');
    await createOperationLog({
      operation_type: 'create_lock',
      entity_type: 'lock',
      entity_id: id,
      operator_id: lockData.operator_id,
      operator_name: lockData.operator_name,
      result: 'failed',
      error_message: error instanceof Error ? error.message : '未知错误'
    });
    throw error;
  }
}

export async function releaseLock(lockId: string, releaseData: {
  reason: string;
  release_type: 'timeout' | 'manual' | 'cancel' | 'system';
  operator_id?: string;
  operator_name?: string;
}) {
  const lock = await getQuery('SELECT * FROM lock_records WHERE id = ?', [lockId]);
  if (!lock) throw new Error('锁号记录不存在');
  if (lock.status !== 'locked') throw new Error('该锁号已释放或已确认');
  
  try {
    await runQuery('BEGIN TRANSACTION');
    
    await runQuery(
      'UPDATE lock_records SET status = "released", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [lockId]
    );
    
    await runQuery(
      'UPDATE department_slots SET available_count = available_count + 1, locked_count = locked_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [lock.slot_id]
    );
    
    const releaseId = uuidv4();
    await runQuery(
      `INSERT INTO release_events (id, lock_id, reason, release_type, operator_id, operator_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        releaseId,
        lockId,
        releaseData.reason,
        releaseData.release_type,
        releaseData.operator_id,
        releaseData.operator_name
      ]
    );
    
    await runQuery('COMMIT');
    
    await updateSlotAvailability(lock.slot_id);
    
    const updatedLock = await getQuery('SELECT * FROM lock_records WHERE id = ?', [lockId]);
    
    await createOperationLog({
      operation_type: 'release_lock',
      entity_type: 'lock',
      entity_id: lockId,
      operator_id: releaseData.operator_id,
      operator_name: releaseData.operator_name,
      before_state: lock,
      after_state: updatedLock,
      result: 'success'
    });
    
    return { lock: updatedLock, releaseId };
  } catch (error) {
    await runQuery('ROLLBACK');
    throw error;
  }
}

export async function getLockById(id: string): Promise<LockRecord | null> {
  return getQuery('SELECT * FROM lock_records WHERE id = ?', [id]);
}

export async function getLocks(params: {
  slot_id?: string;
  patient_id?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  let whereConditions: string[] = [];
  let queryParams: any[] = [];
  
  if (params.slot_id) {
    whereConditions.push('slot_id = ?');
    queryParams.push(params.slot_id);
  }
  if (params.patient_id) {
    whereConditions.push('patient_id = ?');
    queryParams.push(params.patient_id);
  }
  if (params.status) {
    whereConditions.push('status = ?');
    queryParams.push(params.status);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const countResult = await getQuery(
    `SELECT COUNT(*) as total FROM lock_records ${whereClause}`,
    queryParams
  );
  
  const data = await allQuery(
    `SELECT * FROM lock_records ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  
  return {
    data,
    total: countResult.total,
    page,
    pageSize
  };
}

export async function checkAndReleaseExpiredLocks() {
  const now = new Date().toISOString();
  const expiredLocks = await allQuery(
    'SELECT * FROM lock_records WHERE status = "locked" AND expires_at < ?',
    [now]
  );
  
  const results = [];
  for (const lock of expiredLocks) {
    try {
      await releaseLock(lock.id, {
        reason: '锁号超时自动释放',
        release_type: 'timeout'
      });
      results.push({ lockId: lock.id, success: true });
    } catch (error: any) {
      results.push({ lockId: lock.id, success: false, error: error.message });
    }
  }
  
  return { released: results.length, results };
}

export async function confirmLockToVoucher(lockId: string, operator?: { id: string; name: string }) {
  const lock = await getLockById(lockId);
  if (!lock) throw new Error('锁号记录不存在');
  if (lock.status !== 'locked') throw new Error('该锁号状态异常，无法生成凭证');
  
  const { createVoucher } = await import('./voucher.service');
  
  const voucher = await createVoucher({
    lock_id: lockId,
    slot_id: lock.slot_id,
    patient_id: lock.patient_id,
    patient_name: lock.patient_name,
    operator_id: operator?.id,
    operator_name: operator?.name
  });
  
  await runQuery(
    'UPDATE lock_records SET status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [lockId]
  );
  
  await createOperationLog({
    operation_type: 'confirm_to_voucher',
    entity_type: 'lock',
    entity_id: lockId,
    operator_id: operator?.id,
    operator_name: operator?.name,
    result: 'success'
  });
  
  return voucher;
}
