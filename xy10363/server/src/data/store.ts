import { Teacher, Course, Student, Enrollment, TransferRequest } from '../types';
import { mockTeachers, mockCourses, mockStudents } from './mockData';
import { v4 as uuidv4 } from 'uuid';

class DataStore {
  private teachers: Teacher[] = [...mockTeachers];
  private courses: Course[] = [...mockCourses];
  private students: Student[] = [...mockStudents];
  private enrollments: Enrollment[] = [];
  private transferRequests: TransferRequest[] = [];

  getTeachers(): Teacher[] {
    return [...this.teachers];
  }

  getTeacherById(id: string): Teacher | undefined {
    return this.teachers.find(t => t.id === id);
  }

  getCourses(): Course[] {
    return [...this.courses];
  }

  getCourseById(id: string): Course | undefined {
    return this.courses.find(c => c.id === id);
  }

  getStudents(): Student[] {
    return [...this.students];
  }

  getStudentById(id: string): Student | undefined {
    return this.students.find(s => s.id === id);
  }

  getEnrollments(): Enrollment[] {
    return [...this.enrollments];
  }

  getEnrollmentsByCourseId(courseId: string): Enrollment[] {
    return this.enrollments.filter(e => e.courseId === courseId);
  }

  getActiveEnrollmentsByCourseId(courseId: string): Enrollment[] {
    return this.enrollments.filter(e => e.courseId === courseId && e.status === 'active');
  }

  getWaitlistEnrollmentsByCourseId(courseId: string): Enrollment[] {
    return this.enrollments.filter(e => e.courseId === courseId && e.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0));
  }

  getEnrollmentsByStudentId(studentId: string): Enrollment[] {
    return this.enrollments.filter(e => e.studentId === studentId);
  }

  addEnrollment(enrollment: Omit<Enrollment, 'id'>): Enrollment {
    const newEnrollment: Enrollment = {
      ...enrollment,
      id: uuidv4(),
    };
    this.enrollments.push(newEnrollment);
    return newEnrollment;
  }

  updateEnrollment(enrollmentId: string, updates: Partial<Enrollment>): Enrollment | undefined {
    const index = this.enrollments.findIndex(e => e.id === enrollmentId);
    if (index !== -1) {
      this.enrollments[index] = { ...this.enrollments[index], ...updates };
      return this.enrollments[index];
    }
    return undefined;
  }

  removeEnrollment(enrollmentId: string): boolean {
    const index = this.enrollments.findIndex(e => e.id === enrollmentId);
    if (index !== -1) {
      this.enrollments.splice(index, 1);
      return true;
    }
    return false;
  }

  getNextWaitlistPosition(courseId: string): number {
    const waitlist = this.getWaitlistEnrollmentsByCourseId(courseId);
    return waitlist.length > 0 ? (Math.max(...waitlist.map(e => e.waitlistPosition || 0)) + 1) : 1;
  }

  getTransferRequests(): TransferRequest[] {
    return [...this.transferRequests];
  }

  getTransferRequestsByStudentId(studentId: string): TransferRequest[] {
    return this.transferRequests.filter(t => t.studentId === studentId);
  }

  addTransferRequest(request: Omit<TransferRequest, 'id'>): TransferRequest {
    const newRequest: TransferRequest = {
      ...request,
      id: uuidv4(),
    };
    this.transferRequests.push(newRequest);
    return newRequest;
  }

  updateTransferRequest(requestId: string, updates: Partial<TransferRequest>): TransferRequest | undefined {
    const index = this.transferRequests.findIndex(t => t.id === requestId);
    if (index !== -1) {
      this.transferRequests[index] = { ...this.transferRequests[index], ...updates };
      return this.transferRequests[index];
    }
    return undefined;
  }

  refreshWaitlistPositions(courseId: string): void {
    const waitlist = this.enrollments.filter(e => e.courseId === courseId && e.status === 'waitlist')
      .sort((a, b) => a.enrolledAt.getTime() - b.enrolledAt.getTime());
    
    waitlist.forEach((enrollment, index) => {
      const enrollmentIndex = this.enrollments.findIndex(e => e.id === enrollment.id);
      if (enrollmentIndex !== -1) {
        this.enrollments[enrollmentIndex].waitlistPosition = index + 1;
      }
    });
  }
}

export const store = new DataStore();
