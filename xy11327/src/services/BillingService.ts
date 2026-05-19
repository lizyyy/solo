import { WorkRecord, BillingResult, BatchResult } from '../types';
import { WorkRecordRepository } from '../repositories/WorkRecordRepository';
import { logger } from '../utils/logger';

const DEFAULT_HOURLY_RATE = 80;
const DEFAULT_ACREAGE_RATE = 50;
const DEFAULT_FUEL_PRICE = 7.5;

export class BillingService {
  private repository: WorkRecordRepository;

  constructor(repository?: WorkRecordRepository) {
    this.repository = repository || new WorkRecordRepository();
  }

  public calculateBill(record: WorkRecord): BillingResult {
    const breakdown: BillingResult['breakdown'] = {};

    switch (record.billingType) {
      case 'hourly':
        breakdown.hoursCost = this.calculateHourlyCost(record);
        break;
      case 'acreage':
        breakdown.acreageCost = this.calculateAcreageCost(record);
        break;
      case 'fuel':
        breakdown.fuelCost = this.calculateFuelCost(record);
        break;
      case 'mixed':
        breakdown.hoursCost = this.calculateHourlyCost(record);
        breakdown.acreageCost = this.calculateAcreageCost(record);
        breakdown.fuelCost = this.calculateFuelCost(record);
        break;
    }

    const totalAmount = Object.values(breakdown).reduce((sum, val) => sum + (val || 0), 0);

    return {
      recordId: record.id!,
      recordNo: record.recordNo,
      totalAmount: Math.round(totalAmount * 100) / 100,
      breakdown,
      billedAt: new Date().toISOString()
    };
  }

  private calculateHourlyCost(record: WorkRecord): number {
    if (!record.hours || record.hours <= 0) {
      return 0;
    }
    const rate = record.hourlyRate ?? DEFAULT_HOURLY_RATE;
    return record.hours * rate;
  }

  private calculateAcreageCost(record: WorkRecord): number {
    if (!record.acreage || record.acreage <= 0) {
      return 0;
    }
    const rate = record.acreageRate ?? DEFAULT_ACREAGE_RATE;
    return record.acreage * rate;
  }

  private calculateFuelCost(record: WorkRecord): number {
    if (!record.fuelUsed || record.fuelUsed <= 0) {
      return 0;
    }
    const price = record.fuelPrice ?? DEFAULT_FUEL_PRICE;
    return record.fuelUsed * price;
  }

  public async billRecord(recordId: string): BillingResult {
    const record = this.repository.findById(recordId);
    if (!record) {
      throw new Error(`作业记录不存在: ${recordId}`);
    }

    if (record.status === 'billed' || record.status === 'reviewed') {
      const existing = this.repository.findBillingResultByRecordId(recordId);
      if (existing) {
        logger.info(`记录已计费，返回已有结果: ${recordId}`);
        return existing;
      }
    }

    const result = this.calculateBill(record);

    this.repository.insertBillingResult(result);
    this.repository.updateStatus(recordId, 'billed');

    logger.info(`计费完成: ${recordId}, 金额: ${result.totalAmount}`);
    return result;
  }

  public billRecords(recordIds: string[]): BatchResult<BillingResult> {
    const success: BillingResult[] = [];
    const failed: { item: BillingResult; error: string; index: number }[] = [];

    for (let i = 0; i < recordIds.length; i++) {
      const id = recordIds[i];
      try {
        const result = this.billRecord(id);
        success.push(result);
      } catch (error: any) {
        failed.push({
          item: {
            recordId: id,
            recordNo: '',
            totalAmount: 0,
            breakdown: {},
            billedAt: new Date().toISOString()
          },
          error: error.message,
          index: i
        });
        logger.error(`计费失败: ${id}, 错误: ${error.message}`);
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
}
