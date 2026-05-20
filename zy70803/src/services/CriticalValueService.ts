import { Repository, Between, In } from 'typeorm';
import { CriticalValueRecord, DataCategory, TaskStatus } from '../models/CriticalValueRecord';
import { AppDataSource } from '../database/data-source';
import { ClassificationService } from './ClassificationService';
import { AuditService, ChangeRecord } from './AuditService';
import * as XLSX from 'xlsx';
import * as moment from 'moment';

export interface CreateRecordDto {
  patientId: string;
  patientName: string;
  department: string;
  ward?: string;
  bedNo?: string;
  testItem: string;
  testValue: string;
  referenceRange?: string;
  testTime: Date;
  reporter?: string;
  smsContent?: string;
  smsTime?: Date;
  phoneCallTime?: Date;
  phoneCallOperator?: string;
  doctorConfirmer?: string;
  doctorConfirmTime?: Date;
  finalProcessor?: string;
}

export interface UpdateRecordDto {
  status?: TaskStatus;
  category?: DataCategory;
  supplementRequirements?: string;
  blockReason?: string;
  smsContent?: string;
  smsTime?: Date;
  phoneCallTime?: Date;
  phoneCallOperator?: string;
  doctorConfirmer?: string;
  doctorConfirmTime?: Date;
  finalProcessor?: string;
}

export class CriticalValueService {
  private recordRepository: Repository<CriticalValueRecord>;
  private classificationService: ClassificationService;
  private auditService: AuditService;

  constructor() {
    this.recordRepository = AppDataSource.getRepository(CriticalValueRecord);
    this.classificationService = new ClassificationService();
    this.auditService = new AuditService();
  }

  async createRecord(dto: CreateRecordDto, operator: string): Promise<CriticalValueRecord> {
    const classification = this.classificationService.classifyRecord(dto);

    const record = this.recordRepository.create({
      ...dto,
      category: classification.category,
      categoryReason: classification.reason,
      supplementRequirements: classification.supplementRequirements,
      blockReason: classification.blockReason,
      status: TaskStatus.PROCESSING
    });

    const savedRecord = await this.recordRepository.save(record);

    await this.auditService.logChange(
      savedRecord.id,
      operator,
      'record',
      null,
      'created',
      '创建危急值记录'
    );

    return savedRecord;
  }

  async getRecordById(id: string): Promise<CriticalValueRecord | null> {
    return await this.recordRepository.findOne({
      where: { id },
      relations: ['auditLogs']
    });
  }

  async getAllRecords(page: number = 1, pageSize: number = 20): Promise<{ records: CriticalValueRecord[], total: number }> {
    const [records, total] = await this.recordRepository.findAndCount({
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' }
    });
    return { records, total };
  }

  async getRecordsByCategory(category: DataCategory): Promise<CriticalValueRecord[]> {
    return await this.recordRepository.find({
      where: { category },
      order: { createdAt: 'DESC' }
    });
  }

  async getRecordsByStatus(status: TaskStatus): Promise<CriticalValueRecord[]> {
    return await this.recordRepository.find({
      where: { status },
      order: { createdAt: 'DESC' }
    });
  }

