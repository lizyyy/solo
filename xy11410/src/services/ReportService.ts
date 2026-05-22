import { AppDataSource } from '../data-source';
import { MaterialReceipt } from '../entities/MaterialReceipt';
import { ReceiptStatus, RecordStatus } from '../constants/ReceiptStatus';
import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';

export interface ReportStats {
  totalRecords: number;
  unprocessedCount: number;
  correctedCount: number;
  needsManualConfirmCount: number;
  processedCount: number;
  totalAmount: number;
  frozenCount: number;
  frozenAmount: number;
}

export interface FranchiseReport {
  franchiseId: string;
  franchiseName: string;
  franchiseCode: string;
  stats: ReportStats;
  receipts: MaterialReceipt[];
}

export class ReportService {
  private receiptRepository = AppDataSource.getRepository(MaterialReceipt);

  async getStatistics(params: {
    franchiseId?: string;
    batchId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ReportStats> {
    const { franchiseId, batchId, startDate, endDate } = params;

    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .where('receipt.isDeleted = :isDeleted', { isDeleted: false });

    if (franchiseId) {
      queryBuilder.andWhere('receipt.franchiseId = :franchiseId', { franchiseId });
    }

    if (batchId) {
      queryBuilder.andWhere('receipt.batchId = :batchId', { batchId });
    }

    if (startDate) {
      queryBuilder.andWhere('receipt.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('receipt.createdAt <= :endDate', { endDate });
    }

    const allReceipts = await queryBuilder.getMany();

    const stats: ReportStats = {
      totalRecords: allReceipts.length,
      unprocessedCount: 0,
      correctedCount: 0,
      needsManualConfirmCount: 0,
      processedCount: 0,
      totalAmount: 0,
      frozenCount: 0,
      frozenAmount: 0
    };

    for (const receipt of allReceipts) {
      stats.totalAmount += receipt.amount || 0;

      switch (receipt.recordStatus) {
        case RecordStatus.UNPROCESSED:
          stats.unprocessedCount++;
          break;
        case RecordStatus.CORRECTED:
          stats.correctedCount++;
          break;
        case RecordStatus.NEEDS_MANUAL_CONFIRM:
          stats.needsManualConfirmCount++;
          break;
        case RecordStatus.PROCESSED:
          stats.processedCount++;
          break;
      }

      if (receipt.status === ReceiptStatus.FROZEN) {
        stats.frozenCount++;
        stats.frozenAmount += receipt.amount || 0;
      }
    }

    return stats;
  }

  async getFranchiseReport(franchiseId: string): Promise<FranchiseReport> {
    const receipts = await this.receiptRepository.find({
      where: { franchiseId, isDeleted: false },
      relations: ['franchise', 'batch'],
      order: { createdAt: 'DESC' }
    });

    const stats = await this.getStatistics({ franchiseId });

    return {
      franchiseId,
      franchiseName: receipts[0]?.franchise?.name || '',
      franchiseCode: receipts[0]?.franchise?.code || '',
      stats,
      receipts
    };
  }

  async exportToCSV(params: {
    franchiseId?: string;
    batchId?: string;
    status?: ReceiptStatus;
    recordStatus?: RecordStatus;
  }): Promise<string> {
    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.franchise', 'franchise')
      .leftJoinAndSelect('receipt.batch', 'batch')
      .where('receipt.isDeleted = :isDeleted', { isDeleted: false });

    if (params.franchiseId) {
      queryBuilder.andWhere('receipt.franchiseId = :franchiseId', { franchiseId: params.franchiseId });
    }

    if (params.batchId) {
      queryBuilder.andWhere('receipt.batchId = :batchId', { batchId: params.batchId });
    }

    if (params.status) {
      queryBuilder.andWhere('receipt.status = :status', { status: params.status });
    }

    if (params.recordStatus) {
      queryBuilder.andWhere('receipt.recordStatus = :recordStatus', { recordStatus: params.recordStatus });
    }

    const receipts = await queryBuilder.getMany();

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `receipts_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'receiptNo', title: '回执单号' },
        { id: 'franchiseName', title: '加盟商' },
        { id: 'batchName', title: '所属批次' },
        { id: 'materialName', title: '物料名称' },
        { id: 'materialCode', title: '物料编码' },
        { id: 'sourceType', title: '来源类型' },
        { id: 'sourceNo', title: '来源单号' },
        { id: 'quantity', title: '系统数量' },
        { id: 'reportedQuantity', title: '上报数量' },
        { id: 'unitPrice', title: '单价' },
        { id: 'amount', title: '系统金额' },
        { id: 'reportedAmount', title: '上报金额' },
        { id: 'status', title: '状态' },
        { id: 'recordStatus', title: '处理状态' },
        { id: 'abnormalType', title: '异常类型' },
        { id: 'abnormalReason', title: '异常原因' },
        { id: 'manualReason', title: '人工处理原因' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });

    const records = receipts.map(r => ({
      receiptNo: r.receiptNo,
      franchiseName: r.franchise?.name || '',
      batchName: r.batch?.batchName || '',
      materialName: r.materialName || '',
      materialCode: r.materialCode || '',
      sourceType: r.sourceType,
      sourceNo: r.sourceNo || '',
      quantity: r.quantity,
      reportedQuantity: r.reportedQuantity,
      unitPrice: r.unitPrice,
      amount: r.amount,
      reportedAmount: r.reportedAmount,
      status: this.getStatusText(r.status),
      recordStatus: this.getRecordStatusText(r.recordStatus),
      abnormalType: r.abnormalType || '',
      abnormalReason: r.abnormalReason || '',
      manualReason: r.manualReason || '',
      createdAt: r.createdAt.toISOString()
    }));

    await csvWriter.writeRecords(records);

    return filePath;
  }

  async exportFranchiseSummary(franchiseId: string): Promise<string> {
    const report = await this.getFranchiseReport(franchiseId);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `franchise_summary_${franchiseId}_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'item', title: '项目' },
        { id: 'value', title: '数值' }
      ]
    });

