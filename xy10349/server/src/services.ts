import { randomUUID } from 'crypto';
import db from './database';
import type {
  Student, Teacher, Group, MeetingPoint,
  AttendanceRecord, AttendanceStatus,
  LeaveRequest, LeaveStatus,
  GroupChange, ApiError
} from './types';

export class ApiErrorException extends Error {
  code: string;
  rawInput?: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, rawInput?: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.rawInput = rawInput;
    this.details = details;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      rawInput: this.rawInput,
      details: this.details,
    };
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export function getStudents(): Student[] {
  return db.prepare('SELECT * FROM students ORDER BY studentId').all() as Student[];
}

export function getStudentById(id: string): Student | undefined {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Student | undefined;
}

export function importStudents(studentsData: Array<{
  name: string; studentId: string; class?: string; gender?: string;
  phone?: string; emergencyContact?: string;
}>, rawInput: string): { imported: number; errors: ApiError[] } {
  const errors: ApiError[] = [];
  const imported: Student[] = [];
  const existingStudentIds = new Set(
    (db.prepare('SELECT studentId FROM students').all() as { studentId: string }[])
      .map(s => s.studentId)
  );

  const insert = db.prepare(`
    INSERT INTO students (id, name, studentId, class, gender, phone, emergencyContact, groupId, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((data: typeof studentsData) => {
    for (let i = 0; i < data.length; i++) {
      const s = data[i];
      if (!s.name || !s.studentId) {
        errors.push({
          code: 'DATA_MISSING',
          message: `第${i + 1}行：姓名或学号缺失`,
          rawInput: rawInput,
          details: { line: i + 1, ...s },
        });
        continue;
      }

      if (existingStudentIds.has(s.studentId)) {
        errors.push({
          code: 'DUPLICATE_STUDENT_ID',
          message: `学号 ${s.studentId} 已存在`,
          rawInput: rawInput,
          details: { line: i + 1, studentId: s.studentId },
        });
        continue;
      }

      const id = generateId('s');
      insert.run(
        id, s.name, s.studentId, s.class || '', s.gender || '',
        s.phone || '', s.emergencyContact || '', null, 'active'
      );
      existingStudentIds.add(s.studentId);
      imported.push({
        id, name: s.name, studentId: s.studentId,
        class: s.class || '', gender: s.gender || '',
        phone: s.phone || '', emergencyContact: s.emergencyContact || '',
        groupId: null, status: 'active',
      });
    }
  });

  transaction(studentsData);
  return { imported: imported.length, errors };
}

export function assignStudentToGroup(studentId: string, groupId: string | null, rawInput: string): Student {
  const student = getStudentById(studentId);
  if (!student) {
    throw new ApiErrorException('DATA_MISSING', `学生不存在: ${studentId}`, rawInput);
  }

  if (groupId) {
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined;
    if (!group) {
      throw new ApiErrorException('DATA_MISSING', `小组不存在: ${groupId}`, rawInput);
    }
  }

  const oldGroupId = student.groupId;
  db.prepare('UPDATE students SET groupId = ? WHERE id = ?').run(groupId, studentId);

  if (oldGroupId !== groupId) {
    db.prepare(`
      INSERT INTO group_changes (id, studentId, oldGroupId, newGroupId, reason, operatorId, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId('gc'), studentId, oldGroupId, groupId,
      '分组调整', 'system', rawInput
    );
  }

  return { ...student, groupId };
}

export function getTeachers(): Teacher[] {
  return db.prepare('SELECT * FROM teachers ORDER BY teacherId').all() as Teacher[];
}

export function getGroups(): Group[] {
  return db.prepare('SELECT * FROM groups ORDER BY name').all() as Group[];
}

export function createGroup(name: string, teacherId?: string): Group {
  const id = generateId('g');
  db.prepare('INSERT INTO groups (id, name, teacherId, meetingPointId) VALUES (?, ?, ?, ?)')
    .run(id, name, teacherId || null, null);
  return { id, name, teacherId: teacherId || null, meetingPointId: null };
}

export function updateGroupTeacher(groupId: string, teacherId: string | null): void {
  db.prepare('UPDATE groups SET teacherId = ? WHERE id = ?').run(teacherId, groupId);
}

export function getMeetingPoints(): MeetingPoint[] {
  return db.prepare('SELECT * FROM meeting_points ORDER BY orderIndex, id').all() as MeetingPoint[];
}

