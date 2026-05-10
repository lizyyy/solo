export interface Teacher {
  id: string;
  name: string;
  qualifications: string[];
}

export interface Course {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  requiredQualification: string;
  maxCapacity: number;
  allowedGrades: number[];
  timeSlot: string;
  dayOfWeek: string;
}

export interface Student {
  id: string;
  name: string;
  grade: number;
  classId: string;
  className: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  status: 'active' | 'waitlist' | 'withdrawn';
  waitlistPosition?: number;
  enrolledAt: Date;
}

export interface TransferRequest {
  id: string;
  studentId: string;
  fromCourseId: string;
  toCourseId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: Date;
  processedAt?: Date;
  rejectReason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}
