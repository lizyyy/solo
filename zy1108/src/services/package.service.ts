import { StudentPackage, PackageUsageLog, PackageTemplate, Student } from '../types';
import { 
  StudentPackageRepository, 
  PackageTemplateRepository, 
  StudentRepository,
  PackageUsageLogRepository 
} from '../repositories';
import { BusinessError, ErrorCodes } from '../errors';
import { isExpired, now, addDays } from '../utils/date';
import dayjs from 'dayjs';

export class PackageService {
  private readonly packageRepository: StudentPackageRepository;
  private readonly templateRepository: PackageTemplateRepository;
  private readonly studentRepository: StudentRepository;
  private readonly logRepository: PackageUsageLogRepository;

  constructor() {
    this.packageRepository = new StudentPackageRepository();
    this.templateRepository = new PackageTemplateRepository();
    this.studentRepository = new StudentRepository();
    this.logRepository = new PackageUsageLogRepository();
  }

  async createTemplate(data: {
    name: string;
    total_lessons: number;
    price?: number;
    valid_days?: number;
    description?: string;
  }): Promise<PackageTemplate> {
    return this.templateRepository.create({
      name: data.name,
      total_lessons: data.total_lessons,
      price: data.price ?? 0,
      valid_days: data.valid_days ?? 365,
      description: data.description,
      status: 'active',
    });
  }

  async createStudentPackage(data: {
    student_id: string;
    template_id?: string;
    name?: string;
    total_lessons: number;
    valid_days?: number;
    valid_from?: string;
    notes?: string;
  }): Promise<StudentPackage> {
    const student = this.studentRepository.findById(data.student_id);
    if (!student) {
      throw new BusinessError(ErrorCodes.STUDENT_NOT_FOUND, '学生不存在');
    }

    let template: PackageTemplate | undefined;
    if (data.template_id) {
      template = this.templateRepository.findById(data.template_id);
      if (!template) {
        throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包模板不存在');
      }
    }

    const name = data.name || template?.name || '通用课包';
    const totalLessons = data.total_lessons;
    const validDays = data.valid_days || template?.valid_days || 365;
    const validFrom = data.valid_from || now();
    const validTo = addDays(validFrom, validDays);

    return this.packageRepository.create({
      student_id: data.student_id,
      template_id: data.template_id,
      name,
      total_lessons: totalLessons,
      used_lessons: 0,
      freeze_lessons: 0,
      valid_from: validFrom,
      valid_to: validTo,
      status: 'active',
      is_frozen: 0,
      notes: data.notes,
    });
  }

