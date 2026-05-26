import { TrainingMaterial, AttendanceItem, ValidationError } from '../types';

const REQUIRED_TRAINING_FIELDS = [
  'trainingId', 'trainingName', 'trainer', 'trainingDate',
  'startTime', 'endTime', 'location'
];

const REQUIRED_ATTENDANCE_FIELDS = [
  'employeeId', 'employeeName', 'department', 'signInTime', 'signOutTime'
];

export function validateTrainingMaterial(
  material: TrainingMaterial,
  materialIndex: number,
  existingTrainingIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of REQUIRED_TRAINING_FIELDS) {
    const value = (material as any)[field];
    if (value === undefined || value === null || value === '') {
      errors.push({
        materialIndex,
        field,
        value,
        error: `缺少必填字段: ${field}`,
      });
    }
  }

  if (material.trainingId && existingTrainingIds.has(material.trainingId)) {
    errors.push({
      materialIndex,
      field: 'trainingId',
      value: material.trainingId,
      error: `培训编号重复: ${material.trainingId}`,
    });
  }

  if (material.trainingId) {
    existingTrainingIds.add(material.trainingId);
  }

  if (material.startTime && material.endTime) {
    const start = new Date(`${material.trainingDate}T${material.startTime}`);
    const end = new Date(`${material.trainingDate}T${material.endTime}`);
    if (start >= end) {
      errors.push({
        materialIndex,
        field: 'endTime',
        value: material.endTime,
        error: '培训结束时间必须晚于开始时间',
      });
    }
  }

  const existingEmployeeIds = new Set<string>();
  if (material.attendance) {
    material.attendance.forEach((attendance, attendanceIndex) => {
      errors.push(...validateAttendanceItem(
        attendance,
        materialIndex,
        attendanceIndex,
        material,
        existingEmployeeIds
      ));
    });
  } else {
    errors.push({
      materialIndex,
      field: 'attendance',
      value: material.attendance,
      error: '缺少签到记录列表',
    });
  }

  return errors;
}

function validateAttendanceItem(
  attendance: AttendanceItem,
  materialIndex: number,
  attendanceIndex: number,
  material: TrainingMaterial,
  existingEmployeeIds: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of REQUIRED_ATTENDANCE_FIELDS) {
    const value = (attendance as any)[field];
    if (value === undefined || value === null || value === '') {
      errors.push({
        materialIndex,
        attendanceIndex,
        field,
        value,
        error: `缺少必填字段: ${field}`,
      });
    }
  }

  if (attendance.employeeId && existingEmployeeIds.has(attendance.employeeId)) {
    errors.push({
      materialIndex,
      attendanceIndex,
      field: 'employeeId',
      value: attendance.employeeId,
      error: `员工编号在同一培训中重复: ${attendance.employeeId}`,
    });
  }
  if (attendance.employeeId) {
    existingEmployeeIds.add(attendance.employeeId);
  }

  if (attendance.signInTime && attendance.signOutTime) {
    const signIn = new Date(`${material.trainingDate}T${attendance.signInTime}`);
    const signOut = new Date(`${material.trainingDate}T${attendance.signOutTime}`);
    if (signIn >= signOut) {
      errors.push({
        materialIndex,
        attendanceIndex,
        field: 'signOutTime',
        value: attendance.signOutTime,
        error: '签退时间必须晚于签到时间',
      });
    }
  }

  if (material.startTime && attendance.signInTime) {
    const trainingStart = new Date(`${material.trainingDate}T${material.startTime}`);
    const signIn = new Date(`${material.trainingDate}T${attendance.signInTime}`);
    if (signIn < trainingStart) {
      errors.push({
        materialIndex,
        attendanceIndex,
        field: 'signInTime',
        value: attendance.signInTime,
        error: '签到时间不能早于培训开始时间',
      });
    }
  }

  if (material.endTime && attendance.signOutTime) {
    const trainingEnd = new Date(`${material.trainingDate}T${material.endTime}`);
    const signOut = new Date(`${material.trainingDate}T${attendance.signOutTime}`);
    if (signOut > trainingEnd) {
      errors.push({
        materialIndex,
        attendanceIndex,
        field: 'signOutTime',
        value: attendance.signOutTime,
        error: '签退时间不能晚于培训结束时间',
      });
    }
  }

  return errors;
}