export function createMeetingPoint(data: {
  name: string; location?: string; description?: string; orderIndex?: number;
}): MeetingPoint {
  const id = generateId('mp');
  const maxResult = db.prepare('SELECT MAX(orderIndex) as max FROM meeting_points').get() as { max: number | null } | null;
  const maxOrder = maxResult?.max ?? 0;
  const orderIndex = data.orderIndex ?? (maxOrder + 1);
  db.prepare(`
    INSERT INTO meeting_points (id, name, location, description, orderIndex)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.name, data.location || '', data.description || '', orderIndex);
  return {
    id, name: data.name, location: data.location || '',
    description: data.description || '', orderIndex,
  };
}

export function recordAttendance(
  studentId: string,
  meetingPointId: string,
  status: AttendanceStatus,
  rawInput: string,
  operatorId: string = 'system',
  notes: string = ''
): AttendanceRecord {
  const student = getStudentById(studentId);
  if (!student) {
    throw new ApiErrorException('DATA_MISSING', `学生不存在: ${studentId}`, rawInput);
  }

  const meetingPoint = db.prepare('SELECT * FROM meeting_points WHERE id = ?').get(meetingPointId) as MeetingPoint | undefined;
  if (!meetingPoint) {
    throw new ApiErrorException('DATA_MISSING', `集合点不存在: ${meetingPointId}`, rawInput);
  }

  if (status === 'leave') {
    const approvedLeave = db.prepare(`
      SELECT * FROM leave_requests
      WHERE studentId = ? AND meetingPointId = ? AND status = 'approved'
    `).get(studentId, meetingPointId) as LeaveRequest | undefined;

    if (!approvedLeave) {
      throw new ApiErrorException(
        'RULE_INTERCEPT',
        '该学生请假未获批准，不能直接标记为请假状态',
        rawInput,
        { studentId, studentName: student.name, meetingPointId }
      );
    }
  }

  if (status === 'present') {
    const previousRecords = db.prepare(`
      SELECT * FROM attendance_records
      WHERE studentId = ? AND meetingPointId = ? AND status = 'absent'
      ORDER BY timestamp DESC
    `).all(studentId, meetingPointId) as AttendanceRecord[];

    if (previousRecords.length > 0) {
      throw new ApiErrorException(
        'STATUS_CONFLICT',
        '该学生此前被标记为缺勤，不能直接标记安全。需要先处理缺勤原因',
        rawInput,
        {
          studentId, studentName: student.name,
          previousAbsent: previousRecords[0].timestamp,
        }
      );
    }
  }

  const id = generateId('att');
  const timestamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO attendance_records (id, studentId, meetingPointId, status, timestamp, operatorId, rawInput, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, studentId, meetingPointId, status, timestamp, operatorId, rawInput, notes);

  return {
    id, studentId, meetingPointId, status, timestamp, operatorId, rawInput, notes,
  };
}

export function getAttendanceRecords(meetingPointId?: string): AttendanceRecord[] {
  if (meetingPointId) {
    return db.prepare(`
      SELECT * FROM attendance_records
      WHERE meetingPointId = ?
      ORDER BY timestamp DESC
    `).all(meetingPointId) as AttendanceRecord[];
  }
  return db.prepare('SELECT * FROM attendance_records ORDER BY timestamp DESC').all() as AttendanceRecord[];
}

export function requestLeave(
  studentId: string,
  meetingPointId: string,
  reason: string,
  rawInput: string,
  requestedBy: string = 'system'
): LeaveRequest {
  const student = getStudentById(studentId);
  if (!student) {
    throw new ApiErrorException('DATA_MISSING', `学生不存在: ${studentId}`, rawInput);
  }

  const id = generateId('leave');
  db.prepare(`
    INSERT INTO leave_requests (id, studentId, meetingPointId, reason, status, requestedBy, rawInput)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, studentId, meetingPointId, reason, 'pending', requestedBy, rawInput);

  return {
    id, studentId, meetingPointId, reason,
    status: 'pending', requestedBy,
    approvedBy: null, requestTime: new Date().toISOString(),
    approvalTime: null, rawInput,
  };
}

export function approveLeave(
  leaveId: string,
  approved: boolean,
  approvedBy: string = 'system'
): LeaveRequest {
  const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leaveId) as LeaveRequest | undefined;
  if (!leave) {
    throw new ApiErrorException('DATA_MISSING', `请假记录不存在: ${leaveId}`);
  }

  const newStatus: LeaveStatus = approved ? 'approved' : 'rejected';
  const approvalTime = new Date().toISOString();

  db.prepare(`
    UPDATE leave_requests
    SET status = ?, approvedBy = ?, approvalTime = ?
    WHERE id = ?
  `).run(newStatus, approvedBy, approvalTime, leaveId);

  return {
    ...leave, status: newStatus, approvedBy, approvalTime,
  };
}

export function getLeaveRequests(status?: LeaveStatus): LeaveRequest[] {
  if (status) {
    return db.prepare(`
      SELECT * FROM leave_requests
      WHERE status = ?
      ORDER BY requestTime DESC
    `).all(status) as LeaveRequest[];
  }
  return db.prepare('SELECT * FROM leave_requests ORDER BY requestTime DESC').all() as LeaveRequest[];
}

