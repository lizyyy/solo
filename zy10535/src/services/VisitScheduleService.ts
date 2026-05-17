import { Repository, Between, LessThan, MoreThan, In } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { VisitSchedule, VisitStatus, VisitType, VisitChannel } from '../entities/VisitSchedule';
import { DelayRecord, DelayReason } from '../entities/DelayRecord';
import { VisitReport, ReportStatus } from '../entities/VisitReport';
import { Customer } from '../entities/Customer';
import { PersonInCharge } from '../entities/PersonInCharge';

export interface CreateVisitScheduleDto {
  customerId: string;
  personInChargeId: string;
  visitType: VisitType;
  visitChannel: VisitChannel;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  subject?: string;
  description?: string;
  createdBy?: string;
}

export interface UpdateVisitScheduleDto {
  visitType?: VisitType;
  visitChannel?: VisitChannel;
  scheduledStartTime?: Date;
  scheduledEndTime?: Date;
  subject?: string;
  description?: string;
  updatedBy?: string;
}

export interface CreateDelayRecordDto {
  reason: DelayReason;
  reasonDescription: string;
  newScheduledTime?: Date;
  requestedBy?: string;
}

export class VisitScheduleService {
  private scheduleRepository: Repository<VisitSchedule>;
  private delayRepository: Repository<DelayRecord>;
  private reportRepository: Repository<VisitReport>;
  private customerRepository: Repository<Customer>;
  private personRepository: Repository<PersonInCharge>;

  constructor() {
    this.scheduleRepository = AppDataSource.getRepository(VisitSchedule);
    this.delayRepository = AppDataSource.getRepository(DelayRecord);
    this.reportRepository = AppDataSource.getRepository(VisitReport);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.personRepository = AppDataSource.getRepository(PersonInCharge);
  }

  private generateScheduleNumber(): string {
    const date = new Date();
    const prefix = `VS${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${random}`;
  }

  private generateReportNumber(): string {
    const date = new Date();
    const prefix = `VR${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${random}`;
  }

  async checkTimeConflict(personInChargeId: string, startTime: Date, endTime: Date, excludeScheduleId?: string): Promise<VisitSchedule[]> {
    const conflicts = await this.scheduleRepository.find({
      where: {
        personInChargeId,
        status: In([VisitStatus.SCHEDULED, VisitStatus.CONFIRMED, VisitStatus.IN_PROGRESS]),
        scheduledStartTime: LessThan(endTime),
        scheduledEndTime: MoreThan(startTime)
      }
    });

    if (excludeScheduleId) {
      return conflicts.filter(c => c.id !== excludeScheduleId);
    }
    return conflicts;
  }

  async validateDependencies(customerId: string, personInChargeId: string): Promise<void> {
    const customer = await this.customerRepository.findOne({ where: { id: customerId } });
    if (!customer) {
      throw new Error(`客户不存在: ${customerId}`);
    }

    const person = await this.personRepository.findOne({ where: { id: personInChargeId } });
    if (!person) {
      throw new Error(`负责人不存在: ${personInChargeId}`);
    }
  }

  async createSchedule(dto: CreateVisitScheduleDto): Promise<VisitSchedule> {
    await this.validateDependencies(dto.customerId, dto.personInChargeId);

    const conflicts = await this.checkTimeConflict(
      dto.personInChargeId,
      dto.scheduledStartTime,
      dto.scheduledEndTime
    );

    if (conflicts.length > 0) {
      throw new Error(`时间冲突: 负责人在该时间段已有 ${conflicts.length} 个排期`);
    }

    const durationMinutes = Math.ceil(
      (dto.scheduledEndTime.getTime() - dto.scheduledStartTime.getTime()) / (1000 * 60)
    );

    const schedule = this.scheduleRepository.create({
      scheduleNumber: this.generateScheduleNumber(),
      customerId: dto.customerId,
      personInChargeId: dto.personInChargeId,
      visitType: dto.visitType,
      visitChannel: dto.visitChannel,
      scheduledStartTime: dto.scheduledStartTime,
      scheduledEndTime: dto.scheduledEndTime,
      durationMinutes,
      subject: dto.subject,
      description: dto.description,
      status: VisitStatus.SCHEDULED,
      originalInput: dto,
      createdBy: dto.createdBy
    });

    return await this.scheduleRepository.save(schedule);
  }

  async getScheduleById(id: string): Promise<VisitSchedule | null> {
    return await this.scheduleRepository.findOne({
      where: { id },
      relations: ['customer', 'personInCharge', 'delayRecords', 'reports']
    });
  }

