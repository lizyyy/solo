import { createObjectCsvWriter } from 'csv-writer';
import { QueryFilter, ExportRecord, ImportResult, QueueRecord, RecordStatus, QueueStatus } from '../types';
import { queueStore } from '../store/QueueStore';
import * as path from 'path';
import * as fs from 'fs';

class ExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToCsv(filter: QueryFilter): Promise<string> {
    const records = queueStore.getExportRecords(filter);
    const fileName = `queue_records_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'visitorId', title: '访客ID' },
        { id: 'visitorName', title: '访客姓名' },
        { id: 'visitorPhone', title: '访客电话' },
        { id: 'visitorEmail', title: '访客邮箱' },
        { id: 'skillGroupId', title: '技能组ID' },
        { id: 'skillGroupName', title: '技能组名称' },
        { id: 'overflowTargetId', title: '溢出目标ID' },
        { id: 'overflowTargetName', title: '溢出目标名称' },
        { id: 'status', title: '当前状态' },
        { id: 'recordStatus', title: '记录状态' },
        { id: 'queueStartTime', title: '排队开始时间' },
        { id: 'connectedTime', title: '接入时间' },
        { id: 'abandonedTime', title: '放弃时间' },
        { id: 'queueDurationSeconds', title: '排队时长(秒)' },
        { id: 'ownerId', title: '负责人ID' },
        { id: 'ownerName', title: '负责人姓名' },
        { id: 'businessObject', title: '业务对象' },
        { id: 'isOverflowPlaceholder', title: '是否溢出占位' },
        { id: 'statusHistoryCount', title: '状态变更次数' },
        { id: 'lastStatusChangeTime', title: '最后状态变更时间' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    const csvRecords = records.map(r => ({
      id: r.id,
      visitorId: r.visitor.id,
      visitorName: r.visitor.name,
      visitorPhone: r.visitor.phone || '',
      visitorEmail: r.visitor.email || '',
      skillGroupId: r.skillGroupId,
      skillGroupName: r.skillGroupName,
      overflowTargetId: r.overflowTargetId || '',
      overflowTargetName: r.overflowTargetName || '',
      status: this.translateStatus(r.status),
      recordStatus: this.translateRecordStatus(r.recordStatus),
      queueStartTime: r.queueStartTime.toISOString(),
      connectedTime: r.connectedTime?.toISOString() || '',
      abandonedTime: r.abandonedTime?.toISOString() || '',
      queueDurationSeconds: r.queueDurationSeconds,
      ownerId: r.ownerId || '',
      ownerName: r.ownerName || '',
      businessObject: r.businessObject || '',
      isOverflowPlaceholder: r.isOverflowPlaceholder ? '是' : '否',
      statusHistoryCount: r.statusHistoryCount,
      lastStatusChangeTime: r.lastStatusChangeTime.toISOString(),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    await csvWriter.writeRecords(csvRecords);
    return filePath;
  }

  private translateStatus(status: QueueStatus): string {
    const statusMap: Record<QueueStatus, string> = {
      [QueueStatus.QUEUING]: '排队中',
      [QueueStatus.OVERFLOWING]: '溢出中',
      [QueueStatus.CONNECTED]: '已接入',
      [QueueStatus.ABANDONED]: '放弃'
    };
    return statusMap[status] || status;
  }

  private translateRecordStatus(status: RecordStatus): string {
    const statusMap: Record<RecordStatus, string> = {
      [RecordStatus.SUCCESS]: '成功',
      [RecordStatus.CONFLICT]: '冲突',
      [RecordStatus.REJECTED]: '驳回',
      [RecordStatus.COMPLETED]: '已完成'
    };
    return statusMap[status] || status;
  }

  async importFromJson(data: Array<Record<string, unknown>>): Promise<ImportResult> {
    const result: ImportResult = {
      successCount: 0,
      failedCount: 0,
      errors: []
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        this.validateImportRow(row, i + 1);
        result.successCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : '未知错误',
          data: row
        });
      }
    }

    return result;
  }

  private validateImportRow(row: Record<string, unknown>, rowNum: number): void {
    if (!row.visitorId || typeof row.visitorId !== 'string') {
      throw new Error(`第${rowNum}行：访客ID不能为空`);
    }
    if (!row.visitorName || typeof row.visitorName !== 'string') {
      throw new Error(`第${rowNum}行：访客姓名不能为空`);
    }
    if (!row.skillGroupId || typeof row.skillGroupId !== 'string') {
      throw new Error(`第${rowNum}行：技能组ID不能为空`);
    }
    if (!row.skillGroupName || typeof row.skillGroupName !== 'string') {
      throw new Error(`第${rowNum}行：技能组名称不能为空`);
    }
  }

  getExportFiles(): string[] {
    return fs.readdirSync(this.exportDir);
  }
}

export const exportService = new ExportService();