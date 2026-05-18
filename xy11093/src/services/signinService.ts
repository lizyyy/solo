import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from '../database/db';
import { SigninRecord, SigninStatus, AbnormalType, SigninSupplementCreateDto, SigninHistory, ManualProcessDto, Employee, TrainingCourse } from '../types';
import { getEmployeeById } from './employeeService';
import { getCourseById } from './courseService';

async function generateRecordNo(): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const result = await get(
    `SELECT COUNT(*) as count FROM signin_records WHERE record_no LIKE ?`,
    [`SIGN-${date}-%`]
  );
  const count = result ? (result as any).count : 0;
  return `SIGN-${date}-${String(count + 1).padStart(4, '0')}`;
}

async function addHistory(
  recordId: string,
  action: string,
  previousStatus: SigninStatus | undefined,
  newStatus: SigninStatus,
  operatorId: string,
  operatorName: string,
  remark?: string
): Promise<void> {
  const id = uuidv4();
  await run(
    `INSERT INTO signin_history (id, record_id, action, previous_status, new_status, operator_id, operator_name, remark, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, recordId, action, previousStatus, newStatus, operatorId, operatorName, remark, new Date().toISOString()]
  );
}

async function checkSeatConflict(courseId: string, seatNumber: number, excludeRecordId?: string): Promise<boolean> {
  let sql = `
    SELECT COUNT(*) as count FROM signin_records
    WHERE course_id = ? AND seat_number = ? AND status != ?
  `;
  const params: any[] = [courseId, seatNumber, SigninStatus.WITHDRAWN];
  if (excludeRecordId) {
    sql += ' AND id != ?';
    params.push(excludeRecordId);
  }
  const result = await get(sql, params);
  return result && result.count > 0;
}

export async function analyzeRecord(
  employee: Employee,
  course: TrainingCourse,
  signinType: 'online' | 'offline',
  seatNumber?: number,
  excludeRecordId?: string
): Promise<{ isNormal: boolean; abnormalType?: AbnormalType; explanation: string }> {
  const issues: string[] = [];
  let abnormalType: AbnormalType | undefined;

  if (employee.isRemote && signinType === 'offline') {
    abnormalType = AbnormalType.ONLINE_WRONG_OFFLINE;
    issues.push(`外地员工(${employee.location})误算线下座位`);
  }

  if (signinType === 'offline' && seatNumber) {
    const hasConflict = await checkSeatConflict(course.id, seatNumber, excludeRecordId);
    if (hasConflict) {
      abnormalType = AbnormalType.SEAT_CONFLICT;
      issues.push(`座位号${seatNumber}已被占用`);
    }
  }

  if (signinType === 'offline' && !seatNumber) {
    abnormalType = AbnormalType.CONSISTENCY_ERROR;
    issues.push('线下签到缺少座位号，与签到表不一致');
  }

  const isNormal = issues.length === 0;
  const explanation = isNormal
    ? '签到信息校验通过，所有字段符合要求'
    : issues.join('; ');

  return { isNormal, abnormalType, explanation };
}

export async function createSigninSupplement(dto: SigninSupplementCreateDto): Promise<SigninRecord> {
  const employee = await getEmployeeById(dto.employeeId);
  if (!employee) {
    throw new Error('员工不存在');
  }

  const course = await getCourseById(dto.courseId);
  if (!course) {
    throw new Error('培训课程不存在');
  }

  const analysis = await analyzeRecord(employee, course, dto.signinType, dto.seatNumber);

  const id = uuidv4();
  const recordNo = await generateRecordNo();
  const now = new Date().toISOString();

  const status = analysis.isNormal ? SigninStatus.NORMAL : SigninStatus.ABNORMAL;

  await run(
    `INSERT INTO signin_records
     (id, record_no, employee_id, course_id, signin_type, seat_number, signin_time,
      status, abnormal_type, business_explanation, submitter_id, submitter_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, recordNo, dto.employeeId, dto.courseId, dto.signinType, dto.seatNumber, dto.signinTime,
      status, analysis.abnormalType, analysis.explanation, dto.submitterId, dto.submitterName, now, now
    ]
  );

  await addHistory(id, '提交', undefined, status, dto.submitterId, dto.submitterName);

  return getSigninRecordById(id) as Promise<SigninRecord>;
}

export async function getSigninRecordById(id: string): Promise<SigninRecord | undefined> {
  return get(
    `SELECT id, record_no as recordNo, employee_id as employeeId, course_id as courseId,
            signin_type as signinType, seat_number as seatNumber, signin_time as signinTime,
            status, abnormal_type as abnormalType, business_explanation as businessExplanation,
            submitter_id as submitterId, submitter_name as submitterName,
            created_at as createdAt, updated_at as updatedAt
     FROM signin_records WHERE id = ?`,
    [id]
  );
}