  async updateRecord(id: string, dto: UpdateRecordDto, operator: string, changeReason: string): Promise<CriticalValueRecord | null> {
    const record = await this.getRecordById(id);
    if (!record) return null;

    const changes: ChangeRecord[] = [];

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && record[key as keyof CriticalValueRecord] !== value) {
        changes.push({
          fieldName: key,
          oldValue: record[key as keyof CriticalValueRecord],
          newValue: value,
          reason: changeReason
        });
      }
    }

    if (changes.length > 0) {
      await this.auditService.logMultipleChanges(id, operator, changes);
      Object.assign(record, dto);
      return await this.recordRepository.save(record);
    }

    return record;
  }

  async updateStatus(id: string, status: TaskStatus, operator: string, reason: string): Promise<CriticalValueRecord | null> {
    const record = await this.getRecordById(id);
    if (!record) return null;

    if (record.status !== status) {
      await this.auditService.logChange(
        id,
        operator,
        'status',
        record.status,
        status,
        reason
      );
      record.status = status;
      return await this.recordRepository.save(record);
    }

    return record;
  }

  async reclassifyRecord(id: string, operator: string, reason: string): Promise<CriticalValueRecord | null> {
    const record = await this.getRecordById(id);
    if (!record) return null;

    const classification = this.classificationService.classifyRecord(record);

    if (record.category !== classification.category) {
      await this.auditService.logMultipleChanges(id, operator, [
        { fieldName: 'category', oldValue: record.category, newValue: classification.category, reason },
        { fieldName: 'categoryReason', oldValue: record.categoryReason, newValue: classification.reason, reason }
      ]);

      record.category = classification.category;
      record.categoryReason = classification.reason;
      record.supplementRequirements = classification.supplementRequirements || null;
      record.blockReason = classification.blockReason || null;

      return await this.recordRepository.save(record);
    }

    return record;
  }

  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const allRecords = await this.recordRepository.find({ where });

    const statistics = {
      total: allRecords.length,
      byCategory: {
        normal: allRecords.filter(r => r.category === DataCategory.NORMAL).length,
        pendingSupplement: allRecords.filter(r => r.category === DataCategory.PENDING_SUPPLEMENT).length,
        blocked: allRecords.filter(r => r.category === DataCategory.BLOCKED).length
      },
      byStatus: {
        processing: allRecords.filter(r => r.status === TaskStatus.PROCESSING).length,
        failed: allRecords.filter(r => r.status === TaskStatus.FAILED).length,
        manualConfirmed: allRecords.filter(r => r.status === TaskStatus.MANUAL_CONFIRMED).length,
        exported: allRecords.filter(r => r.status === TaskStatus.EXPORTED).length
      },
      hasSmsNotification: allRecords.filter(r => r.smsTime).length,
      hasPhoneCall: allRecords.filter(r => r.phoneCallTime).length,
      hasDoctorConfirmation: allRecords.filter(r => r.doctorConfirmTime).length
    };

    return statistics;
  }

  async exportRecords(operator: string, startDate?: Date, endDate?: Date): Promise<Buffer> {
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const records = await this.recordRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['auditLogs']
    });

    const exportData = records.map(record => ({
      '记录ID': record.id,
      '患者ID': record.patientId,
      '患者姓名': record.patientName,
      '科室': record.department,
      '病区': record.ward || '',
      '床号': record.bedNo || '',
      '检验项目': record.testItem,
      '检验值': record.testValue,
      '参考范围': record.referenceRange || '',
      '检验时间': moment(record.testTime).format('YYYY-MM-DD HH:mm:ss'),
      '报告人': record.reporter || '',
      '数据分类': this.getCategoryText(record.category),
      '分类原因': record.categoryReason || '',
      '任务状态': this.getStatusText(record.status),
      '危急值短信内容': record.smsContent || '',
      '危急值短信时间': record.smsTime ? moment(record.smsTime).format('YYYY-MM-DD HH:mm:ss') : '',
      '电话回告时间': record.phoneCallTime ? moment(record.phoneCallTime).format('YYYY-MM-DD HH:mm:ss') : '',
      '电话回告人': record.phoneCallOperator || '',
      '医生确认人': record.doctorConfirmer || '',
      '医生确认时间': record.doctorConfirmTime ? moment(record.doctorConfirmTime).format('YYYY-MM-DD HH:mm:ss') : '',
      '最后处理人': record.finalProcessor || '',
      '创建时间': moment(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      '补充要求': record.supplementRequirements || '',
      '拦截原因': record.blockReason || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '危急值回告记录');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const recordIds = records.map(r => r.id);
    if (recordIds.length > 0) {
      await this.recordRepository.update(
        { id: In(recordIds) },
        { status: TaskStatus.EXPORTED }
      );

      for (const record of records) {
        await this.auditService.logChange(
          record.id,
          operator,
          'status',
          record.status,
          TaskStatus.EXPORTED,
          '数据已导出归档'
        );
      }
    }

    return buffer;
  }

  private getCategoryText(category: DataCategory): string {
    const texts = {
      [DataCategory.NORMAL]: '正常',
      [DataCategory.PENDING_SUPPLEMENT]: '待补充',
      [DataCategory.BLOCKED]: '已拦截'
    };
    return texts[category];
  }

  private getStatusText(status: TaskStatus): string {
    const texts = {
      [TaskStatus.PROCESSING]: '处理中',
      [TaskStatus.FAILED]: '处理失败',
      [TaskStatus.MANUAL_CONFIRMED]: '人工确认',
      [TaskStatus.EXPORTED]: '已导出'
    };
    return texts[status];
  }

  async getRecordHistory(id: string) {
    return await this.auditService.getRecordHistory(id);
  }
}
