import { Repository } from './base';
import { Teacher, Student, Class, PackageTemplate, StudentPackage, Lesson, LessonBooking, Leave, MakeupTicket, Waitlist, Notification, TeacherPayment, PackageUsageLog } from '../types';

export class TeacherRepository extends Repository<Teacher> {
  constructor() {
    super('teachers');
  }

  findActive(): Teacher[] {
    const stmt = db.prepare(`SELECT * FROM teachers WHERE status = 'active' ORDER BY name`);
    return stmt.all() as Teacher[];
  }
}

export class StudentRepository extends Repository<Student> {
  constructor() {
    super('students');
  }

  findActive(): Student[] {
    const stmt = db.prepare(`SELECT * FROM students WHERE status = 'active' ORDER BY name`);
    return stmt.all() as Student[];
  }

  searchByNameOrPhone(query: string): Student[] {
    const searchQuery = `%${query}%`;
    const stmt = db.prepare(`
      SELECT * FROM students 
      WHERE status = 'active' 
        AND (name LIKE ? OR phone LIKE ? OR guardian_name LIKE ? OR guardian_phone LIKE ?)
      ORDER BY name
    `);
    return stmt.all(searchQuery, searchQuery, searchQuery, searchQuery) as Student[];
  }
}

export class ClassRepository extends Repository<Class> {
  constructor() {
    super('classes');
  }

  findActive(): Class[] {
    const stmt = db.prepare(`SELECT * FROM classes WHERE status = 'active' ORDER BY name`);
    return stmt.all() as Class[];
  }

  findByTeacherId(teacherId: string): Class[] {
    const stmt = db.prepare(`SELECT * FROM classes WHERE teacher_id = ? AND status = 'active' ORDER BY name`);
    return stmt.all(teacherId) as Class[];
  }
}

export class PackageTemplateRepository extends Repository<PackageTemplate> {
  constructor() {
    super('package_templates');
  }

  findActive(): PackageTemplate[] {
    const stmt = db.prepare(`SELECT * FROM package_templates WHERE status = 'active' ORDER BY name`);
    return stmt.all() as PackageTemplate[];
  }
}

export class StudentPackageRepository extends Repository<StudentPackage> {
  constructor() {
    super('student_packages');
  }

  findByStudentId(studentId: string): StudentPackage[] {
    const stmt = db.prepare(`
      SELECT * FROM student_packages 
      WHERE student_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(studentId) as StudentPackage[];
  }

  findActiveByStudentId(studentId: string): StudentPackage[] {
    const stmt = db.prepare(`
      SELECT * FROM student_packages 
      WHERE student_id = ? 
        AND status = 'active' 
        AND is_frozen = 0
      ORDER BY valid_to ASC
    `);
    return stmt.all(studentId) as StudentPackage[];
  }

  findFrozenByStudentId(studentId: string): StudentPackage[] {
    const stmt = db.prepare(`
      SELECT * FROM student_packages 
      WHERE student_id = ? AND is_frozen = 1
      ORDER BY frozen_at DESC
    `);
    return stmt.all(studentId) as StudentPackage[];
  }
}

export class LessonRepository extends Repository<Lesson> {
  constructor() {
    super('lessons');
  }

  findByClassId(classId: string): Lesson[] {
    const stmt = db.prepare(`
      SELECT * FROM lessons 
      WHERE class_id = ? 
      ORDER BY start_time DESC
    `);
    return stmt.all(classId) as Lesson[];
  }

  findByTimeRange(startTime: string, endTime: string): Lesson[] {
    const stmt = db.prepare(`
      SELECT * FROM lessons 
      WHERE start_time >= ? AND start_time < ?
      ORDER BY start_time ASC
    `);
    return stmt.all(startTime, endTime) as Lesson[];
  }

  findScheduled(): Lesson[] {
    const stmt = db.prepare(`
      SELECT * FROM lessons 
      WHERE status = 'scheduled' 
      ORDER BY start_time ASC
    `);
    return stmt.all() as Lesson[];
  }

  findByStudentAndTime(studentId: string, startTime: string, endTime: string): Lesson[] {
    const stmt = db.prepare(`
      SELECT l.* FROM lessons l
      JOIN lesson_bookings lb ON l.id = lb.lesson_id
      WHERE lb.student_id = ? 
        AND l.status = 'scheduled'
        AND lb.status IN ('booked', 'checked_in')
        AND (l.start_time < ? AND l.end_time > ?)
    `);
    return stmt.all(studentId, endTime, startTime) as Lesson[];
  }
}

export class LessonBookingRepository extends Repository<LessonBooking> {
  constructor() {
    super('lesson_bookings');
  }

  findByLessonId(lessonId: string): LessonBooking[] {
    const stmt = db.prepare(`
      SELECT * FROM lesson_bookings 
      WHERE lesson_id = ? 
      ORDER BY created_at ASC
    `);
    return stmt.all(lessonId) as LessonBooking[];
  }

  findByStudentId(studentId: string): LessonBooking[] {
    const stmt = db.prepare(`
      SELECT * FROM lesson_bookings 
      WHERE student_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(studentId) as LessonBooking[];
  }

  findActiveByLessonId(lessonId: string): LessonBooking[] {
    const stmt = db.prepare(`
      SELECT * FROM lesson_bookings 
      WHERE lesson_id = ? AND status IN ('booked', 'checked_in')
      ORDER BY created_at ASC
    `);
    return stmt.all(lessonId) as LessonBooking[];
  }

  countActiveByLessonId(lessonId: string): number {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM lesson_bookings 
      WHERE lesson_id = ? AND status IN ('booked', 'checked_in')
    `);
    const result = stmt.get(lessonId) as { count: number };
    return result.count;
  }

  findByStudentAndLesson(studentId: string, lessonId: string): LessonBooking | undefined {
    const stmt = db.prepare(`
      SELECT * FROM lesson_bookings 
      WHERE student_id = ? AND lesson_id = ?
    `);
    return stmt.get(studentId, lessonId) as LessonBooking | undefined;
  }
}

export class LeaveRepository extends Repository<Leave> {
  constructor() {
    super('leaves');
  }

  findByStudentId(studentId: string): Leave[] {
    const stmt = db.prepare(`
      SELECT * FROM leaves 
      WHERE student_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(studentId) as Leave[];
  }

  findByBookingId(bookingId: string): Leave | undefined {
    const stmt = db.prepare(`
      SELECT * FROM leaves 
      WHERE lesson_booking_id = ?
    `);
    return stmt.get(bookingId) as Leave | undefined;
  }
}

export class MakeupTicketRepository extends Repository<MakeupTicket> {
  constructor() {
    super('makeup_tickets');
  }

