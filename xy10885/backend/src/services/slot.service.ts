import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import { DepartmentSlot, PaginatedResponse } from '../models/types';
import { createOperationLog } from './operationLog.service';

export async function createSlot(slotData: {
  department_id: string;
  department_name: string;
  external_system_id: string;
  date: string;
  time_slot: string;
  total_count: number;
}): Promise<DepartmentSlot> {
  const id = uuidv4();
  const available_count = slotData.total_count;
  
  try {
    await runQuery(
      `INSERT INTO department_slots (
        id, department_id, department_name, external_system_id, date, time_slot,
        total_count, available_count, locked_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'available')`,
      [
        id,
        slotData.department_id,
        slotData.department_name,
        slotData.external_system_id,
        slotData.date,
        slotData.time_slot,
        slotData.total_count,
        available_count
      ]
    );
    
    const slot = await getQuery('SELECT * FROM department_slots WHERE id = ?', [id]);
    
    await createOperationLog({
      operation_type: 'create',
      entity_type: 'slot',
      entity_id: id,
      result: 'success',
      after_state: slot
    });
    
    return slot;
  } catch (error: any) {
    await createOperationLog({
      operation_type: 'create',
      entity_type: 'slot',
      entity_id: id,
      result: 'failed',
      error_message: error.message
    });
    throw error;
  }
}

export async function getSlots(params: {
  department_id?: string;
  external_system_id?: string;
  date?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PaginatedResponse<DepartmentSlot>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  let whereConditions: string[] = [];
  let queryParams: any[] = [];
  
  if (params.department_id) {
    whereConditions.push('department_id = ?');
    queryParams.push(params.department_id);
  }
  if (params.external_system_id) {
    whereConditions.push('external_system_id = ?');
    queryParams.push(params.external_system_id);
  }
  if (params.date) {
    whereConditions.push('date = ?');
    queryParams.push(params.date);
  }
  if (params.status) {
    whereConditions.push('status = ?');
    queryParams.push(params.status);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const countResult = await getQuery(
    `SELECT COUNT(*) as total FROM department_slots ${whereClause}`,
    queryParams
  );
  
  const data = await allQuery(
    `SELECT * FROM department_slots ${whereClause} ORDER BY date DESC, time_slot ASC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  
  return {
    data,
    total: countResult.total,
    page,
    pageSize
  };
}

export async function getSlotById(id: string): Promise<DepartmentSlot | null> {
  return getQuery('SELECT * FROM department_slots WHERE id = ?', [id]);
}

export async function updateSlotAvailability(slotId: string, operator?: { id: string; name: string }) {
  const slot = await getSlotById(slotId);
  if (!slot) throw new Error('号源不存在');
  
  const beforeState = { ...slot };
  const newStatus = slot.available_count <= 0 ? 'full' : 'available';
  
  await runQuery(
    'UPDATE department_slots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, slotId]
  );
  
  const updatedSlot = await getSlotById(slotId);
  
  await createOperationLog({
    operation_type: 'update_availability',
    entity_type: 'slot',
    entity_id: slotId,
    operator_id: operator?.id,
    operator_name: operator?.name,
    before_state: beforeState,
    after_state: updatedSlot,
    result: 'success'
  });
  
  return updatedSlot;
}

export async function pullSlotsFromSystem(externalSystemId: string, date: string, operator?: { id: string; name: string }) {
  const system = await getQuery('SELECT * FROM external_systems WHERE id = ?', [externalSystemId]);
  if (!system) throw new Error('外部系统不存在');
  
  const mockSlots = [
    { department_id: 'DEPT001', department_name: '内科', time_slot: '08:00-09:00', total_count: 15 },
    { department_id: 'DEPT001', department_name: '内科', time_slot: '09:00-10:00', total_count: 15 },
    { department_id: 'DEPT002', department_name: '外科', time_slot: '08:00-09:00', total_count: 10 },
    { department_id: 'DEPT002', department_name: '外科', time_slot: '09:00-10:00', total_count: 10 },
    { department_id: 'DEPT003', department_name: '儿科', time_slot: '08:00-09:00', total_count: 20 },
  ];
  
  const results = [];
  for (const mockSlot of mockSlots) {
    try {
      const existing = await getQuery(
        'SELECT * FROM department_slots WHERE department_id = ? AND external_system_id = ? AND date = ? AND time_slot = ?',
        [mockSlot.department_id, externalSystemId, date, mockSlot.time_slot]
      );
      
      if (existing) {
        await runQuery(
          'UPDATE department_slots SET total_count = ?, available_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [mockSlot.total_count, mockSlot.total_count - existing.locked_count, existing.id]
        );
        results.push({ id: existing.id, action: 'updated' });
      } else {
        const slot = await createSlot({
          ...mockSlot,
          external_system_id: externalSystemId,
          date
        });
        results.push({ id: slot.id, action: 'created' });
      }
    } catch (error: any) {
      results.push({ error: error.message, slot: mockSlot });
    }
  }
  
  await createOperationLog({
    operation_type: 'pull_slots',
    entity_type: 'external_system',
    entity_id: externalSystemId,
    operator_id: operator?.id,
    operator_name: operator?.name,
    after_state: { pulled: results.length },
    result: 'success'
  });
  
  return { pulled: results.length, results };
}

export async function getSlotTimeline(slotId: string) {
  const slot = await getSlotById(slotId);
  if (!slot) throw new Error('号源不存在');
  
  const locks = await allQuery('SELECT * FROM lock_records WHERE slot_id = ? ORDER BY created_at DESC', [slotId]);
  const releases = await allQuery(
    `SELECT re.*, lr.patient_name, lr.patient_id 
     FROM release_events re 
     JOIN lock_records lr ON re.lock_id = lr.id 
     WHERE lr.slot_id = ? 
     ORDER BY re.created_at DESC`,
    [slotId]
  );
  const conflicts = await allQuery('SELECT * FROM conflict_records WHERE slot_id = ? ORDER BY created_at DESC', [slotId]);
  const vouchers = await allQuery('SELECT * FROM appointment_vouchers WHERE slot_id = ? ORDER BY created_at DESC', [slotId]);
  const logs = await allQuery(
    'SELECT * FROM operation_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    ['slot', slotId]
  );
  
  return {
    slot,
    locks,
    releases,
    conflicts,
    vouchers,
    logs
  };
}
