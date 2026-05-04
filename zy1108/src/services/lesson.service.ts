import { 
  Lesson, LessonBooking, Leave, MakeupTicket, Waitlist, 
  Student, Teacher, Class, StudentPackage 
} from '../types';
import {
  LessonRepository, LessonBookingRepository, LeaveRepository,
  MakeupTicketRepository, WaitlistRepository, StudentRepository,
  TeacherRepository, ClassRepository, StudentPackageRepository,
  NotificationRepository, TeacherPaymentRepository, PackageUsageLogRepository
} from '../repositories';
import { BusinessError, ErrorCodes } from '../errors';
import { isExpired, now, addDays, isDateOverlap } from '../utils/date';
import dayjs from 'dayjs';

export class LessonService {
  private readonly lessonRepo: LessonRepository;
  private readonly bookingRepo: LessonBookingRepository;
  private readonly leaveRepo: LeaveRepository;
  private readonly makeupTicketRepo: MakeupTicketRepository;
  private readonly waitlistRepo: WaitlistRepository;
  private readonly studentRepo: StudentRepository;
  private readonly teacherRepo: TeacherRepository;
  private readonly classRepo: ClassRepository;
  private readonly packageRepo: StudentPackageRepository;
  private readonly notificationRepo: NotificationRepository;
  private readonly paymentRepo: TeacherPaymentRepository;

  constructor() {
    this.lessonRepo = new LessonRepository();
    this.bookingRepo = new LessonBookingRepository();
    this.leaveRepo = new LeaveRepository();
    this.makeupTicketRepo = new MakeupTicketRepository();
    this.waitlistRepo = new WaitlistRepository();
    this.studentRepo = new StudentRepository();
    this.teacherRepo = new TeacherRepository();
    this.classRepo = new ClassRepository();
    this.packageRepo = new StudentPackageRepository();
    this.notificationRepo = new NotificationRepository();
    this.paymentRepo = new TeacherPaymentRepository();
  }

  async createLesson(data: {
    class_id: string;
    teacher_id?: string;
    start_time: string;
    end_time: string;
    location?: string;
    capacity?: number;
    notes?: string;
  }): Promise<Lesson> {
    const cls = this.classRepo.findById(data.class_id);
    if (!cls) {
      throw new BusinessError(ErrorCodes.CLASS_NOT_FOUND, '班级不存在');
    }

    const teacherId = data.teacher_id || cls.teacher_id;
    const teacher = this.teacherRepo.findById(teacherId);
    if (!teacher) {
      throw new BusinessError(ErrorCodes.TEACHER_NOT_FOUND, '老师不存在');
    }

    const capacity = data.capacity || cls.capacity;

    return this.lessonRepo.create({
      class_id: data.class_id,
      teacher_id: teacherId,
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location,
      capacity,
      status: 'scheduled',
      notes: data.notes,
    });
  }

  async getLesson(id: string): Promise<Lesson & {
    class?: Class;
    teacher?: Teacher;
    bookings?: (LessonBooking & { student?: Student })[];
    waitlist?: (Waitlist & { student?: Student })[];
  }> {
    const lesson = this.lessonRepo.findById(id);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    const cls = this.classRepo.findById(lesson.class_id);
    const teacher = this.teacherRepo.findById(lesson.teacher_id);
    const bookings = this.bookingRepo.findByLessonId(id);
    const waitlist = this.waitlistRepo.findByLessonId(id);

    const bookingsWithStudents = await Promise.all(
      bookings.map(async (b) => {
        const student = this.studentRepo.findById(b.student_id);
        return { ...b, student };
      })
    );

    const waitlistWithStudents = await Promise.all(
      waitlist.map(async (w) => {
        const student = this.studentRepo.findById(w.student_id);
        return { ...w, student };
      })
    );

    return {
      ...lesson,
      class: cls,
      teacher,
      bookings: bookingsWithStudents,
      waitlist: waitlistWithStudents,
    };
  }

  async getLessonsByTimeRange(startTime: string, endTime: string): Promise<Lesson[]> {
    return this.lessonRepo.findByTimeRange(startTime, endTime);
  }

  async bookLesson(studentId: string, lessonId: string, packageId?: string): Promise<LessonBooking> {
    const student = this.studentRepo.findById(studentId);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }

    const lesson = this.lessonRepo.findById(lessonId);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (lesson.status !== 'scheduled') {
      throw new BusinessError(
        ErrorCodes.LESSON_COMPLETED,
        '课次已结束或已取消，无法预约',
        { lessonStatus: lesson.status }
      );
    }

