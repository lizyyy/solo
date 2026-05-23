import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import {
  BatchRepository,
  InspectionSheetRepository,
  RepairQuoteRepository,
  PhotoItemRepository,
  AbnormalPhotoRepository,
  SmsScreenshotRepository,
  AuditLogRepository,
  StatusTransitionRepository
} from '../repositories';
import { Batch, BatchStatus, AuditAction } from '../types';

export class ExportService {
  private exportDir = path.join(process.cwd(), 'exports');
  private batchRepo = new BatchRepository();
  private inspectionRepo = new InspectionSheetRepository();
  private repairQuoteRepo = new RepairQuoteRepository();
  private photoItemRepo = new PhotoItemRepository();
  private abnormalPhotoRepo = new AbnormalPhotoRepository();
  private smsRepo = new SmsScreenshotRepository();
  private auditLogRepo = new AuditLogRepository();
  private statusTransitionRepo = new StatusTransitionRepository();

  constructor() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportBatch(batchId: string, operator: string, operatorRole: string): Promise<string> {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (!batch.frozen) {
      throw new Error('批次未冻结，导出前请先冻结批次');
    }

    const exportDir = path.join(this.exportDir, `batch-${batch.batchNo}-${Date.now()}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const [inspectionSheets, repairQuotes, photoItems, abnormalPhotos, smsScreenshots, auditLogs, statusTransitions] = await Promise.all([
      this.inspectionRepo.findByBatchId(batchId),
      this.repairQuoteRepo.findByBatchId(batchId),
      this.photoItemRepo.findByBatchId(batchId),
      this.abnormalPhotoRepo.findByBatchId(batchId),
      this.smsRepo.findByBatchId(batchId),
      this.auditLogRepo.findByBatchId(batchId),
      this.statusTransitionRepo.findByBatchId(batchId)
    ]);

    await Promise.all([
      this.exportBatchInfo(exportDir, batch),
      this.exportInspectionSheets(exportDir, inspectionSheets),
      this.exportRepairQuotes(exportDir, repairQuotes),
      this.exportPhotoItems(exportDir, photoItems),
      this.exportAbnormalPhotos(exportDir, abnormalPhotos),
      this.exportSmsScreenshots(exportDir, smsScreenshots),
      this.exportAuditLogs(exportDir, auditLogs),
      this.exportStatusTransitions(exportDir, statusTransitions)
    ]);

    await this.auditLogRepo.create({
      batchId,
      action: AuditAction.BATCH_EXPORTED,
      newValue: exportDir,
      operator,
      operatorRole,
      remark: '导出批次数据'
    });

    return exportDir;
  }

  async exportAllBatches(operator: string, operatorRole: string): Promise<string> {
    const batches = await this.batchRepo.findAll();
    const exportDir = path.join(this.exportDir, `all-batches-${Date.now()}`);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const [allInspectionSheets, allRepairQuotes, allPhotoItems, allAbnormalPhotos, allSmsScreenshots, allAuditLogs, allStatusTransitions] = await Promise.all([
      Promise.all(batches.map(b => this.inspectionRepo.findByBatchId(b.id))),
      Promise.all(batches.map(b => this.repairQuoteRepo.findByBatchId(b.id))),
      Promise.all(batches.map(b => this.photoItemRepo.findByBatchId(b.id))),
      Promise.all(batches.map(b => this.abnormalPhotoRepo.findByBatchId(b.id))),
      Promise.all(batches.map(b => this.smsRepo.findByBatchId(b.id))),
      this.auditLogRepo.findAll(),
      this.statusTransitionRepo.findAll()
    ]);

    await Promise.all([
      this.exportBatches(exportDir, batches),
      this.exportInspectionSheets(exportDir, allInspectionSheets.flat()),
      this.exportRepairQuotes(exportDir, allRepairQuotes.flat()),
      this.exportPhotoItems(exportDir, allPhotoItems.flat()),
      this.exportAbnormalPhotos(exportDir, allAbnormalPhotos.flat()),
      this.exportSmsScreenshots(exportDir, allSmsScreenshots.flat()),
      this.exportAuditLogs(exportDir, allAuditLogs),
      this.exportStatusTransitions(exportDir, allStatusTransitions)
    ]);

    return exportDir;
  }

  private async exportBatchInfo(exportDir: string, batch: Batch): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '01-batch.csv'),
      header: [
        { id: 'id', title: '批次ID' },
        { id: 'batchNo', title: '批次编号' },
        { id: 'vin', title: 'VIN码' },
        { id: 'plateNumber', title: '车牌号' },
        { id: 'responsiblePerson', title: '责任人' },
        { id: 'status', title: '状态' },
        { id: 'submitCount', title: '提交次数' },
        { id: 'frozen', title: '是否冻结' },
        { id: 'frozenBy', title: '冻结人' },
        { id: 'frozenAt', title: '冻结时间' },
        { id: 'strategy', title: '幂等策略' },
        { id: 'createdBy', title: '创建人' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });
    await writer.writeRecords([{
      ...batch,
      frozen: batch.frozen ? '是' : '否',
      frozenAt: batch.frozenAt ? new Date(batch.frozenAt).toLocaleString() : '',
      createdAt: new Date(batch.createdAt).toLocaleString(),
      updatedAt: new Date(batch.updatedAt).toLocaleString()
    }]);
  }

  private async exportBatches(exportDir: string, batches: Batch[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '01-batches.csv'),
      header: [
        { id: 'id', title: '批次ID' },
        { id: 'batchNo', title: '批次编号' },
        { id: 'vin', title: 'VIN码' },
        { id: 'plateNumber', title: '车牌号' },
        { id: 'responsiblePerson', title: '责任人' },
        { id: 'status', title: '状态' },
        { id: 'submitCount', title: '提交次数' },
        { id: 'frozen', title: '是否冻结' },
        { id: 'createdBy', title: '创建人' },
        { id: 'createdAt', title: '创建时间' }
      ]
    });
    await writer.writeRecords(batches.map(b => ({
      ...b,
      frozen: b.frozen ? '是' : '否',
      createdAt: new Date(b.createdAt).toLocaleString()
    })));
  }

  private async exportInspectionSheets(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '02-inspection-sheets.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'sheetNo', title: '检测单编号' },
        { id: 'inspector', title: '检测员' },
        { id: 'inspectionDate', title: '检测日期' },
        { id: 'overallStatus', title: '整体状态' },
        { id: 'totalDefects', title: '缺陷总数' },
        { id: 'estimatedCost', title: '预估费用' },
        { id: 'status', title: '状态' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      inspectionDate: new Date(item.inspectionDate).toLocaleString()
    })));
  }

  private async exportRepairQuotes(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '03-repair-quotes.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'quoteNo', title: '报价单编号' },
        { id: 'workshop', title: '维修厂' },
        { id: 'quotedBy', title: '报价人' },
        { id: 'quoteDate', title: '报价日期' },
        { id: 'totalAmount', title: '总金额' },
        { id: 'laborCost', title: '人工费' },
        { id: 'partsCost', title: '配件费' },
        { id: 'status', title: '状态' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      quoteDate: new Date(item.quoteDate).toLocaleString()
    })));
  }

  private async exportPhotoItems(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '04-photo-items.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'photoNo', title: '照片编号' },
        { id: 'category', title: '分类' },
        { id: 'name', title: '名称' },
        { id: 'url', title: 'URL' },
        { id: 'uploadedBy', title: '上传人' },
        { id: 'uploadedAt', title: '上传时间' },
        { id: 'isAbnormal', title: '是否异常' },
        { id: 'abnormalDesc', title: '异常描述' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      uploadedAt: new Date(item.uploadedAt).toLocaleString(),
      isAbnormal: item.isAbnormal ? '是' : '否'
    })));
  }

  private async exportAbnormalPhotos(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '05-abnormal-photos.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'photoItemId', title: '照片ID' },
        { id: 'abnormalType', title: '异常类型' },
        { id: 'description', title: '描述' },
        { id: 'severity', title: '严重程度' },
        { id: 'reportedBy', title: '报告人' },
        { id: 'reportedAt', title: '报告时间' },
        { id: 'reviewed', title: '是否审核' },
        { id: 'reviewedBy', title: '审核人' },
        { id: 'manualOverride', title: '人工改判' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      reportedAt: new Date(item.reportedAt).toLocaleString(),
      reviewed: item.reviewed ? '是' : '否',
      manualOverride: item.manualOverride ? '是' : '否'
    })));
  }

  private async exportSmsScreenshots(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '06-sms-screenshots.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'smsNo', title: '短信编号' },
        { id: 'sender', title: '发送者' },
        { id: 'receiver', title: '接收者' },
        { id: 'content', title: '内容' },
        { id: 'sentAt', title: '发送时间' },
        { id: 'url', title: '截图URL' },
        { id: 'uploadedBy', title: '上传人' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      sentAt: new Date(item.sentAt).toLocaleString()
    })));
  }

  private async exportAuditLogs(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '07-audit-logs.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'itemType', title: '项目类型' },
        { id: 'action', title: '操作' },
        { id: 'oldValue', title: '旧值' },
        { id: 'newValue', title: '新值' },
        { id: 'operator', title: '操作人' },
        { id: 'operatorRole', title: '角色' },
        { id: 'remark', title: '备注' },
        { id: 'createdAt', title: '时间' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt).toLocaleString()
    })));
  }

  private async exportStatusTransitions(exportDir: string, items: any[]): Promise<void> {
    const writer = createObjectCsvWriter({
      path: path.join(exportDir, '08-status-transitions.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'batchId', title: '批次ID' },
        { id: 'fromStatus', title: '原状态' },
        { id: 'toStatus', title: '新状态' },
        { id: 'reason', title: '原因' },
        { id: 'operator', title: '操作人' },
        { id: 'createdAt', title: '时间' }
      ]
    });
    await writer.writeRecords(items.map(item => ({
      ...item,
      createdAt: new Date(item.createdAt).toLocaleString()
    })));
  }
}