export function changeStudentGroup(
  studentId: string,
  newGroupId: string | null,
  reason: string,
  rawInput: string,
  operatorId: string = 'system'
): GroupChange {
  const student = getStudentById(studentId);
  if (!student) {
    throw new ApiErrorException('DATA_MISSING', `学生不存在: ${studentId}`, rawInput);
  }

  if (newGroupId) {
    const existingGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(newGroupId) as Group | undefined;
    if (!existingGroup) {
      throw new ApiErrorException('DATA_MISSING', `目标小组不存在: ${newGroupId}`, rawInput);
    }

    const currentInOtherGroups = db.prepare(`
      SELECT COUNT(*) as count FROM students WHERE groupId = ? AND id != ?
    `).get(newGroupId, studentId) as { count: number };
  }

  const oldGroupId = student.groupId;
  const changeId = generateId('gc');
  const timestamp = new Date().toISOString();

  db.transaction(() => {
    db.prepare('UPDATE students SET groupId = ? WHERE id = ?').run(newGroupId, studentId);
    db.prepare(`
      INSERT INTO group_changes (id, studentId, oldGroupId, newGroupId, reason, operatorId, timestamp, rawInput)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(changeId, studentId, oldGroupId, newGroupId, reason, operatorId, timestamp, rawInput);
  })();

  return {
    id: changeId, studentId, oldGroupId, newGroupId, reason, operatorId, timestamp, rawInput,
  };
}

export function getGroupChanges(studentId?: string): GroupChange[] {
  if (studentId) {
    return db.prepare(`
      SELECT * FROM group_changes
      WHERE studentId = ?
      ORDER BY timestamp DESC
    `).all(studentId) as GroupChange[];
  }
  return db.prepare('SELECT * FROM group_changes ORDER BY timestamp DESC').all() as GroupChange[];
}

export function getAbsentAlerts(): Array<{
  student: Student;
  lastMeetingPoint: MeetingPoint | null;
  lastStatus: string;
  lastTime: string | null;
}> {
  const students = getStudents();
  const meetingPoints = getMeetingPoints();
  const mpMap = new Map(meetingPoints.map(m => [m.id, m]));
  const alerts: Array<{
    student: Student;
    lastMeetingPoint: MeetingPoint | null;
    lastStatus: string;
    lastTime: string | null;
  }> = [];

  for (const student of students) {
    const lastRecord = db.prepare(`
      SELECT * FROM attendance_records
      WHERE studentId = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(student.id) as AttendanceRecord | undefined;

    if (!lastRecord || lastRecord.status === 'absent') {
      alerts.push({
        student,
        lastMeetingPoint: lastRecord ? (mpMap.get(lastRecord.meetingPointId) || null) : null,
        lastStatus: lastRecord ? lastRecord.status : 'unknown',
        lastTime: lastRecord ? lastRecord.timestamp : null,
      });
    }
  }

  return alerts;
}

export function getDashboardData(): {
  meetingPoints: Array<MeetingPoint & {
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    lateCount: number;
    totalStudents: number;
  }>;
  totalStudents: number;
  absentCount: number;
  pendingLeaves: number;
} {
  const students = getStudents();
  const meetingPoints = getMeetingPoints();
  const activeStudents = students.filter(s => s.status === 'active');

  const result = meetingPoints.map(mp => {
    const records = getAttendanceRecords(mp.id);
    const latestRecords = new Map<string, AttendanceRecord>();

    for (const record of records) {
      const existing = latestRecords.get(record.studentId);
      if (!existing || record.timestamp > existing.timestamp) {
        latestRecords.set(record.studentId, record);
      }
    }

    return {
      ...mp,
      totalStudents: activeStudents.length,
      presentCount: 0,
      absentCount: 0,
      leaveCount: 0,
      lateCount: 0,
    };
  });

  for (const mp of result) {
    const records = getAttendanceRecords(mp.id);
    const latestRecords = new Map<string, AttendanceRecord>();

    for (const record of records) {
      const existing = latestRecords.get(record.studentId);
      if (!existing || record.timestamp > existing.timestamp) {
        latestRecords.set(record.studentId, record);
      }
    }

    for (const rec of latestRecords.values()) {
      mp[`${rec.status}Count`]++;
    }
  }

  const totalAbsent = result.reduce((sum, mp) => sum + mp.absentCount, 0);
  const pendingLeaves = getLeaveRequests('pending').length;

  return {
    meetingPoints: result,
    totalStudents: activeStudents.length,
    absentCount: totalAbsent,
    pendingLeaves,
  };
}
