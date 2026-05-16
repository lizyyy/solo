import { ChangeRecord, ManualCorrection, QueryFilter, ProcessingStatus, ApprovalNode } from '../types';
import { ChangeIndexDB } from '../db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let dbInstance: ChangeIndexDB | null = null;

export function getDB(): ChangeIndexDB {
  if (!dbInstance) {
    throw new Error('数据库未初始化，请先调用 initDB()');
  }
  return dbInstance;
}

export async function initDB(): Promise<ChangeIndexDB> {
  if (!dbInstance) {
    const { createDB } = await import('../db');
    dbInstance = await createDB();
  }
  return dbInstance;
}

function generateId(): string {
  return crypto.randomUUID();
}

export function queryRecords(filter: QueryFilter = {}): ChangeRecord[] {
  return getDB().getRecords(filter);
}

export function getRecordWithCorrections(recordId: string): { record: ChangeRecord; corrections: ManualCorrection[] } | null {
  const db = getDB();
  const record = db.getRecordById(recordId);
  if (!record) return null;
  const corrections = db.getCorrectionsByRecordId(recordId);
  return { record, corrections };
}

export async function manualCorrect(
  recordId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  operator: string,
  remark: string,
  approvalNode: string
): Promise<void> {
  const db = getDB();
  const record = db.getRecordById(recordId);
  if (!record) {
    throw new Error('记录不存在');
  }

  const correction: ManualCorrection = {
    id: generateId(),
    recordId,
    fieldName,
    oldValue,
    newValue,
    operator,
    remark,
    approvalNode: approvalNode as ApprovalNode,
    correctedAt: new Date().toISOString()
  };

  await db.insertCorrection(correction);

  record.status = ProcessingStatus.MANUAL_CORRECTED;
  record.updatedAt = new Date().toISOString();

  await db.updateRecord(record);
}

export function exportToJSON(filter: QueryFilter = {}): string {
  const db = getDB();
  const records = db.getRecords(filter);
  const recordsWithCorrections = records.map(record => ({
    ...record,
    corrections: db.getCorrectionsByRecordId(record.id)
  }));

  return JSON.stringify(recordsWithCorrections, null, 2);
}

export function exportToMarkdown(filter: QueryFilter = {}): string {
  const db = getDB();
  const records = db.getRecords(filter);
  let md = '# 多仓库变更索引 - 发票红冲记录\n\n';
  md += `导出时间：${new Date().toLocaleString()}\n\n`;
  md += `共 ${records.length} 条记录\n\n`;
  md += '---\n\n';

  records.forEach((record, index) => {
    const corrections = db.getCorrectionsByRecordId(record.id);
    
    md += `## 记录 ${index + 1}: ${record.invoiceNumber}\n\n`;
    md += `- **记录ID**: ${record.id}\n`;
    md += `- **批次ID**: ${record.batchId}\n`;
    md += `- **操作人**: ${record.operator}\n`;
    md += `- **风险类型**: ${record.riskType}\n`;
    md += `- **状态**: ${record.status}\n`;
    md += `- **当前审批节点**: ${record.currentApprovalNode}\n`;
    md += `- **原金额**: ¥${record.originalAmount.toFixed(2)}\n`;
    md += `- **红冲金额**: ¥${record.redFlushAmount.toFixed(2)}\n`;
    md += `- **归档路径**: ${record.archivePath}\n`;
    md += `- **材料摘要**: ${record.materialSummary}\n`;
    md += `- **创建时间**: ${new Date(record.createdAt).toLocaleString()}\n`;
    md += `- **更新时间**: ${new Date(record.updatedAt).toLocaleString()}\n`;
    
    if (record.failureReason) {
      md += `- **失败原因**: ${record.failureReason}\n`;
    }
    
    if (record.smsRecords.length > 0) {
      md += `\n### 短信发送清单\n\n`;
      md += '| 短信ID | 手机号 | 内容 | 发送时间 | 状态 |\n';
      md += '|--------|--------|------|----------|------|\n';
      record.smsRecords.forEach(sms => {
        md += `| ${sms.id} | ${sms.phone} | ${sms.content} | ${new Date(sms.sendTime).toLocaleString()} | ${sms.status} |\n`;
      });
    }
    
    if (corrections.length > 0) {
      md += `\n### 人工修正记录\n\n`;
      md += '| 修正ID | 字段 | 原值 | 新值 | 操作人 | 备注 | 审批节点 | 修正时间 |\n';
      md += '|--------|------|------|------|--------|------|----------|----------|\n';
      corrections.forEach(c => {
        md += `| ${c.id} | ${c.fieldName} | ${c.oldValue} | ${c.newValue} | ${c.operator} | ${c.remark} | ${c.approvalNode} | ${new Date(c.correctedAt).toLocaleString()} |\n`;
      });
    }
    
    md += '\n---\n\n';
  });

  return md;
}

export function saveExportFile(content: string, format: 'json' | 'md', outputDir?: string): string {
  const dir = outputDir || process.cwd();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `change-index-export-${timestamp}.${format}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

export function getBatches() {
  return getDB().getBatches();
}

export function getRecordsByApprovalNode(approvalNode: string) {
  const db = getDB();
  const corrections = db.getCorrectionsByApprovalNode(approvalNode);
  const recordIds = [...new Set(corrections.map(c => c.recordId))];
  const records = recordIds.map(id => db.getRecordById(id)).filter(Boolean) as ChangeRecord[];
  return records.map(record => ({
    record,
    corrections: db.getCorrectionsByRecordId(record.id).filter(c => c.approvalNode === approvalNode)
  }));
}

export function getApprovalNodeHistory(recordId: string): ManualCorrection[] {
  return getDB().getCorrectionsByRecordId(recordId);
}
