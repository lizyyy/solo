import { 
  Student, Teacher, TeacherPayment, StudentPackage, 
  Lesson, LessonBooking 
} from '../types';
import {
  StudentRepository, TeacherRepository, TeacherPaymentRepository,
  StudentPackageRepository, LessonRepository, LessonBookingRepository,
  ClassRepository
} from '../repositories';
import { isExpired } from '../utils/date';
import dayjs from 'dayjs';

export interface StudentBalanceReport {
  studentId: string;
  studentName: string;
  packages: Array<{
    packageId: string;
    packageName: string;
    totalLessons: number;
    usedLessons: number;
    remainingLessons: number;
    validFrom: string;
    validTo: string;
    isExpired: boolean;
    isFrozen: boolean;
  }>;
  totalRemaining: number;
}

export interface TeacherPaymentReport {
  teacherId: string;
  teacherName: string;
  hourlyRate: number;
  payments: Array<{
    paymentId: string;
    lessonId: string;
    className?: string;
    lessonDate: string;
    amount: number;
    status: 'pending' | 'paid';
  }>;
  totalPending: number;
  totalPaid: number;
  totalAmount: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  monthNum: number;
  studentBalances: StudentBalanceReport[];
  teacherPayments: TeacherPaymentReport[];
  totalStudentsWithBalances: number;
  totalRemainingLessons: number;
  totalPendingPayments: number;
}

export class ExportService {
  private readonly studentRepo: StudentRepository;
  private readonly teacherRepo: TeacherRepository;
  private readonly paymentRepo: TeacherPaymentRepository;
  private readonly packageRepo: StudentPackageRepository;
  private readonly lessonRepo: LessonRepository;
  private readonly bookingRepo: LessonBookingRepository;
  private readonly classRepo: ClassRepository;

  constructor() {
    this.studentRepo = new StudentRepository();
    this.teacherRepo = new TeacherRepository();
    this.paymentRepo = new TeacherPaymentRepository();
    this.packageRepo = new StudentPackageRepository();
    this.lessonRepo = new LessonRepository();
    this.bookingRepo = new LessonBookingRepository();
    this.classRepo = new ClassRepository();
  }

  async getStudentBalanceReport(): Promise<StudentBalanceReport[]> {
    const students = this.studentRepo.findActive();
    const reports: StudentBalanceReport[] = [];

    for (const student of students) {
      const packages = this.packageRepo.findByStudentId(student.id);
      const packageDetails = packages.map(pkg => ({
        packageId: pkg.id,
        packageName: pkg.name,
        totalLessons: pkg.total_lessons,
        usedLessons: pkg.used_lessons,
        remainingLessons: pkg.total_lessons - pkg.used_lessons,
        validFrom: pkg.valid_from,
        validTo: pkg.valid_to,
        isExpired: isExpired(pkg.valid_to),
        isFrozen: pkg.is_frozen === 1,
      }));

      const totalRemaining = packageDetails
        .filter(p => !p.isExpired && !p.isFrozen)
        .reduce((sum, p) => sum + p.remainingLessons, 0);

      reports.push({
        studentId: student.id,
        studentName: student.name,
        packages: packageDetails,
        totalRemaining,
      });
    }

    return reports.sort((a, b) => b.totalRemaining - a.totalRemaining);
  }

  async getTeacherPaymentReport(year?: number, month?: number): Promise<TeacherPaymentReport[]> {
    const teachers = this.teacherRepo.findActive();
    const reports: TeacherPaymentReport[] = [];

    for (const teacher of teachers) {
      let payments: TeacherPayment[];
      if (year && month) {
        payments = this.paymentRepo.findByMonth(teacher.id, year, month);
      } else {
        payments = this.paymentRepo.findByTeacherId(teacher.id);
      }

      const paymentDetails = await Promise.all(
        payments.map(async (payment) => {
          const lesson = this.lessonRepo.findById(payment.lesson_id);
          const cls = lesson ? this.classRepo.findById(lesson.class_id) : undefined;
          return {
            paymentId: payment.id,
            lessonId: payment.lesson_id,
            className: cls?.name,
            lessonDate: lesson?.start_time || payment.created_at,
            amount: payment.amount,
            status: payment.status,
          };
        })
      );

      const totalPending = paymentDetails
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0);

      const totalPaid = paymentDetails
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);

