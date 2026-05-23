import { createObjectCsvWriter } from 'csv-writer';
import * as path from 'path';
import * as fs from 'fs';
import { ReturnBatch, ReturnStatus, FinancialSummary, EquipmentItem, DepositDeduction } from '../types';
import { BatchDAO, EquipmentDAO, DeductionDAO, SummaryDAO, AttachmentDAO, AuditLogDAO } from '../database/dao';
import { StateMachineService } from './stateMachine';
import { FailedRecordDAO } from '../database/dao';

export interface ExportOptions {
  startDate?: Date;
  endDate?: Date;
  status?: ReturnStatus[];
  includeArchived?: boolean;
}

export class ExportService {
  private static exportDir = path.join(__dirname, '../../exports');

  static async ensureExportDir(): Promise<void> {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  static async exportBatchesToCSV(options: ExportOptions = {}): Promise<string> {
    await this.ensureExportDir();

    const { data: batches, total } = await BatchDAO.findAll(
      { isArchived: options.includeArchived },
      1,
      10000
    );

    const validBatches: ReturnBatch[] = [];
    for (const batch of batches) {
      const fullBatch = await StateMachineService.getBatchDetail(batch.id);
      if (!fullBatch) continue;

      const consistency = StateMachineService.validateDataConsistency(fullBatch);
      if (!consistency.valid) {
        await FailedRecordDAO.create({
          batchId: batch.id,
          failureType: 'DATA_INCONSISTENCY',
          errorMessage: '导出时发现数据不一致',
          errorDetails: consistency.errors,
          sourceData: { batchId: batch.id, batchNo: batch.batchNo }
        });
        continue;
      }

      if (options.startDate && batch.createdAt < options.startDate) continue;
      if (options.endDate && batch.createdAt > options.endDate) continue;
      if (options.status?.length && !options.status.includes(batch.status)) continue;

      validBatches.push(fullBatch);
    }

    const fileName = `batches_export_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'batchNo', title: '批次号' },
        { id: 'customerName', title: '客户名称' },
        { id: 'orderId', title: '关联订单' },
        { id: 'status', title: '当前状态' },
        { id: 'previousStatus', title: '上一状态' },
        { id: 'freezeReason', title: '冻结原因' },
        { id: 'frozenBy', title: '冻结操作人' },
        { id: 'frozenAt', title: '冻结时间' },
        { id: 'totalDeposit', title: '总押金' },
        { id: 'deductibleAmount', title: '扣款金额' },
        { id: 'finalRefund', title: '退款金额' },
        { id: 'manualReason', title: '人工调整说明' },
        { id: 'createdBy', title: '创建人' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'equipmentCount', title: '设备数量' },
        { id: 'attachmentCount', title: '附件数量' },
        { id: 'deductionCount', title: '扣款记录数' }
      ]
    });

    const records = validBatches.map(batch => ({
      batchNo: batch.batchNo,
      customerName: batch.customerName,
      orderId: batch.orderId,
      status: batch.status,
      previousStatus: batch.previousStatus || '',
      freezeReason: batch.freezeReason || '',
      frozenBy: batch.frozenBy || '',
      frozenAt: batch.frozenAt?.toISOString() || '',
      totalDeposit: batch.totalDeposit,
      deductibleAmount: batch.deductibleAmount,
      finalRefund: batch.finalRefund,
      manualReason: batch.manualReason || '',
      createdBy: batch.createdBy,
      createdAt: batch.createdAt.toISOString(),
      equipmentCount: (batch as any).equipmentList?.length || 0,
      attachmentCount: (batch as any).attachments?.length || 0,
      deductionCount: (batch as any).deductions?.length || 0
    }));

    await csvWriter.writeRecords(records);
    return filePath;
  }

  static async exportFinancialSummaryToCSV(): Promise<string> {
    await this.ensureExportDir();

    const summary = await SummaryDAO.getFinancialSummary();
    const fileName = `financial_summary_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'item', title: '项目' },
        { id: 'count', title: '数量' },
        { id: 'amount', title: '金额' }
      ]
    });

    const records = [
      { item: '总批次数', count: summary.totalBatches, amount: '' },
      { item: '总押金', count: '', amount: summary.totalDeposit },
      { item: '总扣款', count: '', amount: summary.totalDeductions },
      { item: '总退款', count: '', amount: summary.totalRefunds },
      { item: '冻结金额', count: '', amount: summary.frozenAmount },
      { item: '待审核金额', count: '', amount: summary.pendingReviewAmount },
      { item: '', count: '', amount: '' },
      { item: '按状态分布:', count: '', amount: '' }
    ];

    Object.entries(summary.byStatus).forEach(([status, data]) => {
      records.push({
        item: `  ${status}`,
        count: data.count.toString(),
        amount: data.amount.toString()
      });
    });

    await csvWriter.writeRecords(records);
    return filePath;
  }

  static async exportBatchDetailToCSV(batchId: string): Promise<string> {
    await this.ensureExportDir();

    const batch = await StateMachineService.getBatchDetail(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const consistency = StateMachineService.validateDataConsistency(batch);
    if (!consistency.valid) {
      throw new Error(`数据不一致: ${consistency.errors.join(', ')}`);
    }

    const fileName = `batch_${batch.batchNo}_detail_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const equipmentList = await EquipmentDAO.findByBatchId(batchId);
    const deductions = await DeductionDAO.findByBatchId(batchId);
    const attachments = await AttachmentDAO.findByBatchId(batchId);
    const auditLogs = await AuditLogDAO.findByBatchId(batchId);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'section', title: '区域' },
        { id: 'field', title: '字段' },
        { id: 'value', title: '值' }
      ]
    });

    const records: any[] = [];

    records.push({ section: '基本信息', field: '', value: '' });
    records.push({ section: '', field: '批次号', value: batch.batchNo });
    records.push({ section: '', field: '客户名称', value: batch.customerName });
    records.push({ section: '', field: '关联订单', value: batch.orderId });
    records.push({ section: '', field: '当前状态', value: batch.status });
    records.push({ section: '', field: '上一状态', value: batch.previousStatus || '' });
    records.push({ section: '', field: '总押金', value: batch.totalDeposit });
    records.push({ section: '', field: '扣款金额', value: batch.deductibleAmount });
    records.push({ section: '', field: '退款金额', value: batch.finalRefund });
    records.push({ section: '', field: '冻结原因', value: batch.freezeReason || '' });
    records.push({ section: '', field: '人工调整说明', value: batch.manualReason || '' });

    records.push({ section: '', field: '', value: '' });
    records.push({ section: '设备清单', field: '', value: '' });
    equipmentList.forEach((eq, idx) => {
      records.push({ section: '', field: `设备${idx + 1}`, value: `${eq.equipmentCode} - ${eq.equipmentName}` });
      records.push({ section: '', field: `  押金`, value: eq.depositAmount });
      records.push({ section: '', field: `  扣款`, value: eq.deductibleAmount });
      records.push({ section: '', field: `  状态`, value: eq.condition });
    });

    records.push({ section: '', field: '', value: '' });
    records.push({ section: '扣款明细', field: '', value: '' });
    deductions.forEach((ded, idx) => {
      records.push({ section: '', field: `扣款${idx + 1}`, value: `${ded.deductionType} - ${ded.reason}` });
      records.push({ section: '', field: `  金额`, value: ded.amount });
      records.push({ section: '', field: `  状态`, value: ded.isApproved ? '已批准' : '待批准' });
    });

    records.push({ section: '', field: '', value: '' });
    records.push({ section: '附件清单', field: '', value: '' });
    attachments.forEach((att, idx) => {
      records.push({ section: '', field: `附件${idx + 1}`, value: `${att.type} - ${att.fileName}` });
      records.push({ section: '', field: `  上传人`, value: att.uploadedBy });
      records.push({ section: '', field: `  审核状态`, value: att.isVerified ? '已审核' : '待审核' });
    });

    records.push({ section: '', field: '', value: '' });
    records.push({ section: '操作历史', field: '', value: '' });
    auditLogs.forEach((log, idx) => {
      records.push({ section: '', field: `操作${idx + 1}`, value: `${log.action} - ${log.reason}` });
      records.push({ section: '', field: `  操作人`, value: log.operatorName });
      records.push({ section: '', field: `  时间`, value: log.timestamp.toISOString() });
    });

    await csvWriter.writeRecords(records);
    return filePath;
  }

  static async getExportFiles(): Promise<{ name: string; path: string; size: number; createdAt: Date }[]> {
    await this.ensureExportDir();

    const files = fs.readdirSync(this.exportDir);
    return files
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        const fullPath = path.join(this.exportDir, f);
        const stats = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
