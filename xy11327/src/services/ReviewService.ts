import { WorkRecord, BatchResult } from '../types';
import { WorkRecordRepository } from '../repositories/WorkRecordRepository';
import { BillingService } from './BillingService';
import { logger } from '../utils/logger';

export class ReviewService {
  private repository: WorkRecordRepository;
  private billingService: BillingService;

  constructor(repository?: WorkRecordRepository, billingService?: BillingService) {
    this.repository = repository || new WorkRecordRepository();
    this.billingService = billingService || new BillingService(this.repository);
  }

  public validateRecord(record: WorkRecord): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!record.recordNo) {
      errors.push('记录编号不能为空');
    }
    if (!record.tractorNo) {
      errors.push('拖拉机编号不能为空');
    }
    if (!record.operatorName) {
      errors.push('机手姓名不能为空');
    }
    if (!record.workDate) {
      errors.push('作业日期不能为空');
    }
    if (!record.workType) {
      errors.push('作业类型不能为空');
    }
    if (!record.billingType) {
      errors.push('计费方式不能为空');
    }

    switch (record.billingType) {
      case 'hourly':
        if (!record.hours || record.hours <= 0) {
          errors.push('按时计费需要填写有效的小时数');
        }
        break;
      case 'acreage':
        if (!record.acreage || record.acreage <= 0) {
          errors.push('按亩计费需要填写有效的亩数');
        }
        break;
      case 'fuel':
        if (!record.fuelUsed || record.fuelUsed <= 0) {
          errors.push('按油计费需要填写有效的油量');
        }
        break;
      case 'mixed':
        if ((!record.hours || record.hours <= 0) && 
            (!record.acreage || record.acreage <= 0) && 
            (!record.fuelUsed || record.fuelUsed <= 0)) {
          errors.push('混合计费至少需要填写小时数、亩数或油量中的一项');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  public reviewRecord(recordId: string, approved: boolean): WorkRecord {
    const record = this.repository.findById(recordId);
    if (!record) {
      throw new Error(`作业记录不存在: ${recordId}`);
    }

    if (record.status === 'pending') {
      this.billingService.billRecord(recordId);
    }

    if (approved) {
      this.repository.updateStatus(recordId, 'reviewed');
      logger.info(`复核通过: ${recordId}`);
    } else {
      this.repository.updateStatus(recordId, 'rejected');
      logger.info(`复核拒绝: ${recordId}`);
    }

    const updated = this.repository.findById(recordId);
    if (!updated) {
      throw new Error('更新记录失败');
    }
    return updated;
  }

  public reviewRecords(recordIds: string[], approved: boolean): BatchResult<WorkRecord> {
    const success: WorkRecord[] = [];
    const failed: { item: WorkRecord; error: string; index: number }[] = [];

    for (let i = 0; i < recordIds.length; i++) {
      const id = recordIds[i];
      try {
        const result = this.reviewRecord(id, approved);
        success.push(result);
      } catch (error: any) {
        failed.push({
          item: {
            id,
            recordNo: '',
            tractorNo: '',
            operatorName: '',
            workDate: '',
            workType: '',
            billingType: 'hourly',
            status: 'pending'
          },
          error: error.message,
          index: i
        });
        logger.error(`复核失败: ${id}, 错误: ${error.message}`);
      }
    }

    return {
      success,
      failed,
      total: recordIds.length,
      successCount: success.length,
      failedCount: failed.length
    };
  }

  public getPendingReview(): WorkRecord[] {
    return this.repository.findAll({ status: 'billed' });
  }
}
