import { runQuery, getOne, getAll } from '../database';
import { Complaint, ReworkRecord, CleaningStatus, ComplaintStatus, ReworkStatus } from '../types';

export const updateCleaningStatus = async (
  id: number,
  newStatus: CleaningStatus,
  remarks?: string
): Promise<boolean> => {
  const validTransitions: Record<CleaningStatus, CleaningStatus[]> = {
    [CleaningStatus.PENDING]: [CleaningStatus.IN_PROGRESS, CleaningStatus.CLOSED],
    [CleaningStatus.IN_PROGRESS]: [CleaningStatus.COMPLETED, CleaningStatus.NEEDS_REWORK, CleaningStatus.CLOSED],
    [CleaningStatus.COMPLETED]: [CleaningStatus.NEEDS_REWORK, CleaningStatus.CLOSED],
    [CleaningStatus.NEEDS_REWORK]: [CleaningStatus.IN_PROGRESS, CleaningStatus.CLOSED],
    [CleaningStatus.CLOSED]: []
  };
  
  const current = await getOne<any>('SELECT status FROM cleaning_records WHERE id = ?', [id]);
  if (!current) throw new Error('保洁记录不存在');
  
  if (!validTransitions[current.status].includes(newStatus)) {
    throw new Error(`状态转换不允许: ${current.status} -> ${newStatus}`);
  }
  
  const result = await runQuery(
    'UPDATE cleaning_records SET status = ?, remarks = COALESCE(?, remarks), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, remarks || null, id]
  );
  
  return result.changes > 0;
};

export const updateComplaintStatus = async (
  id: number,
  newStatus: ComplaintStatus,
  resolution?: string,
  handler?: string
): Promise<boolean> => {
  const validTransitions: Record<ComplaintStatus, ComplaintStatus[]> = {
    [ComplaintStatus.OPEN]: [ComplaintStatus.PROCESSING, ComplaintStatus.RESOLVED],
    [ComplaintStatus.PROCESSING]: [ComplaintStatus.RESOLVED, ComplaintStatus.ESCALATED],
    [ComplaintStatus.RESOLVED]: [],
    [ComplaintStatus.ESCALATED]: [ComplaintStatus.RESOLVED]
  };
  
  const current = await getOne<any>('SELECT status FROM complaints WHERE id = ?', [id]);
  if (!current) throw new Error('客诉记录不存在');
  
  if (!validTransitions[current.status].includes(newStatus)) {
    throw new Error(`状态转换不允许: ${current.status} -> ${newStatus}`);
  }
  
  const resolutionDate = newStatus === ComplaintStatus.RESOLVED ? 
    new Date().toISOString().split('T')[0] : null;
  
  const result = await runQuery(
    `UPDATE complaints SET 
       status = ?, resolution = COALESCE(?, resolution), 
       handler = COALESCE(?, handler), resolution_date = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newStatus, resolution || null, handler || null, resolutionDate, id]
  );
  
  return result.changes > 0;
};

export const createComplaintFromCleaning = async (
  cleaningId: number,
  category: Complaint['category'],
  description: string,
  guestName?: string,
  guestPhone?: string
): Promise<number> => {
  const cleaning = await getOne<any>(
    'SELECT room_number, scheduled_date FROM cleaning_records WHERE id = ?',
    [cleaningId]
  );
  
  if (!cleaning) throw new Error('保洁记录不存在');
  
  const result = await runQuery(
    `INSERT INTO complaints 
      (room_number, guest_name, guest_phone, complaint_date, category, description, related_cleaning_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      cleaning.room_number,
      guestName,
      guestPhone,
      new Date().toISOString().split('T')[0],
      category,
      description,
      cleaningId
    ]
  );
  
  await updateCleaningStatus(cleaningId, CleaningStatus.NEEDS_REWORK, '关联客诉，需要返工');
  
  return result.lastID;
};

export const createReworkRecord = async (
  cleaningId: number,
  reworkReason: string,
  reworkerName: string,
  reworkDate?: string
): Promise<number> => {
  const cleaning = await getOne<any>(
    'SELECT room_number FROM cleaning_records WHERE id = ?',
    [cleaningId]
  );
  
  if (!cleaning) throw new Error('保洁记录不存在');
  
  const result = await runQuery(
    `INSERT INTO rework_records 
      (related_cleaning_id, room_number, rework_reason, rework_date, reworker_name)
     VALUES (?, ?, ?, ?, ?)`,
    [
      cleaningId,
      cleaning.room_number,
      reworkReason,
      reworkDate || new Date().toISOString().split('T')[0],
      reworkerName
    ]
  );
  
  await updateCleaningStatus(cleaningId, CleaningStatus.NEEDS_REWORK, reworkReason);
  
  return result.lastID;
};

export const updateReworkStatus = async (
  id: number,
  newStatus: ReworkStatus,
  verificationRemarks?: string
): Promise<boolean> => {
  const validTransitions: Record<ReworkStatus, ReworkStatus[]> = {
    [ReworkStatus.PENDING]: [ReworkStatus.ASSIGNED, ReworkStatus.VERIFIED],
    [ReworkStatus.ASSIGNED]: [ReworkStatus.COMPLETED, ReworkStatus.VERIFIED],
    [ReworkStatus.COMPLETED]: [ReworkStatus.VERIFIED],
    [ReworkStatus.VERIFIED]: []
  };
  
  const current = await getOne<any>(
    'SELECT status, related_cleaning_id FROM rework_records WHERE id = ?',
    [id]
  );
  
  if (!current) throw new Error('返工记录不存在');
  
  if (!validTransitions[current.status].includes(newStatus)) {
    throw new Error(`状态转换不允许: ${current.status} -> ${newStatus}`);
  }
  
  await runQuery(
    `UPDATE rework_records SET 
       status = ?, verification_remarks = COALESCE(?, verification_remarks),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newStatus, verificationRemarks || null, id]
  );
  
  if (newStatus === ReworkStatus.VERIFIED) {
    const deductionRule = await getOne<any>(
      'SELECT amount FROM deduction_rules WHERE category = ? AND sub_category = ? AND enabled = 1',
      ['rework', 'second_cleaning']
    );
    
    if (deductionRule) {
      await runQuery(
        'UPDATE rework_records SET deduction_amount = ? WHERE id = ?',
        [deductionRule.amount, id]
      );
    }
    
    await updateCleaningStatus(current.related_cleaning_id, CleaningStatus.COMPLETED, verificationRemarks);
  }
  
  return true;
};