      reports.push({
        teacherId: teacher.id,
        teacherName: teacher.name,
        hourlyRate: teacher.hourly_rate,
        payments: paymentDetails,
        totalPending,
        totalPaid,
        totalAmount: totalPending + totalPaid,
      });
    }

    return reports.sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const studentBalances = await this.getStudentBalanceReport();
    const teacherPayments = await this.getTeacherPaymentReport(year, month);

    const totalStudentsWithBalances = studentBalances.filter(s => s.totalRemaining > 0).length;
    const totalRemainingLessons = studentBalances.reduce((sum, s) => sum + s.totalRemaining, 0);
    const totalPendingPayments = teacherPayments.reduce((sum, t) => sum + t.totalPending, 0);

    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];

    return {
      month: `${year}年${monthNames[month - 1]}`,
      year,
      monthNum: month,
      studentBalances,
      teacherPayments,
      totalStudentsWithBalances,
      totalRemainingLessons,
      totalPendingPayments,
    };
  }

  async exportToJSON(data: unknown): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  async exportStudentBalancesToCSV(balances: StudentBalanceReport[]): Promise<string> {
    const headers = ['学生ID', '学生姓名', '课包ID', '课包名称', '总课次', '已使用', '剩余', '有效期开始', '有效期结束', '是否过期', '是否冻结', '总剩余课次'];
    const rows: string[][] = [];

    for (const report of balances) {
      if (report.packages.length === 0) {
        rows.push([
          report.studentId,
          report.studentName,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          report.totalRemaining.toString(),
        ]);
      } else {
        for (let i = 0; i < report.packages.length; i++) {
          const pkg = report.packages[i];
          rows.push([
            i === 0 ? report.studentId : '',
            i === 0 ? report.studentName : '',
            pkg.packageId,
            pkg.packageName,
            pkg.totalLessons.toString(),
            pkg.usedLessons.toString(),
            pkg.remainingLessons.toString(),
            pkg.validFrom,
            pkg.validTo,
            pkg.isExpired ? '是' : '否',
            pkg.isFrozen ? '是' : '否',
            i === 0 ? report.totalRemaining.toString() : '',
          ]);
        }
      }
    }

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  async exportTeacherPaymentsToCSV(payments: TeacherPaymentReport[]): Promise<string> {
    const headers = ['老师ID', '老师姓名', '课时费', '支付ID', '课次ID', '班级', '上课时间', '金额', '状态', '待结算', '已结算', '总计'];
    const rows: string[][] = [];

    for (const report of payments) {
      if (report.payments.length === 0) {
        rows.push([
          report.teacherId,
          report.teacherName,
          report.hourlyRate.toString(),
          '',
          '',
          '',
          '',
          '',
          '',
          report.totalPending.toString(),
          report.totalPaid.toString(),
          report.totalAmount.toString(),
        ]);
      } else {
        for (let i = 0; i < report.payments.length; i++) {
          const payment = report.payments[i];
          rows.push([
            i === 0 ? report.teacherId : '',
            i === 0 ? report.teacherName : '',
            i === 0 ? report.hourlyRate.toString() : '',
            payment.paymentId,
            payment.lessonId,
            payment.className || '',
            payment.lessonDate,
            payment.amount.toString(),
            payment.status === 'pending' ? '待结算' : '已结算',
            i === 0 ? report.totalPending.toString() : '',
            i === 0 ? report.totalPaid.toString() : '',
            i === 0 ? report.totalAmount.toString() : '',
          ]);
        }
      }
    }

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
  }

  async exportMonthlyReportToMarkdown(report: MonthlyReport): Promise<string> {
    let markdown = `# ${report.month} 月度报表\n\n`;

    markdown += `## 概览\n\n`;
    markdown += `- **有余额学生数**: ${report.totalStudentsWithBalances}\n`;
    markdown += `- **总剩余课次**: ${report.totalRemainingLessons}\n`;
    markdown += `- **待结算老师课酬**: ¥${report.totalPendingPayments.toFixed(2)}\n\n`;

    markdown += `---\n\n`;

    markdown += `## 学生课包余额\n\n`;
    
    const studentsWithBalance = report.studentBalances.filter(s => s.totalRemaining > 0);
    if (studentsWithBalance.length === 0) {
      markdown += `暂无学生余额记录\n\n`;
    } else {
      markdown += `| 学生姓名 | 课包名称 | 总课次 | 已使用 | 剩余 | 有效期 | 状态 |\n`;
      markdown += `|----------|----------|--------|--------|------|--------|------|\n`;
      
      for (const student of studentsWithBalance) {
        for (const pkg of student.packages) {
          const status = pkg.isExpired ? '已过期' : (pkg.isFrozen ? '已冻结' : '正常');
          const validRange = `${pkg.validFrom.substring(0, 10)} 至 ${pkg.validTo.substring(0, 10)}`;
          markdown += `| ${student.studentName} | ${pkg.packageName} | ${pkg.totalLessons} | ${pkg.usedLessons} | ${pkg.remainingLessons} | ${validRange} | ${status} |\n`;
        }
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;

    markdown += `## 老师课酬结算\n\n`;
    
    const teachersWithPayments = report.teacherPayments.filter(t => t.totalAmount > 0);
    if (teachersWithPayments.length === 0) {
      markdown += `暂无老师课酬记录\n\n`;
    } else {
      markdown += `| 老师姓名 | 课时费 | 上课时间 | 班级 | 金额 | 状态 |\n`;
      markdown += `|----------|--------|----------|------|------|------|\n`;
      
      for (const teacher of teachersWithPayments) {
        for (const payment of teacher.payments) {
          const status = payment.status === 'pending' ? '待结算' : '已结算';
          const dateStr = payment.lessonDate.substring(0, 16);
          markdown += `| ${teacher.teacherName} | ¥${teacher.hourlyRate}/h | ${dateStr} | ${payment.className || '-'} | ¥${payment.amount.toFixed(2)} | ${status} |\n`;
        }
      }
      markdown += `\n`;

      markdown += `### 汇总\n\n`;
      markdown += `| 老师姓名 | 待结算 | 已结算 | 总计 |\n`;
      markdown += `|----------|--------|--------|------|\n`;
      for (const teacher of teachersWithPayments) {
        markdown += `| ${teacher.teacherName} | ¥${teacher.totalPending.toFixed(2)} | ¥${teacher.totalPaid.toFixed(2)} | ¥${teacher.totalAmount.toFixed(2)} |\n`;
      }
    }

    return markdown;
  }
}