  findByStudentId(studentId: string): MakeupTicket[] {
    const stmt = db.prepare(`
      SELECT * FROM makeup_tickets 
      WHERE student_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(studentId) as MakeupTicket[];
  }

  findAvailableByStudentId(studentId: string): MakeupTicket[] {
    const stmt = db.prepare(`
      SELECT * FROM makeup_tickets 
      WHERE student_id = ? 
        AND status = 'available'
        AND valid_to > datetime('now')
      ORDER BY valid_to ASC
    `);
    return stmt.all(studentId) as MakeupTicket[];
  }

  findByLeaveId(leaveId: string): MakeupTicket | undefined {
    const stmt = db.prepare(`
      SELECT * FROM makeup_tickets 
      WHERE leave_id = ?
    `);
    return stmt.get(leaveId) as MakeupTicket | undefined;
  }
}

export class WaitlistRepository extends Repository<Waitlist> {
  constructor() {
    super('waitlists');
  }

  findByLessonId(lessonId: string): Waitlist[] {
    const stmt = db.prepare(`
      SELECT * FROM waitlists 
      WHERE lesson_id = ? 
      ORDER BY position ASC
    `);
    return stmt.all(lessonId) as Waitlist[];
  }

  findWaitingByLessonId(lessonId: string): Waitlist[] {
    const stmt = db.prepare(`
      SELECT * FROM waitlists 
      WHERE lesson_id = ? AND status = 'waiting'
      ORDER BY position ASC
    `);
    return stmt.all(lessonId) as Waitlist[];
  }

  findByStudentAndLesson(studentId: string, lessonId: string): Waitlist | undefined {
    const stmt = db.prepare(`
      SELECT * FROM waitlists 
      WHERE student_id = ? AND lesson_id = ? AND status = 'waiting'
    `);
    return stmt.get(studentId, lessonId) as Waitlist | undefined;
  }

  getNextPosition(lessonId: string): number {
    const stmt = db.prepare(`
      SELECT MAX(position) as max_pos FROM waitlists 
      WHERE lesson_id = ? AND status = 'waiting'
    `);
    const result = stmt.get(lessonId) as { max_pos: number | null };
    return (result.max_pos || 0) + 1;
  }
}

export class NotificationRepository extends Repository<Notification> {
  constructor() {
    super('notifications');
  }

  findUnread(): Notification[] {
    const stmt = db.prepare(`
      SELECT * FROM notifications 
      WHERE is_read = 0 
      ORDER BY created_at DESC
    `);
    return stmt.all() as Notification[];
  }
}

export class TeacherPaymentRepository extends Repository<TeacherPayment> {
  constructor() {
    super('teacher_payments');
  }

  findByTeacherId(teacherId: string): TeacherPayment[] {
    const stmt = db.prepare(`
      SELECT * FROM teacher_payments 
      WHERE teacher_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(teacherId) as TeacherPayment[];
  }

  findPending(): TeacherPayment[] {
    const stmt = db.prepare(`
      SELECT * FROM teacher_payments 
      WHERE status = 'pending' 
      ORDER BY created_at ASC
    `);
    return stmt.all() as TeacherPayment[];
  }

  findByMonth(teacherId: string, year: number, month: number): TeacherPayment[] {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
    const endDate = month === 12 
      ? `${year + 1}-01-01 00:00:00` 
      : `${year}-${String(month + 1).padStart(2, '0')}-01 00:00:00`;
    
    const stmt = db.prepare(`
      SELECT * FROM teacher_payments 
      WHERE teacher_id = ? 
        AND created_at >= ? 
        AND created_at < ?
      ORDER BY created_at ASC
    `);
    return stmt.all(teacherId, startDate, endDate) as TeacherPayment[];
  }
}

export class PackageUsageLogRepository extends Repository<PackageUsageLog> {
  constructor() {
    super('package_usage_logs');
  }

  findByPackageId(packageId: string): PackageUsageLog[] {
    const stmt = db.prepare(`
      SELECT * FROM package_usage_logs 
      WHERE student_package_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(packageId) as PackageUsageLog[];
  }
}

import { db } from '../database/connection';
