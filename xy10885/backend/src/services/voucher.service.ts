import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import { AppointmentVoucher } from '../models/types';
import { createOperationLog } from './operationLog.service';

function generateVoucherCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `APT-${timestamp}-${random}`;
}

export async function createVoucher(voucherData: {
  lock_id: string;
  slot_id: string;
  patient_id: string;
  patient_name: string;
  operator_id?: string;
  operator_name?: string;
}): Promise<AppointmentVoucher> {
  const id = uuidv4();
  const voucher_code = generateVoucherCode();
  
  try {
    await runQuery(
      `INSERT INTO appointment_vouchers (
        id, lock_id, slot_id, patient_id, patient_name, voucher_code, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'valid')`,
      [
        id,
        voucherData.lock_id,
        voucherData.slot_id,
        voucherData.patient_id,
        voucherData.patient_name,
        voucher_code
      ]
    );
    
    const voucher = await getQuery('SELECT * FROM appointment_vouchers WHERE id = ?', [id]);
    
    await createOperationLog({
      operation_type: 'create_voucher',
      entity_type: 'voucher',
      entity_id: id,
      operator_id: voucherData.operator_id,
      operator_name: voucherData.operator_name,
      after_state: voucher,
      result: 'success'
    });
    
    return voucher;
  } catch (error: any) {
    await createOperationLog({
      operation_type: 'create_voucher',
      entity_type: 'voucher',
      entity_id: id,
      operator_id: voucherData.operator_id,
      operator_name: voucherData.operator_name,
      result: 'failed',
      error_message: error.message
    });
    throw error;
  }
}

export async function getVoucherById(id: string): Promise<AppointmentVoucher | null> {
  return getQuery('SELECT * FROM appointment_vouchers WHERE id = ?', [id]);
}

export async function getVoucherByCode(code: string): Promise<AppointmentVoucher | null> {
  return getQuery('SELECT * FROM appointment_vouchers WHERE voucher_code = ?', [code]);
}

export async function getVouchers(params: {
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
    `SELECT COUNT(*) as total FROM appointment_vouchers ${whereClause}`,
    queryParams
  );
  
  const data = await allQuery(
    `SELECT * FROM appointment_vouchers ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  
  return {
    data,
    total: countResult.total,
    page,
    pageSize
  };
}

export async function checkInVoucher(voucherId: string, operator?: { id: string; name: string }) {
  const voucher = await getVoucherById(voucherId);
  if (!voucher) throw new Error('预约凭证不存在');
  if (voucher.status !== 'valid') throw new Error('该凭证状态异常，无法签到');
  
  const beforeState = { ...voucher };
  
  await runQuery(
    'UPDATE appointment_vouchers SET status = "used", check_in_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [voucherId]
  );
  
  const updatedVoucher = await getVoucherById(voucherId);
  
  await createOperationLog({
    operation_type: 'check_in',
    entity_type: 'voucher',
    entity_id: voucherId,
    operator_id: operator?.id,
    operator_name: operator?.name,
    before_state: beforeState,
    after_state: updatedVoucher,
    result: 'success'
  });
  
  return updatedVoucher;
}

export async function cancelVoucher(voucherId: string, operator?: { id: string; name: string }) {
  const voucher = await getVoucherById(voucherId);
  if (!voucher) throw new Error('预约凭证不存在');
  if (voucher.status === 'cancelled') throw new Error('该凭证已取消');
  if (voucher.status === 'used') throw new Error('该凭证已使用，无法取消');
  
  const beforeState = { ...voucher };
  
  await runQuery(
    'UPDATE appointment_vouchers SET status = "cancelled", cancel_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [voucherId]
  );
  
  const { releaseLock } = await import('./lock.service');
  await releaseLock(voucher.lock_id, {
    reason: '预约凭证取消，释放号源',
    release_type: 'cancel',
    operator_id: operator?.id,
    operator_name: operator?.name
  });
  
  const updatedVoucher = await getVoucherById(voucherId);
  
  await createOperationLog({
    operation_type: 'cancel_voucher',
    entity_type: 'voucher',
    entity_id: voucherId,
    operator_id: operator?.id,
    operator_name: operator?.name,
    before_state: beforeState,
    after_state: updatedVoucher,
    result: 'success'
  });
  
  return updatedVoucher;
}