export async function getSigninRecords(status?: SigninStatus): Promise<SigninRecord[]> {
  let sql = `
    SELECT id, record_no as recordNo, employee_id as employeeId, course_id as courseId,
            signin_type as signinType, seat_number as seatNumber, signin_time as signinTime,
            status, abnormal_type as abnormalType, business_explanation as businessExplanation,
            submitter_id as submitterId, submitter_name as submitterName,
            created_at as createdAt, updated_at as updatedAt
     FROM signin_records
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  return all(sql, params);
}

export async function getNormalRecords(): Promise<SigninRecord[]> {
  return getSigninRecords(SigninStatus.NORMAL);
}

export async function getAbnormalRecords(): Promise<SigninRecord[]> {
  return getSigninRecords(SigninStatus.ABNORMAL);
}

export async function getSigninHistory(recordId: string): Promise<SigninHistory[]> {
  return all(
    `SELECT id, record_id as recordId, action, previous_status as previousStatus,
            new_status as newStatus, operator_id as operatorId, operator_name as operatorName,
            remark, created_at as createdAt
     FROM signin_history WHERE record_id = ? ORDER BY created_at DESC`,
    [recordId]
  );
}

export async function withdrawRecord(
  recordId: string,
  operatorId: string,
  operatorName: string,
  remark: string
): Promise<SigninRecord> {
  const record = await getSigninRecordById(recordId);
  if (!record) {
    throw new Error('签到记录不存在');
  }

  const previousStatus = record.status;
  await run(
    `UPDATE signin_records SET status = ?, updated_at = ? WHERE id = ?`,
    [SigninStatus.WITHDRAWN, new Date().toISOString(), recordId]
  );

  await addHistory(recordId, '撤回', previousStatus, SigninStatus.WITHDRAWN, operatorId, operatorName, remark);

  return getSigninRecordById(recordId) as Promise<SigninRecord>;
}

export async function resubmitRecord(
  recordId: string,
  signinType: 'online' | 'offline',
  seatNumber: number | undefined,
  signinTime: string,
  operatorId: string,
  operatorName: string
): Promise<SigninRecord> {
  const record = await getSigninRecordById(recordId);
  if (!record) {
    throw new Error('签到记录不存在');
  }

  if (record.status !== SigninStatus.WITHDRAWN && record.status !== SigninStatus.ABNORMAL) {
    throw new Error('当前状态不允许重新提交');
  }

  const employee = await getEmployeeById(record.employeeId);
  if (!employee) {
    throw new Error('员工不存在');
  }

  const course = await getCourseById(record.courseId);
  if (!course) {
    throw new Error('培训课程不存在');
  }

  const analysis = await analyzeRecord(employee, course, signinType, seatNumber, recordId);

  const previousStatus = record.status;
  const newStatus = analysis.isNormal ? SigninStatus.NORMAL : SigninStatus.ABNORMAL;

  await run(
    `UPDATE signin_records
     SET signin_type = ?, seat_number = ?, signin_time = ?,
         status = ?, abnormal_type = ?, business_explanation = ?, updated_at = ?
     WHERE id = ?`,
    [
      signinType, seatNumber, signinTime,
      newStatus, analysis.abnormalType, analysis.explanation,
      new Date().toISOString(), recordId
    ]
  );

  await addHistory(recordId, '重新提交', previousStatus, newStatus, operatorId, operatorName);

  return getSigninRecordById(recordId) as Promise<SigninRecord>;
}

export async function startManualProcess(
  recordId: string,
  operatorId: string,
  operatorName: string,
  remark: string
): Promise<SigninRecord> {
  const record = await getSigninRecordById(recordId);
  if (!record) {
    throw new Error('签到记录不存在');
  }

  if (record.status !== SigninStatus.ABNORMAL) {
    throw new Error('只有异常记录可以进入人工处理');
  }

  const previousStatus = record.status;
  await run(
    `UPDATE signin_records SET status = ?, updated_at = ? WHERE id = ?`,
    [SigninStatus.MANUAL_PROCESSING, new Date().toISOString(), recordId]
  );

  await addHistory(recordId, '启动人工处理', previousStatus, SigninStatus.MANUAL_PROCESSING, operatorId, operatorName, remark);

  return getSigninRecordById(recordId) as Promise<SigninRecord>;
}

export async function processManual(dto: ManualProcessDto): Promise<SigninRecord> {
  const record = await getSigninRecordById(dto.recordId);
  if (!record) {
    throw new Error('签到记录不存在');
  }

  if (record.status !== SigninStatus.MANUAL_PROCESSING) {
    throw new Error('当前状态不允许人工处理');
  }

  const previousStatus = record.status;
  const newStatus = dto.resolution === 'approve' ? SigninStatus.PROCESSED : SigninStatus.ABNORMAL;
  const action = dto.resolution === 'approve' ? '人工处理通过' : '人工处理驳回';

  const newExplanation = dto.resolution === 'approve'
    ? `人工处理通过: ${dto.remark}`
    : `${record.businessExplanation}; 人工处理备注: ${dto.remark}`;

  await run(
    `UPDATE signin_records SET status = ?, business_explanation = ?, updated_at = ? WHERE id = ?`,
    [newStatus, newExplanation, new Date().toISOString(), dto.recordId]
  );

  await addHistory(dto.recordId, action, previousStatus, newStatus, dto.operatorId, dto.operatorName, dto.remark);

  return getSigninRecordById(dto.recordId) as Promise<SigninRecord>;
}
