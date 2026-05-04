import { Notification, TeacherPayment, StudentPackage, Student } from '../types';
import {
  NotificationRepository, TeacherPaymentRepository, TeacherRepository,
  StudentRepository, StudentPackageRepository, LessonBookingRepository,
  LessonRepository, MakeupTicketRepository
} from '../repositories';
import { isExpired } from '../utils/date';
import dayjs from 'dayjs';

export class NotificationService {
  private readonly notificationRepo: NotificationRepository;
  private readonly paymentRepo: TeacherPaymentRepository;
  private readonly teacherRepo: TeacherRepository;
  private readonly studentRepo: StudentRepository;
  private readonly packageRepo: StudentPackageRepository;
  private readonly bookingRepo: LessonBookingRepository;
  private readonly lessonRepo: LessonRepository;
  private readonly makeupTicketRepo: MakeupTicketRepository;

  constructor() {
    this.notificationRepo = new NotificationRepository();
    this.paymentRepo = new TeacherPaymentRepository();
    this.teacherRepo = new TeacherRepository();
    this.studentRepo = new StudentRepository();
    this.packageRepo = new StudentPackageRepository();
    this.bookingRepo = new LessonBookingRepository();
    this.lessonRepo = new LessonRepository();
    this.makeupTicketRepo = new MakeupTicketRepository();
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return this.notificationRepo.findUnread();
  }

  async getAllNotifications(): Promise<Notification[]> {
    return this.notificationRepo.findAll();
  }

  async markAsRead(id: string): Promise<Notification> {
    const updated = this.notificationRepo.update(id, {
      is_read: 1,
      read_at: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('通知不存在');
    }
    return updated;
  }

  async markAllAsRead(): Promise<number> {
    const unread = this.notificationRepo.findUnread();
    let count = 0;
    for (const n of unread) {
      this.notificationRepo.update(n.id, {
        is_read: 1,
        read_at: new Date().toISOString(),
      });
      count++;
    }
    return count;
  }

  async createNotification(data: {
    title: string;
    content?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    target_type?: string;
    target_id?: string;
  }): Promise<Notification> {
    return this.notificationRepo.create({
      title: data.title,
      content: data.content,
      type: data.type || 'info',
      target_type: data.target_type,
      target_id: data.target_id,
      is_read: 0,
    });
  }

  async generateToDos(): Promise<{
    expiringPackages: Array<{
      student: Student;
      package: StudentPackage;
      daysRemaining: number;
    }>;
    expiringMakeupTickets: Array<{
      student: Student;
      ticket: any;
      daysRemaining: number;
    }>;
    pendingPayments: Array<{
      teacher: any;
      payment: TeacherPayment;
    }>;
    lowBalancePackages: Array<{
      student: Student;
      package: StudentPackage;
      remaining: number;
    }>;
  }> {
    const now = dayjs();
    const expiringPackages: Array<{
      student: Student;
      package: StudentPackage;
      daysRemaining: number;
    }> = [];

    const expiringMakeupTickets: Array<{
      student: Student;
      ticket: any;
      daysRemaining: number;
    }> = [];

    const lowBalancePackages: Array<{
      student: Student;
      package: StudentPackage;
      remaining: number;
    }> = [];

    const allPackages = this.packageRepo.findAll();
    for (const pkg of allPackages) {
      if (pkg.status === 'active' && !pkg.is_frozen && !isExpired(pkg.valid_to)) {
        const daysRemaining = dayjs(pkg.valid_to).diff(now, 'day');
        if (daysRemaining <= 7 && daysRemaining >= 0) {
          const student = this.studentRepo.findById(pkg.student_id);
          if (student) {
            expiringPackages.push({
              student,
              package: pkg,
              daysRemaining,
            });
          }
        }

        const remaining = pkg.total_lessons - pkg.used_lessons;
        if (remaining <= 2 && remaining > 0) {
          const student = this.studentRepo.findById(pkg.student_id);
          if (student) {
            lowBalancePackages.push({
              student,
              package: pkg,
              remaining,
            });
          }
        }
      }
    }

    const allTickets = this.makeupTicketRepo.findAll();
    for (const ticket of allTickets) {
      if (ticket.status === 'available' && !isExpired(ticket.valid_to)) {
        const daysRemaining = dayjs(ticket.valid_to).diff(now, 'day');
        if (daysRemaining <= 7 && daysRemaining >= 0) {
          const student = this.studentRepo.findById(ticket.student_id);
          if (student) {
            expiringMakeupTickets.push({
              student,
              ticket,
              daysRemaining,
            });
          }
        }
      }
    }

    const pendingPayments: Array<{
      teacher: any;
      payment: TeacherPayment;
    }> = [];

    const pending = this.paymentRepo.findPending();
    for (const payment of pending) {
      const teacher = this.teacherRepo.findById(payment.teacher_id);
      if (teacher) {
        pendingPayments.push({
          teacher,
          payment,
        });
      }
    }

    return {
      expiringPackages,
      expiringMakeupTickets,
      pendingPayments,
      lowBalancePackages,
    };
  }
}
