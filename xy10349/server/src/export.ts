import db from './database';
import type {
  Student, MeetingPoint, AttendanceRecord, LeaveRequest,
  GroupChange, AttendanceStatus, ExportReport
} from './types';

type ExceptionType = 'rule_intercept' | 'data_missing' | 'status_conflict' | null;

function determineExceptionType(record: AttendanceRecord, leaveRequests: LeaveRequest[]): ExceptionType {
  if (!record.studentId || !record.meetingPointId) {
    return 'data_missing';
  }

  if (record.status === 'leave') {
    const hasApproved = leaveRequests.some(
      lr => lr.studentId === record.studentId &&
            lr.meetingPointId === record.meetingPointId &&
            lr.status === 'approved'
    );
    if (!hasApproved) {
      return 'rule_intercept';
    }
  }

  return null;
}

function getActionTaken(record: AttendanceRecord, leaveRequests: LeaveRequest[]): string {
  const exceptionType = determineExceptionType(record, leaveRequests);
  if (!exceptionType) {
    switch (record.status) {
      case 'present': return '正常到岗';
      case 'late': return '迟到补点';
      case 'leave': return '请假获批';
      case 'absent': return '标记缺勤';
    }
  }

  switch (exceptionType) {
    case 'rule_intercept': return '规则拦截';
    case 'data_missing': return '数据缺失';
    case 'status_conflict': return '状态冲突';
  }
}

export function generateReport(): ExportReport {
  const activity = db.prepare('SELECT * FROM activities WHERE isActive = 1 LIMIT 1').get() as {
    name: string; date: string; description: string;
  } | undefined;

  const students = db.prepare('SELECT * FROM students').all() as Student[];
  const meetingPoints = db.prepare('SELECT * FROM meeting_points ORDER BY orderIndex').all() as MeetingPoint[];
  const allRecords = db.prepare(`
    SELECT * FROM attendance_records ORDER BY timestamp DESC
  `).all() as AttendanceRecord[];
  const leaveRequests = db.prepare('SELECT * FROM leave_requests').all() as LeaveRequest[];

  const latestRecordsPerMeetingPoint = new Map<string, Map<string, AttendanceRecord>>();
  for (const mp of meetingPoints) {
    latestRecordsPerMeetingPoint.set(mp.id, new Map());
  }

  for (const record of allRecords) {
    const mpRecords = latestRecordsPerMeetingPoint.get(record.meetingPointId);
    if (!mpRecords) continue;

    const existing = mpRecords.get(record.studentId);
    if (!existing || record.timestamp > existing.timestamp) {
      mpRecords.set(record.studentId, record);
    }
  }

  const studentMap = new Map(students.map(s => [s.id, s]));
  const meetingPointData = meetingPoints.map(mp => {
    const mpRecords = latestRecordsPerMeetingPoint.get(mp.id) || new Map();
    const studentsWithStatus = Array.from(mpRecords.entries()).map(([sid, record]) => {
      const student = studentMap.get(sid);
      return {
        studentId: record.studentId,
        name: student?.name || '未知',
        status: record.status as AttendanceStatus,
        actionTaken: getActionTaken(record, leaveRequests),
        exceptionType: determineExceptionType(record, leaveRequests),
        rawInput: record.rawInput || '',
      };
    });

    const statusCounts = {
      present: 0, absent: 0, leave: 0, late: 0,
    };
    for (const s of studentsWithStatus) {
      statusCounts[s.status]++;
    }

    return {
      id: mp.id,
      name: mp.name,
      totalStudents: studentsWithStatus.length,
      presentCount: statusCounts.present,
      absentCount: statusCounts.absent,
      leaveCount: statusCounts.leave,
      lateCount: statusCounts.late,
      students: studentsWithStatus,
    };
  });

  return {
    activityName: activity?.name || '未设置活动',
    activityDate: activity?.date || new Date().toISOString().split('T')[0],
    generatedAt: new Date().toISOString(),
    meetingPoints: meetingPointData,
  };
}

export function getExportCSV(): string {
  const report = generateReport();
  const lines: string[] = [];

  lines.push('活动名称,' + report.activityName);
  lines.push('活动日期,' + report.activityDate);
  lines.push('生成时间,' + report.generatedAt);
  lines.push('');

  lines.push('集合点,总人数,到岗,缺勤,请假,迟到');
  for (const mp of report.meetingPoints) {
    lines.push([
      mp.name, mp.totalStudents,
      mp.presentCount, mp.absentCount,
      mp.leaveCount, mp.lateCount,
    ].join(','));
  }
  lines.push('');

  lines.push('集合点,学号,姓名,状态,处理动作,异常类型,原始输入');
  for (const mp of report.meetingPoints) {
    for (const s of mp.students) {
      lines.push([
        mp.name,
        s.studentId,
        s.name,
        statusLabel(s.status),
        s.actionTaken,
        s.exceptionType || '',
        `"${(s.rawInput || '').replace(/"/g, '""')}"`,
      ].join(','));
    }
  }

  return lines.join('\n');
}

export function getGroupChangesCSV(): string {
  const changes = db.prepare(`
    SELECT gc.*, s.name as studentName,
           g1.name as oldGroupName, g2.name as newGroupName
    FROM group_changes gc
    LEFT JOIN students s ON gc.studentId = s.id
    LEFT JOIN groups g1 ON gc.oldGroupId = g1.id
    LEFT JOIN groups g2 ON gc.newGroupId = g2.id
    ORDER BY gc.timestamp DESC
  `).all() as Array<GroupChange & {
    studentName: string; oldGroupName: string | null; newGroupName: string | null;
  }>;

  const lines: string[] = ['时间,学生,原小组,新小组,原因,操作人,原始输入'];
  for (const c of changes) {
    lines.push([
      c.timestamp,
      c.studentName || '未知',
      c.oldGroupName || '-',
      c.newGroupName || '-',
      c.reason,
      c.operatorId,
      `"${(c.rawInput || '').replace(/"/g, '""')}"`,
    ].join(','));
  }
  return lines.join('\n');
}

function statusLabel(s: AttendanceStatus): string {
  switch (s) {
    case 'present': return '到岗';
    case 'absent': return '缺勤';
    case 'leave': return '请假';
    case 'late': return '迟到';
  }
}
