import { createObjectCsvWriter } from 'csv-writer';
import { AudienceSegment, PublishRecord, StatusHistory, SegmentStatus, OperationType } from './types';
import { store } from './store';
import * as path from 'path';

export const exportFields = [
  { id: 'segmentId', title: '人群包ID' },
  { id: 'segmentName', title: '人群包名称' },
  { id: 'segmentStatus', title: '人群包状态' },
  { id: 'ruleVersion', title: '规则版本' },
  { id: 'audienceCount', title: '人群数量' },
  { id: 'publishRecordId', title: '发布记录ID' },
  { id: 'channel', title: '发布渠道' },
  { id: 'channelAccount', title: '渠道账号' },
  { id: 'publishStatus', title: '发布状态' },
  { id: 'isRevoking', title: '是否撤销中' },
  { id: 'isRevoked', title: '是否已撤销' },
  { id: 'publishedBy', title: '发布人' },
  { id: 'publishedAt', title: '发布时间' },
  { id: 'revokeReason', title: '撤销原因' },
  { id: 'revokeRemark', title: '撤销备注' },
  { id: 'revokeRequestedBy', title: '撤销申请人' },
  { id: 'revokeRequestedAt', title: '撤销申请时间' },
  { id: 'revokeCompletedAt', title: '撤销完成时间' },
  { id: 'createdBy', title: '创建人' },
  { id: 'createdAt', title: '创建时间' }
];

export function formatDate(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatBoolean(value: boolean): string {
  return value ? '是' : '否';
}

export interface ExportRow {
  segmentId: string;
  segmentName: string;
  segmentStatus: string;
  ruleVersion: string;
  audienceCount: number;
  publishRecordId: string;
  channel: string;
  channelAccount: string;
  publishStatus: string;
  isRevoking: string;
  isRevoked: string;
  publishedBy: string;
  publishedAt: string;
  revokeReason: string;
  revokeRemark: string;
  revokeRequestedBy: string;
  revokeRequestedAt: string;
  revokeCompletedAt: string;
  createdBy: string;
  createdAt: string;
}

export function generateExportData(segmentId?: string): ExportRow[] {
  const segments = segmentId
    ? [store.getSegment(segmentId)].filter(Boolean) as AudienceSegment[]
    : store.listSegments();

  const rows: ExportRow[] = [];

  for (const segment of segments) {
    const records = store.listPublishRecords(segment.id);
    
    if (records.length === 0) {
      rows.push({
        segmentId: segment.id,
        segmentName: segment.name,
        segmentStatus: segment.status,
        ruleVersion: segment.ruleVersion,
        audienceCount: segment.audienceCount,
        publishRecordId: '',
        channel: '',
        channelAccount: '',
        publishStatus: '',
        isRevoking: '',
        isRevoked: '',
        publishedBy: '',
        publishedAt: '',
        revokeReason: '',
        revokeRemark: '',
        revokeRequestedBy: '',
        revokeRequestedAt: '',
        revokeCompletedAt: '',
        createdBy: segment.createdBy,
        createdAt: formatDate(segment.createdAt)
      });
    } else {
      for (const record of records) {
        rows.push({
          segmentId: segment.id,
          segmentName: segment.name,
          segmentStatus: segment.status,
          ruleVersion: record.ruleVersion,
          audienceCount: record.audienceCount,
          publishRecordId: record.id,
          channel: record.channel,
          channelAccount: record.channelAccount,
          publishStatus: record.status,
          isRevoking: formatBoolean(record.isRevoking),
          isRevoked: formatBoolean(record.isRevoked),
          publishedBy: record.publishedBy,
          publishedAt: formatDate(record.publishedAt),
          revokeReason: record.revokeReason || '',
          revokeRemark: record.revokeRemark || '',
          revokeRequestedBy: record.revokeRequestedBy || '',
          revokeRequestedAt: formatDate(record.revokeRequestedAt),
          revokeCompletedAt: formatDate(record.revokeCompletedAt),
          createdBy: segment.createdBy,
          createdAt: formatDate(segment.createdAt)
        });
      }
    }
  }

  return rows;
}

export async function exportToCsv(filePath: string, segmentId?: string): Promise<string> {
  const data = generateExportData(segmentId);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: exportFields,
    encoding: 'utf8'
  });

  await csvWriter.writeRecords(data);
  return path.resolve(filePath);
}

export function getSegmentWithRecords(segmentId: string) {
  const segment = store.getSegment(segmentId);
  if (!segment) return null;

  const records = store.listPublishRecords(segmentId);
  const histories = store.listHistories(segmentId);

  return {
    segment: {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      ruleVersion: segment.ruleVersion,
      status: segment.status,
      audienceCount: segment.audienceCount,
      createdBy: segment.createdBy,
      createdAt: formatDate(segment.createdAt),
      updatedBy: segment.updatedBy,
      updatedAt: formatDate(segment.updatedAt),
      publishedAt: formatDate(segment.publishedAt),
      revokedAt: formatDate(segment.revokedAt)
    },
    publishRecords: records.map(r => ({
      id: r.id,
      channel: r.channel,
      channelAccount: r.channelAccount,
      status: r.status,
      audienceCount: r.audienceCount,
      isRevoking: r.isRevoking,
      isRevoked: r.isRevoked,
      publishedBy: r.publishedBy,
      publishedAt: formatDate(r.publishedAt),
      revokeReason: r.revokeReason,
      revokeRemark: r.revokeRemark,
      revokeRequestedBy: r.revokeRequestedBy,
      revokeRequestedAt: formatDate(r.revokeRequestedAt),
      revokeCompletedAt: formatDate(r.revokeCompletedAt)
    })),
    histories: histories.map(h => ({
      id: h.id,
      operation: h.operation,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      operator: h.operator,
      operateAt: formatDate(h.operateAt),
      remark: h.remark,
      channel: h.channel,
      exceptionInfo: h.exceptionInfo,
      handlerInfo: h.handlerInfo
    }))
  };
}

export interface ImportResult {
  success: Array<{ row: number; segmentId: string }>;
  failed: Array<{ row: number; error: string; data: any }>;
}

export function importSegments(
  data: Array<{
    name: string;
    description: string;
    ruleVersion: string;
    audienceCount: number;
  }>,
  operator: string
): ImportResult {
  const result: ImportResult = { success: [], failed: [] };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 1;

    try {
      if (!row.name || row.name.trim() === '') {
        throw new Error('人群包名称不能为空');
      }
      if (!row.ruleVersion || row.ruleVersion.trim() === '') {
        throw new Error('规则版本不能为空');
      }
      if (typeof row.audienceCount !== 'number' || row.audienceCount < 0) {
        throw new Error('人群数量必须是非负整数');
      }

      const segment = store.createSegment(
        row.name.trim(),
        row.description || '',
        row.ruleVersion.trim(),
        row.audienceCount,
        operator
      );

      result.success.push({ row: rowNum, segmentId: segment.id });
    } catch (error: any) {
      result.failed.push({
        row: rowNum,
        error: error.message,
        data: row
      });

      store.addHistory({
        segmentId: `import-error-${rowNum}`,
        operation: OperationType.IMPORT,
        toStatus: SegmentStatus.DRAFT,
        operator,
        operateAt: new Date(),
        remark: `导入失败: ${error.message}`,
        exceptionInfo: JSON.stringify(row)
      });
    }
  }

  return result;
}
