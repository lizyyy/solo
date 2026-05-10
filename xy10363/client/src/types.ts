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
  teacherName: string;
  currentCount: number;
  availableSeats: number;
  isFull: boolean;
  waitlistCount: number;
  waitlist: Array<{
    id: string;
    studentName: string;
    studentGrade: number;
    studentClass: string;
    waitlistPosition: number;
  }>;
  enrolledStudents: Array<{
    id: string;
    studentName: string;
    studentGrade: number;
    studentClass: string;
  }>;
}

export interface Student {
  id: string;
  name: string;
  grade: number;
  classId: string;
  className: string;
}

export interface ScheduleItem {
  id: string;
  courseId: string;
  courseName: string;
  courseDescription?: string;
  teacherName: string;
  dayOfWeek: string;
  timeSlot: string;
  allowedGrades: number[];
  status: 'active' | 'waitlist' | 'withdrawn';
  waitlistPosition?: number;
}

export interface TransferRequest {
  id: string;
  studentId: string;
  studentName?: string;
  studentClass?: string;
  fromCourseId: string;
  fromCourseName?: string;
  toCourseId: string;
  toCourseName?: string;
  status: 'pending' | 'approved' | 'rejected';
  statusText?: string;
  requestedAt: Date;
  processedAt?: Date;
  rejectReason?: string;
}

export interface ClassSummary {
  className: string;
  totalStudents: number;
  enrolledCount: number;
  enrollmentRate: string;
  students: Array<{
    id: string;
    name: string;
    grade: number;
    enrollments: Array<{
      courseName: string;
      status: string;
      dayOfWeek: string;
      timeSlot: string;
    }>;
  }>;
}

export interface ExportData {
  className: string;
  totalStudents: number;
  enrolledCount: number;
  enrollmentRate: string;
  students: Array<{
    name: string;
    grade: number;
    courses: string;
    courseDetails: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}