  async getSchedules(filters?: {
    customerId?: string;
    personInChargeId?: string;
    status?: VisitStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<VisitSchedule[]> {
    const where: any = {};

    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.personInChargeId) where.personInChargeId = filters.personInChargeId;
    if (filters?.status) where.status = filters.status;
    if (filters?.startDate && filters?.endDate) {
      where.scheduledStartTime = Between(filters.startDate, filters.endDate);
    }

    return await this.scheduleRepository.find({
      where,
      relations: ['customer', 'personInCharge'],
      order: { scheduledStartTime: 'DESC' }
    });
  }

  async confirmByPerson(scheduleId: string, confirmedBy: string): Promise<VisitSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    if (schedule.status !== VisitStatus.SCHEDULED && schedule.status !== VisitStatus.DRAFT) {
      throw new Error(`当前状态 ${schedule.status} 无法确认`);
    }

    if (schedule.isConfirmedByPerson) {
      throw new Error('该排期已确认，不可重复确认');
    }

    schedule.isConfirmedByPerson = true;
    schedule.confirmedAt = new Date();
    schedule.status = VisitStatus.CONFIRMED;
    schedule.lastProcessingBasis = `负责人 ${confirmedBy} 于 ${new Date().toISOString()} 确认排期`;
    schedule.updatedBy = confirmedBy;

    return await this.scheduleRepository.save(schedule);
  }

  async advanceStatus(scheduleId: string, newStatus: VisitStatus, operator: string, basis?: string): Promise<VisitSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    const validTransitions: Record<VisitStatus, VisitStatus[]> = {
      [VisitStatus.DRAFT]: [VisitStatus.SCHEDULED, VisitStatus.CANCELLED],
      [VisitStatus.SCHEDULED]: [VisitStatus.CONFIRMED, VisitStatus.IN_PROGRESS, VisitStatus.DELAYED, VisitStatus.CANCELLED, VisitStatus.MISSED],
      [VisitStatus.CONFIRMED]: [VisitStatus.IN_PROGRESS, VisitStatus.DELAYED, VisitStatus.CANCELLED, VisitStatus.MISSED],
      [VisitStatus.IN_PROGRESS]: [VisitStatus.COMPLETED, VisitStatus.DELAYED],
      [VisitStatus.COMPLETED]: [],
      [VisitStatus.DELAYED]: [VisitStatus.SCHEDULED, VisitStatus.CANCELLED],
      [VisitStatus.MISSED]: [VisitStatus.SCHEDULED, VisitStatus.CANCELLED],
      [VisitStatus.CANCELLED]: []
    };

    if (!validTransitions[schedule.status].includes(newStatus)) {
      throw new Error(`无法从 ${schedule.status} 状态转换到 ${newStatus}`);
    }

    if (schedule.status === newStatus) {
      throw new Error(`排期已处于 ${newStatus} 状态，不可重复推进`);
    }

    schedule.status = newStatus;
    schedule.lastProcessingBasis = basis || `操作员 ${operator} 于 ${new Date().toISOString()} 将状态从 ${schedule.status} 变更为 ${newStatus}`;
    schedule.updatedBy = operator;

    if (newStatus === VisitStatus.IN_PROGRESS) {
      schedule.actualStartTime = new Date();
    } else if (newStatus === VisitStatus.COMPLETED) {
      schedule.actualEndTime = new Date();
    }

