import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runAsync, getAsync, allAsync } from '../database';
import { CheckList, CheckListStatus, ReleaseReason, QueryParams, CheckListHistory, ImportResult } from '../types';

function generateChecklistNo(): string {
  const date = dayjs().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CL${date}${random}`;
}

async function addHistory(checklistId: string, fromStatus: CheckListStatus | undefined, toStatus: CheckListStatus, operator?: string, remark?: string): Promise<void> {
  const sql = `
    INSERT INTO checklist_history (id, checklist_id, from_status, to_status, operator, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  await runAsync(sql, [uuidv4(), checklistId, fromStatus, toStatus, operator, remark, dayjs().toISOString()]);
}

export async function createChecklist(params: {
  patientId: string;
  patientName: string;
  patientIdCard: string;
  patientPhone: string;
  examItemId: string;
  examItemName: string;
  examItemCode: string;
  department: string;
  timeSlotId: string;
  timeSlotDate: string;
  timeSlotTime: string;
  operator?: string;
  businessObject?: string;
}): Promise<CheckList> {
  const timeSlot = await getAsync('SELECT * FROM time_slots WHERE id = ?', [params.timeSlotId]);
  if (!timeSlot) {
    throw new Error('号源不存在');
  }
  if (timeSlot.available <= 0) {
    throw new Error('号源已约满');
  }

  const id = uuidv4();
  const checklistNo = generateChecklistNo();
  const now = dayjs().toISOString();

  const sql = `
    INSERT INTO checklists (
      id, checklist_no, patient_id, patient_name, patient_id_card, patient_phone,
      exam_item_id, exam_item_name, exam_item_code, department,
      time_slot_id, time_slot_date, time_slot_time, status,
      operator, business_object, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await runAsync(sql, [
    id, checklistNo, params.patientId, params.patientName, params.patientIdCard, params.patientPhone,
    params.examItemId, params.examItemName, params.examItemCode, params.department,
    params.timeSlotId, params.timeSlotDate, params.timeSlotTime, CheckListStatus.OCCUPIED,
    params.operator, params.businessObject, now, now
  ]);

  await runAsync('UPDATE time_slots SET available = available - 1, occupied = occupied + 1 WHERE id = ?', [params.timeSlotId]);
  await addHistory(id, undefined, CheckListStatus.OCCUPIED, params.operator, '创建检查单占号');

  return getChecklistById(id) as Promise<CheckList>;
}

export async function getChecklistById(id: string): Promise<CheckList | undefined> {
  const sql = 'SELECT * FROM checklists WHERE id = ?';
  const row = await getAsync(sql, [id]);
  if (!row) return undefined;
  return {
    id: row.id,
    checklistNo: row.checklist_no,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdCard: row.patient_id_card,
    patientPhone: row.patient_phone,
    examItemId: row.exam_item_id,
    examItemName: row.exam_item_name,
    examItemCode: row.exam_item_code,
    department: row.department,
    timeSlotId: row.time_slot_id,
    timeSlotDate: row.time_slot_date,
    timeSlotTime: row.time_slot_time,
    status: row.status as CheckListStatus,
    releaseReason: row.release_reason as ReleaseReason,
    releaseRemark: row.release_remark,
    operator: row.operator,
    businessObject: row.business_object,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    releasedAt: row.released_at
  };
}

export async function queryChecklists(params: QueryParams) {
  let sql = 'SELECT * FROM checklists WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM checklists WHERE 1=1';
  const queryParams: any[] = [];
  const countParams: any[] = [];

  if (params.startDate) {
    sql += ' AND time_slot_date >= ?';
    countSql += ' AND time_slot_date >= ?';
    queryParams.push(params.startDate);
    countParams.push(params.startDate);
  }
  if (params.endDate) {
    sql += ' AND time_slot_date <= ?';
    countSql += ' AND time_slot_date <= ?';
    queryParams.push(params.endDate);
    countParams.push(params.endDate);
  }
  if (params.status) {
    sql += ' AND status = ?';
    countSql += ' AND status = ?';
    queryParams.push(params.status);
    countParams.push(params.status);
  }
  if (params.operator) {
    sql += ' AND operator = ?';
    countSql += ' AND operator = ?';
    queryParams.push(params.operator);
    countParams.push(params.operator);
  }
  if (params.businessObject) {
    sql += ' AND business_object LIKE ?';
    countSql += ' AND business_object LIKE ?';
    const likeValue = `%${params.businessObject}%`;
    queryParams.push(likeValue);
    countParams.push(likeValue);
  }
  if (params.patientName) {
    sql += ' AND patient_name LIKE ?';
    countSql += ' AND patient_name LIKE ?';
    const likeValue = `%${params.patientName}%`;
    queryParams.push(likeValue);
    countParams.push(likeValue);
  }
  if (params.examItemName) {
    sql += ' AND exam_item_name LIKE ?';
    countSql += ' AND exam_item_name LIKE ?';
    const likeValue = `%${params.examItemName}%`;
    queryParams.push(likeValue);
    countParams.push(likeValue);
  }

  sql += ' ORDER BY created_at DESC';

  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  sql += ' LIMIT ? OFFSET ?';
  queryParams.push(pageSize, offset);

  const [rows, countResult] = await Promise.all([
    allAsync(sql, queryParams),
    getAsync(countSql, countParams)
  ]);

  const checklists: CheckList[] = rows.map((row: any) => ({
    id: row.id,
    checklistNo: row.checklist_no,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdCard: row.patient_id_card,
    patientPhone: row.patient_phone,
    examItemId: row.exam_item_id,
    examItemName: row.exam_item_name,
    examItemCode: row.exam_item_code,
    department: row.department,
    timeSlotId: row.time_slot_id,
    timeSlotDate: row.time_slot_date,
    timeSlotTime: row.time_slot_time,
    status: row.status as CheckListStatus,
    releaseReason: row.release_reason as ReleaseReason,
    releaseRemark: row.release_remark,
    operator: row.operator,
    businessObject: row.business_object,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    releasedAt: row.released_at
  }));

  return {
    list: checklists,
    total: (countResult as any).total,
    page,
    pageSize
  };
}

export async function updateStatusToPendingRelease(checklistId: string, operator?: string, remark?: string): Promise<CheckList> {
  const checklist = await getChecklistById(checklistId);
  if (!checklist) {
    throw new Error('检查单不存在');
  }
  if (checklist.status !== CheckListStatus.OCCUPIED) {
    throw new Error('只有已占号状态才能转为待释放');
  }

  const now = dayjs().toISOString();
  await runAsync(
    'UPDATE checklists SET status = ?, updated_at = ?, operator = ?, release_remark = ? WHERE id = ?',
    [CheckListStatus.PENDING_RELEASE, now, operator, remark, checklistId]
  );

  await addHistory(checklistId, checklist.status, CheckListStatus.PENDING_RELEASE, operator, remark || '转为待释放');

  return getChecklistById(checklistId) as Promise<CheckList>;
}

export async function releaseChecklist(checklistId: string, releaseReason: ReleaseReason, operator?: string, remark?: string): Promise<CheckList> {
  const checklist = await getChecklistById(checklistId);
  if (!checklist) {
    throw new Error('检查单不存在');
  }
  if (checklist.status !== CheckListStatus.PENDING_RELEASE && checklist.status !== CheckListStatus.OCCUPIED) {
    throw new Error('只有已占号或待释放状态才能释放');
  }

  const now = dayjs().toISOString();
  await runAsync(
    'UPDATE checklists SET status = ?, release_reason = ?, release_remark = ?, released_at = ?, updated_at = ?, operator = ? WHERE id = ?',
    [CheckListStatus.RELEASED, releaseReason, remark, now, now, operator, checklistId]
  );

  await runAsync('UPDATE time_slots SET available = available + 1, occupied = occupied - 1 WHERE id = ?', [checklist.timeSlotId]);
  await addHistory(checklistId, checklist.status, CheckListStatus.RELEASED, operator, `释放原因: ${releaseReason}, ${remark || ''}`);

  return getChecklistById(checklistId) as Promise<CheckList>;
}

export async function rescheduleChecklist(checklistId: string, newTimeSlotId: string, operator?: string): Promise<CheckList> {
  const checklist = await getChecklistById(checklistId);
  if (!checklist) {
    throw new Error('检查单不存在');
  }

  const newTimeSlot = await getAsync('SELECT * FROM time_slots WHERE id = ?', [newTimeSlotId]);
  if (!newTimeSlot) {
    throw new Error('新号源不存在');
  }
  if (newTimeSlot.available <= 0) {
    throw new Error('新号源已约满');
  }

  const now = dayjs().toISOString();
  await runAsync(
    'UPDATE checklists SET status = ?, time_slot_id = ?, time_slot_date = ?, time_slot_time = ?, updated_at = ?, operator = ? WHERE id = ?',
    [CheckListStatus.RESCHEDULED, newTimeSlotId, newTimeSlot.date, `${newTimeSlot.start_time}-${newTimeSlot.end_time}`, now, operator, checklistId]
  );

  await runAsync('UPDATE time_slots SET available = available + 1, occupied = occupied - 1 WHERE id = ?', [checklist.timeSlotId]);
  await runAsync('UPDATE time_slots SET available = available - 1, occupied = occupied + 1 WHERE id = ?', [newTimeSlotId]);
  await addHistory(checklistId, checklist.status, CheckListStatus.RESCHEDULED, operator, `改约至: ${newTimeSlot.date} ${newTimeSlot.start_time}-${newTimeSlot.end_time}`);

  return getChecklistById(checklistId) as Promise<CheckList>;
}

export async function getChecklistHistory(checklistId: string): Promise<CheckListHistory[]> {
  const sql = 'SELECT * FROM checklist_history WHERE checklist_id = ? ORDER BY created_at DESC';
  const rows = await allAsync(sql, [checklistId]);
  return rows.map((row: any) => ({
    id: row.id,
    checklistId: row.checklist_id,
    fromStatus: row.from_status as CheckListStatus,
    toStatus: row.to_status as CheckListStatus,
    operator: row.operator,
    remark: row.remark,
    createdAt: row.created_at
  }));
}

export async function batchImport(rows: any[], operator?: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    total: rows.length,
    details: []
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.patientName || !row.patientIdCard) {
        throw new Error('患者姓名和身份证号不能为空');
      }
      if (!row.examItemCode) {
        throw new Error('检查项目编码不能为空');
      }
      if (!row.timeSlotDate || !row.timeSlotTime) {
        throw new Error('号源日期和时间段不能为空');
      }

      const examItem = await getAsync('SELECT * FROM exam_items WHERE code = ?', [row.examItemCode]);
      if (!examItem) {
        throw new Error(`检查项目 ${row.examItemCode} 不存在`);
      }

      const timeSlot = await getAsync(
        'SELECT * FROM time_slots WHERE exam_item_id = ? AND date = ? AND start_time || "-" || end_time = ?',
        [examItem.id, row.timeSlotDate, row.timeSlotTime]
      );
      if (!timeSlot) {
        throw new Error(`号源 ${row.timeSlotDate} ${row.timeSlotTime} 不存在`);
      }
      if (timeSlot.available <= 0) {
        throw new Error('号源已约满，无法占号');
      }

      let patient = await getAsync('SELECT * FROM patients WHERE id_card = ?', [row.patientIdCard]);
      if (!patient) {
        const patientId = uuidv4();
        await runAsync(
          'INSERT INTO patients (id, name, id_card, phone, created_at) VALUES (?, ?, ?, ?, ?)',
          [patientId, row.patientName, row.patientIdCard, row.patientPhone || '', dayjs().toISOString()]
        );
        patient = { id: patientId, name: row.patientName, id_card: row.patientIdCard, phone: row.patientPhone };
      }

      const checklist = await createChecklist({
        patientId: patient.id,
        patientName: patient.name,
        patientIdCard: patient.id_card,
        patientPhone: patient.phone || '',
        examItemId: examItem.id,
        examItemName: examItem.name,
        examItemCode: examItem.code,
        department: examItem.department,
        timeSlotId: timeSlot.id,
        timeSlotDate: timeSlot.date,
        timeSlotTime: `${timeSlot.start_time}-${timeSlot.end_time}`,
        operator: operator || row.operator,
        businessObject: row.businessObject
      });

      if (row.needRelease) {
        await updateStatusToPendingRelease(checklist.id, operator, '批量导入待释放');
        if (row.releaseReason) {
          await releaseChecklist(checklist.id, row.releaseReason, operator, row.releaseRemark);
        }
      }

      result.success++;
      result.details.push({
        row: i + 1,
        success: true,
        checklistId: checklist.id
      });
    } catch (err: any) {
      result.failed++;
      result.details.push({
        row: i + 1,
        success: false,
        error: err.message
      });
    }
  }

  return result;
}