  async getStudentPackage(id: string): Promise<StudentPackage & { logs?: PackageUsageLog[] }> {
    const pkg = this.packageRepository.findById(id);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }
    const logs = this.logRepository.findByPackageId(id);
    return { ...pkg, logs };
  }

  async getStudentPackages(studentId: string): Promise<StudentPackage[]> {
    return this.packageRepository.findByStudentId(studentId);
  }

  async getActiveStudentPackages(studentId: string): Promise<StudentPackage[]> {
    const packages = this.packageRepository.findActiveByStudentId(studentId);
    return packages.filter(pkg => !isExpired(pkg.valid_to));
  }

  async freezePackage(packageId: string, freezeDays: number): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }
    if (pkg.is_frozen) {
      throw new BusinessError(ErrorCodes.PACKAGE_FROZEN, '课包已被冻结', { packageId });
    }

    const freezeEndDate = addDays(pkg.valid_to, freezeDays);
    const frozenAt = now();

    const balanceBefore = pkg.total_lessons - pkg.used_lessons;
    
    const updated = this.packageRepository.update(packageId, {
      is_frozen: 1,
      frozen_at: frozenAt,
      valid_to: freezeEndDate,
    });

    this.logRepository.create({
      student_package_id: packageId,
      action: 'freeze',
      change_amount: freezeDays,
      balance_before: balanceBefore,
      balance_after: balanceBefore,
      reason: `冻结课包，延长${freezeDays}天有效期`,
    });

    return updated!;
  }

  async unfreezePackage(packageId: string): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }
    if (!pkg.is_frozen) {
      throw new BusinessError(ErrorCodes.OPERATION_NOT_ALLOWED, '课包未被冻结', { packageId });
    }

    const balanceBefore = pkg.total_lessons - pkg.used_lessons;

    const updated = this.packageRepository.update(packageId, {
      is_frozen: 0,
    });

    this.logRepository.create({
      student_package_id: packageId,
      action: 'unfreeze',
      change_amount: 0,
      balance_before: balanceBefore,
      balance_after: balanceBefore,
      reason: '解冻课包',
    });

    return updated!;
  }

  async deductLesson(packageId: string, bookingId?: string): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }
    if (pkg.is_frozen) {
      throw new BusinessError(ErrorCodes.PACKAGE_FROZEN, '课包已被冻结，无法扣课', { packageId });
    }
    if (isExpired(pkg.valid_to)) {
      throw new BusinessError(ErrorCodes.PACKAGE_EXPIRED, '课包已过期', { packageId, validTo: pkg.valid_to });
    }

    const balanceBefore = pkg.total_lessons - pkg.used_lessons;
    if (balanceBefore <= 0) {
      throw new BusinessError(ErrorCodes.INSUFFICIENT_LESSONS, '课包余额不足', { 
        packageId, 
        balance: balanceBefore 
      });
    }

    const updated = this.packageRepository.update(packageId, {
      used_lessons: pkg.used_lessons + 1,
    });

    this.logRepository.create({
      student_package_id: packageId,
      lesson_booking_id: bookingId,
      action: 'deduct',
      change_amount: -1,
      balance_before: balanceBefore,
      balance_after: balanceBefore - 1,
      reason: bookingId ? '上课签到扣课' : '手动扣课',
    });

    return updated!;
  }

  async refundLesson(packageId: string, bookingId?: string): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }

    const balanceBefore = pkg.total_lessons - pkg.used_lessons;

    if (pkg.used_lessons <= 0) {
      throw new BusinessError(ErrorCodes.OPERATION_NOT_ALLOWED, '没有已使用的课次可以退还', { 
        packageId, 
        used: pkg.used_lessons 
      });
    }

    const updated = this.packageRepository.update(packageId, {
      used_lessons: pkg.used_lessons - 1,
    });

    this.logRepository.create({
      student_package_id: packageId,
      lesson_booking_id: bookingId,
      action: 'refund',
      change_amount: 1,
      balance_before: balanceBefore,
      balance_after: balanceBefore + 1,
      reason: bookingId ? '取消预约退还课次' : '手动退还课次',
    });

    return updated!;
  }

  async adjustBalance(packageId: string, adjustAmount: number, reason: string): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }

    const balanceBefore = pkg.total_lessons - pkg.used_lessons;
    const newUsedLessons = pkg.used_lessons - adjustAmount;

    if (newUsedLessons < 0) {
      throw new BusinessError(ErrorCodes.OPERATION_NOT_ALLOWED, '调整后已使用课次不能为负数', { 
        packageId, 
        currentUsed: pkg.used_lessons,
        adjustAmount 
      });
    }

    const updated = this.packageRepository.update(packageId, {
      used_lessons: newUsedLessons,
    });

    this.logRepository.create({
      student_package_id: packageId,
      action: 'adjust',
      change_amount: adjustAmount,
      balance_before: balanceBefore,
      balance_after: balanceBefore + adjustAmount,
      reason,
    });

    return updated!;
  }

  async recalculatePackageBalance(packageId: string): Promise<StudentPackage> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }

    const logs = this.logRepository.findByPackageId(packageId);
    let calculatedUsed = 0;

    for (const log of logs) {
      if (log.action === 'deduct') {
        calculatedUsed += 1;
      } else if (log.action === 'refund') {
        calculatedUsed -= 1;
      } else if (log.action === 'adjust') {
        calculatedUsed -= log.change_amount;
      }
    }

    calculatedUsed = Math.max(0, calculatedUsed);

    if (calculatedUsed !== pkg.used_lessons) {
      const updated = this.packageRepository.update(packageId, {
        used_lessons: calculatedUsed,
      });

      this.logRepository.create({
        student_package_id: packageId,
        action: 'adjust',
        change_amount: pkg.used_lessons - calculatedUsed,
        balance_before: pkg.total_lessons - pkg.used_lessons,
        balance_after: pkg.total_lessons - calculatedUsed,
        reason: '系统重算余额',
      });

      return updated!;
    }

    return pkg;
  }

  async getPackageBalance(packageId: string): Promise<{
    total: number;
    used: number;
    remaining: number;
    frozen: number;
    valid_from: string;
    valid_to: string;
    is_expired: boolean;
    is_frozen: boolean;
  }> {
    const pkg = this.packageRepository.findById(packageId);
    if (!pkg) {
      throw new BusinessError(ErrorCodes.PACKAGE_NOT_FOUND, '课包不存在');
    }

    return {
      total: pkg.total_lessons,
      used: pkg.used_lessons,
      remaining: pkg.total_lessons - pkg.used_lessons,
      frozen: pkg.freeze_lessons,
      valid_from: pkg.valid_from,
      valid_to: pkg.valid_to,
      is_expired: isExpired(pkg.valid_to),
      is_frozen: pkg.is_frozen === 1,
    };
  }

  async getStudentBalances(studentId: string): Promise<Array<{
    package_id: string;
    package_name: string;
    total: number;
    used: number;
    remaining: number;
    valid_from: string;
    valid_to: string;
    is_expired: boolean;
    is_frozen: boolean;
  }>> {
    const packages = this.packageRepository.findByStudentId(studentId);
    return packages.map(pkg => ({
      package_id: pkg.id,
      package_name: pkg.name,
      total: pkg.total_lessons,
      used: pkg.used_lessons,
      remaining: pkg.total_lessons - pkg.used_lessons,
      valid_from: pkg.valid_from,
      valid_to: pkg.valid_to,
      is_expired: isExpired(pkg.valid_to),
      is_frozen: pkg.is_frozen === 1,
    }));
  }
}
