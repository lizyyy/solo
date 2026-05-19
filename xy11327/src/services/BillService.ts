import { v4 as uuidv4 } from 'uuid';
import { Bill, WorkRecord } from '../types';
import { BillRepository } from '../repositories/BillRepository';
import { WorkRecordRepository } from '../repositories/WorkRecordRepository';
import { logger } from '../utils/logger';

export class BillService {
  private billRepository: BillRepository;
  private recordRepository: WorkRecordRepository;

  constructor(billRepository?: BillRepository, recordRepository?: WorkRecordRepository) {
    this.billRepository = billRepository || new BillRepository();
    this.recordRepository = recordRepository || new WorkRecordRepository();
  }

  public generateBill(
    operatorName: string,
    periodStart: string,
    periodEnd: string,
    operatorIdCard?: string,
    operatorPhone?: string
  ): Bill {
    const records = this.recordRepository.findAll({
      status: 'reviewed',
      operatorName,
      startDate: periodStart,
      endDate: periodEnd
    });

    if (records.length === 0) {
      throw new Error('该时间段内没有已复核的作业记录');
    }

    let totalAmount = 0;
    const recordAmounts: { id: string; amount: number }[] = [];

    for (const record of records) {
      const billing = this.recordRepository.findBillingResultByRecordId(record.id!);
      if (billing) {
        totalAmount += billing.totalAmount;
        recordAmounts.push({ id: record.id!, amount: billing.totalAmount });
      }
    }

    const billNo = this.generateBillNo();
    const bill: Bill = {
      billNo,
      operatorName,
      operatorIdCard,
      operatorPhone,
      periodStart,
      periodEnd,
      totalAmount: Math.round(totalAmount * 100) / 100,
      recordCount: records.length,
      status: 'draft'
    };

    const inserted = this.billRepository.insert(bill, recordAmounts);
    logger.info(`账单已生成: ${billNo}, 记录数: ${records.length}, 总金额: ${totalAmount}`);

    return inserted;
  }

  public generateBillsForAllOperators(
    periodStart: string,
    periodEnd: string
  ): { success: Bill[]; failed: { operatorName: string; error: string }[] } {
    const allRecords = this.recordRepository.findAll({
      status: 'reviewed',
      startDate: periodStart,
      endDate: periodEnd
    });

    const operators = [...new Set(allRecords.map(r => r.operatorName))];
    const success: Bill[] = [];
    const failed: { operatorName: string; error: string }[] = [];

    for (const operator of operators) {
      try {
        const bill = this.generateBill(operator, periodStart, periodEnd);
        success.push(bill);
      } catch (error: any) {
        failed.push({ operatorName: operator, error: error.message });
        logger.error(`生成账单失败: ${operator}, 错误: ${error.message}`);
      }
    }

    return { success, failed };
  }

  public getBillRecords(billId: string): WorkRecord[] {
    const recordIds = this.billRepository.getBillRecordIds(billId);
    const records: WorkRecord[] = [];

    for (const id of recordIds) {
      const record = this.recordRepository.findById(id);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  public issueBill(billId: string): boolean {
    return this.billRepository.updateStatus(billId, 'issued');
  }

  public markPaid(billId: string): boolean {
    return this.billRepository.updateStatus(billId, 'paid');
  }

  public getBills(filters?: { status?: string; operatorName?: string }): Bill[] {
    return this.billRepository.findAll(filters);
  }

  private generateBillNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `B${dateStr}${random}`;
  }
}