    return await this.scheduleRepository.save(schedule);
  }

  async createDelayRecord(scheduleId: string, dto: CreateDelayRecordDto): Promise<DelayRecord> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    if (schedule.status === VisitStatus.COMPLETED || schedule.status === VisitStatus.CANCELLED) {
      throw new Error(`当前状态 ${schedule.status} 无法创建延期记录`);
    }

    const delayRecord = this.delayRepository.create({
      visitScheduleId: scheduleId,
      reason: dto.reason,
      reasonDescription: dto.reasonDescription,
      originalScheduledTime: schedule.scheduledStartTime,
      newScheduledTime: dto.newScheduledTime,
      requestedBy: dto.requestedBy,
      originalInput: dto
    });

    if (dto.newScheduledTime) {
      const conflicts = await this.checkTimeConflict(
        schedule.personInChargeId,
        dto.newScheduledTime,
        new Date(dto.newScheduledTime.getTime() + schedule.durationMinutes * 60000),
        scheduleId
      );

      if (conflicts.length > 0) {
        throw new Error(`新时间冲突: 负责人在该时间段已有排期`);
      }

      schedule.scheduledStartTime = dto.newScheduledTime;
      schedule.scheduledEndTime = new Date(dto.newScheduledTime.getTime() + schedule.durationMinutes * 60000);
    }

    schedule.status = VisitStatus.DELAYED;
    schedule.lastProcessingBasis = `延期原因: ${dto.reason} - ${dto.reasonDescription}`;
    schedule.updatedBy = dto.requestedBy || 'system';

    await this.scheduleRepository.save(schedule);
    return await this.delayRepository.save(delayRecord);
  }

  async getMissedVisits(): Promise<VisitSchedule[]> {
    const now = new Date();
    return await this.scheduleRepository.find({
      where: {
        status: In([VisitStatus.SCHEDULED, VisitStatus.CONFIRMED]),
        scheduledEndTime: LessThan(now)
      },
      relations: ['customer', 'personInCharge']
    });
  }

  async markAsMissed(scheduleId: string, operator: string): Promise<VisitSchedule> {
    return await this.advanceStatus(
      scheduleId,
      VisitStatus.MISSED,
      operator,
      '系统自动标记为漏访'
    );
  }

  async manualUpdate(scheduleId: string, dto: UpdateVisitScheduleDto, operator: string): Promise<VisitSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    if (dto.scheduledStartTime && dto.scheduledEndTime) {
      const conflicts = await this.checkTimeConflict(
        schedule.personInChargeId,
        dto.scheduledStartTime,
        dto.scheduledEndTime,
        scheduleId
      );

      if (conflicts.length > 0) {
        throw new Error(`时间冲突: 负责人在该时间段已有排期`);
      }

      schedule.scheduledStartTime = dto.scheduledStartTime;
      schedule.scheduledEndTime = dto.scheduledEndTime;
      schedule.durationMinutes = Math.ceil(
        (dto.scheduledEndTime.getTime() - dto.scheduledStartTime.getTime()) / (1000 * 60)
      );
    }

    if (dto.visitType) schedule.visitType = dto.visitType;
    if (dto.visitChannel) schedule.visitChannel = dto.visitChannel;
    if (dto.subject !== undefined) schedule.subject = dto.subject;
    if (dto.description !== undefined) schedule.description = dto.description;

    schedule.lastProcessingBasis = `人工修正: 操作员 ${operator} 于 ${new Date().toISOString()} 更新排期`;
    schedule.updatedBy = operator;

    return await this.scheduleRepository.save(schedule);
  }

  async cancelSchedule(scheduleId: string, reason: string, operator: string): Promise<VisitSchedule> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    if (schedule.status === VisitStatus.COMPLETED || schedule.status === VisitStatus.CANCELLED) {
      throw new Error(`当前状态 ${schedule.status} 无法取消`);
    }

    schedule.status = VisitStatus.CANCELLED;
    schedule.cancelReason = reason;
    schedule.cancelledAt = new Date();
    schedule.cancelledBy = operator;
    schedule.lastProcessingBasis = `取消原因: ${reason}`;
    schedule.updatedBy = operator;

    return await this.scheduleRepository.save(schedule);
  }

  async createReport(scheduleId: string, reportData: Partial<VisitReport>, createdBy: string): Promise<VisitReport> {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('排期不存在');
    }

    if (schedule.status !== VisitStatus.COMPLETED) {
      throw new Error('只有已完成的排期才能创建报告');
    }

    const existingReport = await this.reportRepository.findOne({ where: { visitScheduleId: scheduleId } });
    if (existingReport) {
      throw new Error('该排期已有报告');
    }

    const report = this.reportRepository.create({
      visitScheduleId: scheduleId,
      reportNumber: this.generateReportNumber(),
      visitSummary: reportData.visitSummary,
      customerFeedback: reportData.customerFeedback,
      issuesIdentified: reportData.issuesIdentified,
      actionItems: reportData.actionItems,
      followUpRequired: reportData.followUpRequired,
      nextFollowUpDate: reportData.nextFollowUpDate,
      satisfactionScore: reportData.satisfactionScore,
      additionalData: reportData.additionalData,
      status: ReportStatus.DRAFT,
      createdBy
    });

    return await this.reportRepository.save(report);
  }

  async getReportByScheduleId(scheduleId: string): Promise<VisitReport | null> {
    return await this.reportRepository.findOne({ where: { visitScheduleId: scheduleId } });
  }
}
