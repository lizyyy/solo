import { store } from '../data/store';
import { BusinessError, ErrorCodes, ErrorMessages } from '../utils/errors';
import { Enrollment, TransferRequest } from '../types';

class EnrollmentService {
  validateGrade(studentId: string, courseId: string): void {
    const student = store.getStudentById(studentId);
    const course = store.getCourseById(courseId);
    
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, ErrorMessages[ErrorCodes.STUDENT_NOT_FOUND]);
    }
    
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    if (!course.allowedGrades.includes(student.grade)) {
      throw new BusinessError(
        ErrorCodes.GRADE_NOT_ALLOWED,
        ErrorMessages[ErrorCodes.GRADE_NOT_ALLOWED](student.name, student.grade, course.name, course.allowedGrades)
      );
    }
  }

  validateTeacherQualification(courseId: string): void {
    const course = store.getCourseById(courseId);
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    const teacher = store.getTeacherById(course.teacherId);
    if (!teacher) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, ErrorMessages[ErrorCodes.TEACHER_NOT_FOUND]);
    }
    
    if (!teacher.qualifications.includes(course.requiredQualification)) {
      throw new BusinessError(
        ErrorCodes.TEACHER_QUALIFICATION_MISMATCH,
        ErrorMessages[ErrorCodes.TEACHER_QUALIFICATION_MISMATCH](teacher.name, course.name, course.requiredQualification)
      );
    }
  }

  validateTimeSlotConflict(studentId: string, courseId: string, excludeCourseId?: string): void {
    const student = store.getStudentById(studentId);
    const course = store.getCourseById(courseId);
    
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, ErrorMessages[ErrorCodes.STUDENT_NOT_FOUND]);
    }
    
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    const studentEnrollments = store.getEnrollmentsByStudentId(studentId)
      .filter(e => e.status === 'active' && e.courseId !== excludeCourseId);
    
    for (const enrollment of studentEnrollments) {
      const enrolledCourse = store.getCourseById(enrollment.courseId);
      if (enrolledCourse && 
          enrolledCourse.dayOfWeek === course.dayOfWeek && 
          enrolledCourse.timeSlot === course.timeSlot) {
        throw new BusinessError(
          ErrorCodes.TIME_SLOT_CONFLICT,
          ErrorMessages[ErrorCodes.TIME_SLOT_CONFLICT](student.name, course.dayOfWeek, course.timeSlot, enrolledCourse.name)
        );
      }
    }
  }

  validateAlreadyEnrolled(studentId: string, courseId: string): void {
    const student = store.getStudentById(studentId);
    const course = store.getCourseById(courseId);
    
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, ErrorMessages[ErrorCodes.STUDENT_NOT_FOUND]);
    }
    
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    const existingEnrollment = store.getEnrollmentsByStudentId(studentId)
      .find(e => e.courseId === courseId && e.status === 'active');
    
    if (existingEnrollment) {
      throw new BusinessError(
        ErrorCodes.ALREADY_ENROLLED,
        ErrorMessages[ErrorCodes.ALREADY_ENROLLED](student.name, course.name)
      );
    }
    
    const existingWaitlist = store.getEnrollmentsByStudentId(studentId)
      .find(e => e.courseId === courseId && e.status === 'waitlist');
    
    if (existingWaitlist) {
      throw new BusinessError(
        ErrorCodes.ALREADY_IN_WAITLIST,
        ErrorMessages[ErrorCodes.ALREADY_IN_WAITLIST](student.name, course.name)
      );
    }
  }

  isCourseFull(courseId: string): boolean {
    const course = store.getCourseById(courseId);
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    const activeEnrollments = store.getActiveEnrollmentsByCourseId(courseId);
    return activeEnrollments.length >= course.maxCapacity;
  }

  enroll(studentId: string, courseId: string): { enrollment: Enrollment; isWaitlist: boolean; waitlistPosition?: number } {
    this.validateGrade(studentId, courseId);
    this.validateTeacherQualification(courseId);
    this.validateTimeSlotConflict(studentId, courseId);
    this.validateAlreadyEnrolled(studentId, courseId);
    
    const course = store.getCourseById(courseId)!;
    const isFull = this.isCourseFull(courseId);
    
    if (isFull) {
      const waitlistPosition = store.getNextWaitlistPosition(courseId);
      const enrollment = store.addEnrollment({
        studentId,
        courseId,
        status: 'waitlist',
        waitlistPosition,
        enrolledAt: new Date(),
      });
      return { enrollment, isWaitlist: true, waitlistPosition };
    }
    
    const enrollment = store.addEnrollment({
      studentId,
      courseId,
      status: 'active',
      enrolledAt: new Date(),
    });
    
    return { enrollment, isWaitlist: false };
  }

  withdraw(enrollmentId: string): Enrollment {
    const enrollment = store.getEnrollments().find(e => e.id === enrollmentId);
    if (!enrollment) {
      throw new BusinessError(ErrorCodes.ENROLLMENT_NOT_FOUND, ErrorMessages[ErrorCodes.ENROLLMENT_NOT_FOUND]);
    }
    
    const courseId = enrollment.courseId;
    const wasActive = enrollment.status === 'active';
    
    store.updateEnrollment(enrollmentId, { status: 'withdrawn' });
    
    if (wasActive) {
      this.processWaitlist(courseId);
    } else if (enrollment.status === 'waitlist') {
      store.refreshWaitlistPositions(courseId);
    }
    
    return { ...enrollment, status: 'withdrawn' };
  }

  processWaitlist(courseId: string): void {
    const course = store.getCourseById(courseId);
    if (!course) return;
    
    const activeCount = store.getActiveEnrollmentsByCourseId(courseId).length;
    if (activeCount >= course.maxCapacity) return;
    
    const waitlist = store.getWaitlistEnrollmentsByCourseId(courseId);
    if (waitlist.length === 0) return;
    
    const nextEnrollment = waitlist[0];
    store.updateEnrollment(nextEnrollment.id, { status: 'active', waitlistPosition: undefined });
    store.refreshWaitlistPositions(courseId);
  }

  requestTransfer(studentId: string, fromCourseId: string, toCourseId: string): TransferRequest {
    const fromEnrollment = store.getEnrollmentsByStudentId(studentId)
      .find(e => e.courseId === fromCourseId && e.status === 'active');
    
    if (!fromEnrollment) {
      throw new BusinessError(
        ErrorCodes.INVALID_TRANSFER,
        `${store.getStudentById(studentId)?.name || '学生'}没有在${store.getCourseById(fromCourseId)?.name || '课程'}的有效报名`
      );
    }
    
    this.validateGrade(studentId, toCourseId);
    this.validateTeacherQualification(toCourseId);
    this.validateTimeSlotConflict(studentId, toCourseId, fromCourseId);
    
    const toCourse = store.getCourseById(toCourseId);
    if (!toCourse) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    const existingToEnrollment = store.getEnrollmentsByStudentId(studentId)
      .find(e => e.courseId === toCourseId);
    
    if (existingToEnrollment && existingToEnrollment.status === 'active') {
      throw new BusinessError(
        ErrorCodes.ALREADY_ENROLLED,
        ErrorMessages[ErrorCodes.ALREADY_ENROLLED](store.getStudentById(studentId)?.name || '', toCourse.name)
      );
    }
    
    return store.addTransferRequest({
      studentId,
      fromCourseId,
      toCourseId,
      status: 'pending',
      requestedAt: new Date(),
    });
  }

  approveTransfer(requestId: string): { fromEnrollment: Enrollment; toEnrollment: Enrollment; isWaitlist: boolean; waitlistPosition?: number } {
    const request = store.getTransferRequests().find(t => t.id === requestId);
    if (!request) {
      throw new BusinessError(ErrorCodes.TRANSFER_REQUEST_NOT_FOUND, ErrorMessages[ErrorCodes.TRANSFER_REQUEST_NOT_FOUND]);
    }
    
    if (request.status !== 'pending') {
      throw new BusinessError(ErrorCodes.TRANSFER_ALREADY_PROCESSED, ErrorMessages[ErrorCodes.TRANSFER_ALREADY_PROCESSED]);
    }
    
    const fromEnrollment = store.getEnrollmentsByStudentId(request.studentId)
      .find(e => e.courseId === request.fromCourseId && e.status === 'active');
    
    if (!fromEnrollment) {
      throw new BusinessError(
        ErrorCodes.INVALID_TRANSFER,
        '原课程报名已失效，无法进行改选'
      );
    }
    
    const course = store.getCourseById(request.toCourseId);
    if (!course) {
      throw new BusinessError(ErrorCodes.COURSE_NOT_FOUND, ErrorMessages[ErrorCodes.COURSE_NOT_FOUND]);
    }
    
    this.validateGrade(request.studentId, request.toCourseId);
    this.validateTimeSlotConflict(request.studentId, request.toCourseId, request.fromCourseId);
    
    const existingWaitlist = store.getEnrollmentsByStudentId(request.studentId)
      .find(e => e.courseId === request.toCourseId && e.status === 'waitlist');
    
    let toEnrollment: Enrollment;
    let isWaitlist: boolean;
    let waitlistPosition: number | undefined;
    
    if (existingWaitlist) {
      if (!this.isCourseFull(request.toCourseId)) {
        store.updateEnrollment(existingWaitlist.id, { status: 'active', waitlistPosition: undefined });
        store.refreshWaitlistPositions(request.toCourseId);
        toEnrollment = existingWaitlist;
        isWaitlist = false;
      } else {
        toEnrollment = existingWaitlist;
        isWaitlist = true;
        waitlistPosition = existingWaitlist.waitlistPosition;
      }
    } else {
      if (!this.isCourseFull(request.toCourseId)) {
        toEnrollment = store.addEnrollment({
          studentId: request.studentId,
          courseId: request.toCourseId,
          status: 'active',
          enrolledAt: new Date(),
        });
        isWaitlist = false;
      } else {
        waitlistPosition = store.getNextWaitlistPosition(request.toCourseId);
        toEnrollment = store.addEnrollment({
          studentId: request.studentId,
          courseId: request.toCourseId,
          status: 'waitlist',
          waitlistPosition,
          enrolledAt: new Date(),
        });
        isWaitlist = true;
      }
    }
    
    store.updateEnrollment(fromEnrollment.id, { status: 'withdrawn' });
    this.processWaitlist(request.fromCourseId);
    
    store.updateTransferRequest(requestId, { status: 'approved', processedAt: new Date() });
    
    return { fromEnrollment: { ...fromEnrollment, status: 'withdrawn' }, toEnrollment, isWaitlist, waitlistPosition };
  }

  rejectTransfer(requestId: string, reason: string): TransferRequest {
    const request = store.getTransferRequests().find(t => t.id === requestId);
    if (!request) {
      throw new BusinessError(ErrorCodes.TRANSFER_REQUEST_NOT_FOUND, ErrorMessages[ErrorCodes.TRANSFER_REQUEST_NOT_FOUND]);
    }
    
    if (request.status !== 'pending') {
      throw new BusinessError(ErrorCodes.TRANSFER_ALREADY_PROCESSED, ErrorMessages[ErrorCodes.TRANSFER_ALREADY_PROCESSED]);
    }
    
    return store.updateTransferRequest(requestId, { 
      status: 'rejected', 
      processedAt: new Date(),
      rejectReason: reason 
    })!;
  }

  getCourseStatistics() {
    const courses = store.getCourses();
    return courses.map(course => {
      const activeCount = store.getActiveEnrollmentsByCourseId(course.id).length;
      const waitlist = store.getWaitlistEnrollmentsByCourseId(course.id);
      const teacher = store.getTeacherById(course.teacherId);
      
      return {
        ...course,
        teacherName: teacher?.name || '未知老师',
        currentCount: activeCount,
        availableSeats: Math.max(0, course.maxCapacity - activeCount),
        isFull: activeCount >= course.maxCapacity,
        waitlistCount: waitlist.length,
        waitlist: waitlist.map(w => {
          const student = store.getStudentById(w.studentId);
          return {
            ...w,
            studentName: student?.name || '未知学生',
            studentGrade: student?.grade,
            studentClass: student?.className,
          };
        }),
        enrolledStudents: store.getActiveEnrollmentsByCourseId(course.id).map(e => {
          const student = store.getStudentById(e.studentId);
          return {
            ...e,
            studentName: student?.name || '未知学生',
            studentGrade: student?.grade,
            studentClass: student?.className,
          };
        }),
      };
    });
  }

  getStudentSchedule(studentId: string) {
    const student = store.getStudentById(studentId);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, ErrorMessages[ErrorCodes.STUDENT_NOT_FOUND]);
    }
    
    const enrollments = store.getEnrollmentsByStudentId(studentId)
      .filter(e => e.status === 'active' || e.status === 'waitlist');
    
    return enrollments.map(e => {
      const course = store.getCourseById(e.courseId);
      const teacher = course ? store.getTeacherById(course.teacherId) : undefined;
      
      return {
        ...e,
        courseName: course?.name || '未知课程',
        courseDescription: course?.description,
        teacherName: teacher?.name || '未知老师',
        dayOfWeek: course?.dayOfWeek,
        timeSlot: course?.timeSlot,
        allowedGrades: course?.allowedGrades,
      };
    });
  }

  getClassSummary() {
    const students = store.getStudents();
    const classMap = new Map<string, { 
      className: string; 
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
      totalStudents: number;
      enrolledCount: number;
    }>();
    
    students.forEach(student => {
      if (!classMap.has(student.classId)) {
        classMap.set(student.classId, {
          className: student.className,
          students: [],
          totalStudents: 0,
          enrolledCount: 0,
        });
      }
      
      const classInfo = classMap.get(student.classId)!;
      classInfo.totalStudents++;
      
      const studentEnrollments = store.getEnrollmentsByStudentId(student.id)
        .filter(e => e.status === 'active' || e.status === 'waitlist');
      
      if (studentEnrollments.length > 0) {
        classInfo.enrolledCount++;
      }
      
      classInfo.students.push({
        id: student.id,
        name: student.name,
        grade: student.grade,
        enrollments: studentEnrollments.map(e => {
          const course = store.getCourseById(e.courseId);
          return {
            courseName: course?.name || '未知课程',
            status: e.status === 'active' ? '已报名' : e.status === 'waitlist' ? '候补' : '已退出',
            dayOfWeek: course?.dayOfWeek || '',
            timeSlot: course?.timeSlot || '',
          };
        }),
      });
    });
    
    return Array.from(classMap.values())
      .map(classInfo => ({
        ...classInfo,
        students: classInfo.students.sort((a, b) => a.name.localeCompare(b.name)),
        enrollmentRate: classInfo.totalStudents > 0 
          ? ((classInfo.enrolledCount / classInfo.totalStudents) * 100).toFixed(1) 
          : '0.0',
      }))
      .sort((a, b) => a.className.localeCompare(b.className));
  }

  getExportData() {
    const classSummaries = this.getClassSummary();
    
    return classSummaries.map(classSummary => ({
      className: classSummary.className,
      totalStudents: classSummary.totalStudents,
      enrolledCount: classSummary.enrolledCount,
      enrollmentRate: `${classSummary.enrollmentRate}%`,
      students: classSummary.students.map(student => ({
        name: student.name,
        grade: student.grade,
        courses: student.enrollments.length > 0 
          ? student.enrollments.map(e => `${e.courseName}(${e.status})`).join('、')
          : '未报名',
        courseDetails: student.enrollments.length > 0
          ? student.enrollments.map(e => `${e.dayOfWeek} ${e.timeSlot} - ${e.courseName} (${e.status})`).join(';\n')
          : '未报名',
      })),
    }));
  }
}

export const enrollmentService = new EnrollmentService();
