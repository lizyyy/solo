export class BusinessError extends Error {
  code: string;
  userMessage: string;

  constructor(code: string, userMessage: string) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.name = 'BusinessError';
  }
}

export const ErrorCodes = {
  GRADE_NOT_ALLOWED: 'GRADE_NOT_ALLOWED',
  TIME_SLOT_CONFLICT: 'TIME_SLOT_CONFLICT',
  COURSE_FULL: 'COURSE_FULL',
  TEACHER_QUALIFICATION_MISMATCH: 'TEACHER_QUALIFICATION_MISMATCH',
  STUDENT_NOT_FOUND: 'STUDENT_NOT_FOUND',
  COURSE_NOT_FOUND: 'COURSE_NOT_FOUND',
  TEACHER_NOT_FOUND: 'TEACHER_NOT_FOUND',
  ENROLLMENT_NOT_FOUND: 'ENROLLMENT_NOT_FOUND',
  TRANSFER_REQUEST_NOT_FOUND: 'TRANSFER_REQUEST_NOT_FOUND',
  ALREADY_ENROLLED: 'ALREADY_ENROLLED',
  ALREADY_IN_WAITLIST: 'ALREADY_IN_WAITLIST',
  INVALID_TRANSFER: 'INVALID_TRANSFER',
  TRANSFER_ALREADY_PROCESSED: 'TRANSFER_ALREADY_PROCESSED',
};

export const ErrorMessages = {
  [ErrorCodes.GRADE_NOT_ALLOWED]: (studentName: string, studentGrade: number, courseName: string, allowedGrades: number[]) => 
    `${studentName}同学是${studentGrade}年级学生，${courseName}只面向${allowedGrades.join('、')}年级学生开放`,
  [ErrorCodes.TIME_SLOT_CONFLICT]: (studentName: string, dayOfWeek: string, timeSlot: string, conflictCourseName: string) =>
    `${studentName}同学在${dayOfWeek}${timeSlot}已经报名了${conflictCourseName}，无法在同一时段重复报名`,
  [ErrorCodes.COURSE_FULL]: (courseName: string) =>
    `${courseName}已经报满，您可以加入候补队列，有名额空出时会按顺序通知`,
  [ErrorCodes.TEACHER_QUALIFICATION_MISMATCH]: (teacherName: string, courseName: string, requiredQualification: string) =>
    `${teacherName}不具备${courseName}所需的${requiredQualification}资质`,
  [ErrorCodes.STUDENT_NOT_FOUND]: '未找到该学生信息，请确认学生信息是否正确',
  [ErrorCodes.COURSE_NOT_FOUND]: '未找到该课程信息',
  [ErrorCodes.TEACHER_NOT_FOUND]: '未找到该老师信息',
  [ErrorCodes.ENROLLMENT_NOT_FOUND]: '未找到该报名记录',
  [ErrorCodes.TRANSFER_REQUEST_NOT_FOUND]: '未找到该改选申请',
  [ErrorCodes.ALREADY_ENROLLED]: (studentName: string, courseName: string) =>
    `${studentName}同学已经报名了${courseName}`,
  [ErrorCodes.ALREADY_IN_WAITLIST]: (studentName: string, courseName: string) =>
    `${studentName}同学已经在${courseName}的候补队列中`,
  [ErrorCodes.INVALID_TRANSFER]: '改选申请无效，请检查原课程和目标课程信息',
  [ErrorCodes.TRANSFER_ALREADY_PROCESSED]: '该改选申请已经处理过了',
};