    const existingBooking = this.bookingRepo.findByStudentAndLesson(studentId, lessonId);
    if (existingBooking && existingBooking.status !== 'cancelled') {
      throw new BusinessError(
        ErrorCodes.STUDENT_ALREADY_BOOKED,
        '学生已预约该课次',
        { lessonId, studentId }
      );
    }

    const existingWaitlist = this.waitlistRepo.findByStudentAndLesson(studentId, lessonId);
    if (existingWaitlist && existingWaitlist.status === 'waiting') {
      throw new BusinessError(
        ErrorCodes.ALREADY_ON_WAITLIST,
        '学生已在该课次的候补列表中',
        { lessonId, studentId }
      );
    }

    const currentBookedCount = this.bookingRepo.countActiveByLessonId(lessonId);
    if (currentBookedCount >= lesson.capacity) {
      throw new BusinessError(
        ErrorCodes.CLASS_CAPACITY_FULL,
        '课次已满，可加入候补',
        { capacity: lesson.capacity, booked: currentBookedCount }
      );
    }

    const conflictingLessons = this.lessonRepo.findByStudentAndTime(
      studentId,
      lesson.start_time,
      lesson.end_time
    );
    if (conflictingLessons.length > 0) {
      throw new BusinessError(
        ErrorCodes.TIME_SLOT_CONFLICT,
        '学生在同一时间已有其他预约',
        { 
          conflictLessonIds: conflictingLessons.map(l => l.id),
          startTime: lesson.start_time,
          endTime: lesson.end_time
        }
      );
    }

    const activePackages = this.packageRepo.findActiveByStudentId(studentId);
    const validPackages = activePackages.filter(pkg => !isExpired(pkg.valid_to));
    const availablePackage = packageId 
      ? validPackages.find(p => p.id === packageId && (p.total_lessons - p.used_lessons) > 0)
      : validPackages.find(p => (p.total_lessons - p.used_lessons) > 0);

    if (!availablePackage && !packageId) {
      throw new BusinessError(
        ErrorCodes.INSUFFICIENT_LESSONS,
        '没有可用的课包，请先购买课包',
        { studentId }
      );
    }

    if (packageId && !availablePackage) {
      const pkg = this.packageRepo.findById(packageId);
      if (!pkg) {
        throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
      }
      if (isExpired(pkg.valid_to)) {
        throw new BusinessError(
          ErrorCodes.PACKAGE_EXPIRED,
          '课包已过期',
          { packageId, validTo: pkg.valid_to }
        );
      }
      if (pkg.is_frozen) {
        throw new BusinessError(
          ErrorCodes.PACKAGE_FROZEN,
          '课包已被冻结',
          { packageId }
        );
      }
      if ((pkg.total_lessons - pkg.used_lessons) <= 0) {
        throw new BusinessError(
          ErrorCodes.INSUFFICIENT_LESSONS,
          '课包余额不足',
          { packageId, balance: pkg.total_lessons - pkg.used_lessons }
        );
      }
    }

    const booking = this.bookingRepo.create({
      lesson_id: lessonId,
      student_id: studentId,
      student_package_id: availablePackage?.id || packageId,
      status: 'booked',
      is_makeup: 0,
    });

    this.notificationRepo.create({
      title: '预约成功',
      content: `${student.name} 已成功预约 ${lesson.start_time} 的课程`,
      type: 'success',
      target_type: 'booking',
      target_id: booking.id,
    });