    const summaryRecords = [
      { item: '加盟商名称', value: report.franchiseName },
      { item: '加盟商编码', value: report.franchiseCode },
      { item: '总记录数', value: report.stats.totalRecords },
      { item: '未处理记录', value: report.stats.unprocessedCount },
      { item: '已修正记录', value: report.stats.correctedCount },
      { item: '需人工确认', value: report.stats.needsManualConfirmCount },
      { item: '已处理记录', value: report.stats.processedCount },
      { item: '总金额', value: report.stats.totalAmount },
      { item: '冻结记录数', value: report.stats.frozenCount },
      { item: '冻结金额', value: report.stats.frozenAmount }
    ];

    await csvWriter.writeRecords(summaryRecords);

    return filePath;
  }

  private getStatusText(status: ReceiptStatus): string {
    const statusMap: Record<ReceiptStatus, string> = {
      [ReceiptStatus.DRAFT]: '草稿',
      [ReceiptStatus.PENDING_REVIEW]: '待审核',
      [ReceiptStatus.APPROVED]: '已通过',
      [ReceiptStatus.REJECTED]: '已驳回',
      [ReceiptStatus.FROZEN]: '已冻结',
      [ReceiptStatus.SETTLED]: '已结算',
      [ReceiptStatus.ARCHIVED]: '已归档',
      [ReceiptStatus.CANCELLED]: '已取消'
    };
    return statusMap[status] || status;
  }

  private getRecordStatusText(status: RecordStatus): string {
    const statusMap: Record<RecordStatus, string> = {
      [RecordStatus.UNPROCESSED]: '未处理',
      [RecordStatus.CORRECTED]: '已修正',
      [RecordStatus.NEEDS_MANUAL_CONFIRM]: '需人工确认',
      [RecordStatus.PROCESSED]: '已处理'
    };
    return statusMap[status] || status;
  }
}

export const reportService = new ReportService();