    return booking;
  }

  async joinWaitlist(studentId: string, lessonId: string): Promise<Waitlist> {
    const student = this.studentRepo.findById(studentId);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }

    const lesson = this.lessonRepo.findById(lessonId);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (lesson.status !== 'scheduled') {
      throw new BusinessError(
        ErrorCodes.LESSON_COMPLETED,
        '课次已结束或已取消，无法加入候补',
        { lessonStatus: lesson.status }
      );
    }

    const existingBooking = this.bookingRepo.findByStudentAndLesson(studentId, lessonId);
    if (existingBooking && existingBooking.status !== 'cancelled') {
      throw new BusinessError(
        ErrorCodes.STUDENT_ALREADY_BOOKED,
        '学生已预约该课次，无需加入候补',
        { lessonId, studentId }
      );
    }

    const existingWaitlist = this.waitlistRepo.findByStudentAndLesson(studentId, lessonId);
    if (existingWaitlist && existingWaitlist.status === 'waiting') {
      throw new BusinessError(
        ErrorCodes.ALREADY_ON_WAITLIST,
        '学生已在该课次的候补列表中',
        { lessonId, studentId, position: existingWaitlist.position }
      );
    }

    const position = this.waitlistRepo.getNextPosition(lessonId);

    const waitlist = this.waitlistRepo.create({
      lesson_id: lessonId,
      student_id: studentId,
      position,
      status: 'waiting',
    });

    this.notificationRepo.create({
      title: '候补成功',
      content: `${student.name} 已加入 ${lesson.start_time} 课程的候补，当前位置：${position}`,
      type: 'info',
      target_type: 'waitlist',
      target_id: waitlist.id,
    });

    return waitlist;
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<LessonBooking> {
    const booking = this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new BusinessError(ErrorCodes.BOOKING_NOT_FOUND, '预约不存在');
    }

    const lesson = this.lessonRepo.findById(booking.lesson_id);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (lesson.status === 'completed') {
      throw new BusinessError(
        ErrorCodes.LESSON_COMPLETED,
        '课次已完成，无法取消预约',
        { lessonId: lesson.id }
      );
    }

    if (booking.status === 'cancelled') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '预约已取消',
        { bookingId }
      );
    }

    if (booking.student_package_id && booking.status === 'booked') {
      const usageLogRepo = new PackageUsageLogRepository();
      const logs = usageLogRepo.findByPackageId(booking.student_package_id);
      const hasDeducted = logs.some(l => l.lesson_booking_id === bookingId && l.action === 'deduct');
      
      if (!hasDeducted && !booking.is_makeup) {
        const pkg = this.packageRepo.findById(booking.student_package_id);
        if (pkg && pkg.used_lessons > 0) {
          this.packageRepo.update(booking.student_package_id, {
            used_lessons: pkg.used_lessons - 1,
          });
        }
      }
    }

    const updatedBooking = this.bookingRepo.update(bookingId, {
      status: 'cancelled',
    });

    const waitlistItems = this.waitlistRepo.findWaitingByLessonId(lesson.id);
    if (waitlistItems.length > 0) {
      this.notificationRepo.create({
        title: '有候补空位',
        content: `课次 ${lesson.start_time} 有空位，当前有 ${waitlistItems.length} 名候补学生`,
        type: 'warning',
        target_type: 'lesson',
        target_id: lesson.id,
      });
    }

    return updatedBooking!;
  }

  async requestLeave(bookingId: string, reason?: string): Promise<{ leave: Leave; makeupTicket: MakeupTicket }> {
    const booking = this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new BusinessError(ErrorCodes.BOOKING_NOT_FOUND, '预约不存在');
    }

    const lesson = this.lessonRepo.findById(booking.lesson_id);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    const existingLeave = this.leaveRepo.findByBookingId(bookingId);
    if (existingLeave) {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '该预约已有请假记录',
        { bookingId, leaveId: existingLeave.id }
      );
    }

    const leave = this.leaveRepo.create({
      lesson_booking_id: bookingId,
      student_id: booking.student_id,
      lesson_id: booking.lesson_id,
      leave_type: 'student',
      reason,
      status: 'approved',
    });

    this.bookingRepo.update(bookingId, {
      status: 'cancelled',
    });

    const validFrom = now();
    const validTo = addDays(validFrom, 90);

    const makeupTicket = this.makeupTicketRepo.create({
      student_id: booking.student_id,
      leave_id: leave.id,
      original_lesson_id: booking.lesson_id,
      valid_from: validFrom,
      valid_to: validTo,
      status: 'available',
    });

    const student = this.studentRepo.findById(booking.student_id);
    this.notificationRepo.create({
      title: '请假成功',
      content: `${student?.name || '学生'} 已成功请假，生成补课券，有效期至 ${validTo}`,
      type: 'info',
      target_type: 'leave',
      target_id: leave.id,
    });

    const waitlistItems = this.waitlistRepo.findWaitingByLessonId(lesson.id);
    if (waitlistItems.length > 0) {
      this.notificationRepo.create({
        title: '有候补空位',
        content: `课次 ${lesson.start_time} 有空位（学生请假），当前有 ${waitlistItems.length} 名候补学生`,
        type: 'warning',
        target_type: 'lesson',
        target_id: lesson.id,
      });
    }

    return { leave, makeupTicket };
  }

  async useMakeupTicket(ticketId: string, lessonId: string): Promise<LessonBooking> {
    const ticket = this.makeupTicketRepo.findById(ticketId);
    if (!ticket) {
      throw new BusinessError(ErrorCodes.MAKEUP_TICKET_NOT_FOUND, '补课券不存在');
    }

    if (ticket.status === 'used') {
      throw new BusinessError(
        ErrorCodes.MAKEUP_TICKET_USED,
        '补课券已使用',
        { ticketId }
      );
    }

    if (isExpired(ticket.valid_to)) {
      throw new BusinessError(
        ErrorCodes.MAKEUP_TICKET_EXPIRED,
        '补课券已过期',
        { ticketId, validTo: ticket.valid_to }
      );
    }

    const student = this.studentRepo.findById(ticket.student_id);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }

    const lesson = this.lessonRepo.findById(lessonId);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (lesson.status !== 'scheduled') {
      throw new BusinessError(
        ErrorCodes.LESSON_COMPLETED,
        '课次已结束或已取消，无法使用补课券',
        { lessonStatus: lesson.status }
      );
    }

    const existingBooking = this.bookingRepo.findByStudentAndLesson(ticket.student_id, lessonId);
    if (existingBooking && existingBooking.status !== 'cancelled') {
      throw new BusinessError(
        ErrorCodes.STUDENT_ALREADY_BOOKED,
        '学生已预约该课次',
        { lessonId, studentId: ticket.student_id }
      );
    }

    const currentBookedCount = this.bookingRepo.countActiveByLessonId(lessonId);
    if (currentBookedCount >= lesson.capacity) {
      throw new BusinessError(
        ErrorCodes.CLASS_CAPACITY_FULL,
        '课次已满',
        { capacity: lesson.capacity, booked: currentBookedCount }
      );
    }

    const conflictingLessons = this.lessonRepo.findByStudentAndTime(
      ticket.student_id,
      lesson.start_time,
      lesson.end_time
    );
    if (conflictingLessons.length > 0) {
      throw new BusinessError(
        ErrorCodes.TIME_SLOT_CONFLICT,
        '学生在同一时间已有其他预约',
        { conflictLessonIds: conflictingLessons.map(l => l.id) }
      );
    }

    const booking = this.bookingRepo.create({
      lesson_id: lessonId,
      student_id: ticket.student_id,
      status: 'booked',
      is_makeup: 1,
      makeup_ticket_id: ticketId,
    });

    this.makeupTicketRepo.update(ticketId, {
      status: 'used',
      used_lesson_id: lessonId,
    });

    this.notificationRepo.create({
      title: '补课成功',
      content: `${student.name} 已成功使用补课券预约 ${lesson.start_time} 的课程`,
      type: 'success',
      target_type: 'booking',
      target_id: booking.id,
    });

    return booking;
  }

  async checkIn(bookingId: string): Promise<LessonBooking> {
    const booking = this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new BusinessError(ErrorCodes.BOOKING_NOT_FOUND, '预约不存在');
    }

    const lesson = this.lessonRepo.findById(booking.lesson_id);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (booking.status !== 'booked') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '只有已预约状态才能签到',
        { bookingId, currentStatus: booking.status }
      );
    }

    if (!booking.is_makeup && booking.student_package_id) {
      const pkg = this.packageRepo.findById(booking.student_package_id);
      if (pkg) {
        if (pkg.is_frozen) {
          throw new BusinessError(
            ErrorCodes.PACKAGE_FROZEN,
            '课包已被冻结，无法签到',
            { packageId: pkg.id }
          );
        }
        if (isExpired(pkg.valid_to)) {
          throw new BusinessError(
            ErrorCodes.PACKAGE_EXPIRED,
            '课包已过期',
            { packageId: pkg.id, validTo: pkg.valid_to }
          );
        }
        const balance = pkg.total_lessons - pkg.used_lessons;
        if (balance <= 0) {
          throw new BusinessError(
            ErrorCodes.INSUFFICIENT_LESSONS,
            '课包余额不足',
            { packageId: pkg.id, balance }
          );
        }

        this.packageRepo.update(booking.student_package_id, {
          used_lessons: pkg.used_lessons + 1,
        });

        const usageLogRepo = new PackageUsageLogRepository();
        usageLogRepo.create({
          student_package_id: booking.student_package_id,
          lesson_booking_id: bookingId,
          action: 'deduct',
          change_amount: -1,
          balance_before: balance,
          balance_after: balance - 1,
          reason: '签到扣课',
        });
      }
    }

    const checkInTime = now();
    const updatedBooking = this.bookingRepo.update(bookingId, {
      status: 'checked_in',
      check_in_time: checkInTime,
    });

    return updatedBooking!;
  }

  async markAbsent(bookingId: string, reason?: string): Promise<LessonBooking> {
    const booking = this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new BusinessError(ErrorCodes.BOOKING_NOT_FOUND, '预约不存在');
    }

    if (booking.status === 'checked_in') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '学生已签到，无法标记为旷课',
        { bookingId }
      );
    }

    if (booking.status === 'absent') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '已标记为旷课',
        { bookingId }
      );
    }

    return this.bookingRepo.update(bookingId, {
      status: 'absent',
    })!;
  }

  async convertWaitlist(waitlistId: string, packageId?: string): Promise<LessonBooking> {
    const waitlist = this.waitlistRepo.findById(waitlistId);
    if (!waitlist) {
      throw new BusinessError(ErrorCodes.WAITLIST_NOT_FOUND, '候补记录不存在');
    }

    if (waitlist.status !== 'waiting') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '该候补已处理或已取消',
        { waitlistId, currentStatus: waitlist.status }
      );
    }

    const lesson = this.lessonRepo.findById(waitlist.lesson_id);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    const currentBookedCount = this.bookingRepo.countActiveByLessonId(waitlist.lesson_id);
    if (currentBookedCount >= lesson.capacity) {
      throw new BusinessError(
        ErrorCodes.CLASS_CAPACITY_FULL,
        '课次已满，无法转正候补',
        { capacity: lesson.capacity, booked: currentBookedCount }
      );
    }

    const booking = this.bookingRepo.create({
      lesson_id: waitlist.lesson_id,
      student_id: waitlist.student_id,
      student_package_id: packageId,
      status: 'booked',
      is_makeup: 0,
    });

    this.waitlistRepo.update(waitlistId, {
      status: 'converted',
      converted_booking_id: booking.id,
    });

    const student = this.studentRepo.findById(waitlist.student_id);
    this.notificationRepo.create({
      title: '候补转正成功',
      content: `${student?.name || '学生'} 的候补已成功转正，预约了 ${lesson.start_time} 的课程`,
      type: 'success',
      target_type: 'booking',
      target_id: booking.id,
    });

    return booking;
  }

  async getAvailableMakeupTickets(studentId: string): Promise<MakeupTicket[]> {
    return this.makeupTicketRepo.findAvailableByStudentId(studentId);
  }

  async getWaitlistByLesson(lessonId: string): Promise<(Waitlist & { student?: Student })[]> {
    const waitlist = this.waitlistRepo.findByLessonId(lessonId);
    return Promise.all(
      waitlist.map(async (w) => {
        const student = this.studentRepo.findById(w.student_id);
        return { ...w, student };
      })
    );
  }

  async completeLesson(lessonId: string): Promise<Lesson> {
    const lesson = this.lessonRepo.findById(lessonId);
    if (!lesson) {
      throw new BusinessError(ErrorCodes.LESSON_NOT_FOUND, '课次不存在');
    }

    if (lesson.status === 'completed') {
      throw new BusinessError(
        ErrorCodes.OPERATION_NOT_ALLOWED,
        '课次已完成',
        { lessonId }
      );
    }

    const updatedLesson = this.lessonRepo.update(lessonId, {
      status: 'completed',
    });

    const teacher = this.teacherRepo.findById(lesson.teacher_id);
    if (teacher && teacher.hourly_rate > 0) {
      const start = dayjs(lesson.start_time);
      const end = dayjs(lesson.end_time);
      const hours = end.diff(start, 'hour', true);
      const amount = teacher.hourly_rate * hours;

      this.paymentRepo.create({
        teacher_id: lesson.teacher_id,
        lesson_id: lessonId,
        amount,
        status: 'pending',
      });
    }

    const bookings = this.bookingRepo.findByLessonId(lessonId);
    for (const booking of bookings) {
      if (booking.status === 'booked') {
        this.bookingRepo.update(booking.id, {
          status: 'absent',
        });
      }
    }

    const waitlist = this.waitlistRepo.findWaitingByLessonId(lessonId);
    for (const item of waitlist) {
      this.waitlistRepo.update(item.id, {
        status: 'cancelled',
      });
    }

    return updatedLesson!;
  }
}
