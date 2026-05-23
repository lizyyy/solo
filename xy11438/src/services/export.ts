import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { FactRecord, DirtyRecord } from '../types';
import { getFactRecordsByDateRange, getDirtyRecords } from '../database';

const EXPORT_DIR = './exports';

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

export async function exportFactsToJson(
  startDate: string,
  endDate: string,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const facts = await getFactRecordsByDateRange(startDate, endDate);
  const outputFilename = filename || `facts_${startDate}_${endDate}.json`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  fs.writeFileSync(filePath, JSON.stringify(facts, null, 2));
  console.log(`[Export] Exported ${facts.length} fact records to ${filePath}`);
  
  return filePath;
}

export async function exportFactsToCsv(
  startDate: string,
  endDate: string,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const facts = await getFactRecordsByDateRange(startDate, endDate);
  const outputFilename = filename || `facts_${startDate}_${endDate}.csv`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  const records = facts.map(fact => ({
    factId: fact.factId,
    roomId: fact.roomId,
    date: fact.date,
    guestName: fact.orderInfo?.guestName || '',
    orderId: fact.orderInfo?.orderId || '',
    checkIn: fact.orderInfo?.checkInDate || '',
    checkOut: fact.orderInfo?.checkOutDate || '',
    nights: fact.orderInfo?.nights || 0,
    isContinuousStay: fact.orderInfo?.isContinuousStay ? '是' : '否',
    linenChangeRequired: fact.orderInfo?.linenChangeRequired ? '是' : '否',
    cleanerName: fact.cleaningInfo?.cleanerName || '',
    cleaningType: fact.cleaningInfo?.cleaningType || '',
    cleaningStatus: fact.cleaningInfo?.status || '',
    scheduledDate: fact.cleaningInfo?.scheduledDate || '',
    maintenanceCount: fact.maintenanceInfo?.length || 0,
    approvalCount: fact.approvalInfo?.length || 0,
    reconciliationStatus: fact.reconciliationStatus,
    mismatchReasons: (fact.mismatchReasons || []).join('; '),
    verifiedAmount: fact.verifiedAmount || 0,
    createdAt: fact.createdAt,
    updatedAt: fact.updatedAt
  }));

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'factId', title: '事实ID' },
      { id: 'roomId', title: '房间号' },
      { id: 'date', title: '日期' },
      { id: 'guestName', title: '客人姓名' },
      { id: 'orderId', title: '订单ID' },
      { id: 'checkIn', title: '入住日期' },
      { id: 'checkOut', title: '退房日期' },
      { id: 'nights', title: '晚数' },
      { id: 'isContinuousStay', title: '连住' },
      { id: 'linenChangeRequired', title: '换布草' },
      { id: 'cleanerName', title: '保洁员' },
      { id: 'cleaningType', title: '保洁类型' },
      { id: 'cleaningStatus', title: '保洁状态' },
      { id: 'scheduledDate', title: '保洁日期' },
      { id: 'maintenanceCount', title: '维修次数' },
      { id: 'approvalCount', title: '审批次数' },
      { id: 'reconciliationStatus', title: '对账状态' },
      { id: 'mismatchReasons', title: '不匹配原因' },
      { id: 'verifiedAmount', title: '验证金额' },
      { id: 'createdAt', title: '创建时间' },
      { id: 'updatedAt', title: '更新时间' }
    ]
  });

  await csvWriter.writeRecords(records);
  console.log(`[Export] Exported ${facts.length} fact records to ${filePath}`);
  
  return filePath;
}

export async function exportDirtyRecordsToJson(
  resolved?: boolean,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const records = await getDirtyRecords(resolved);
  const status = resolved === true ? 'resolved' : resolved === false ? 'unresolved' : 'all';
  const outputFilename = filename || `dirty_records_${status}_${new Date().toISOString().split('T')[0]}.json`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
  console.log(`[Export] Exported ${records.length} dirty records to ${filePath}`);
  
  return filePath;
}

export async function exportDirtyRecordsToCsv(
  resolved?: boolean,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const records = await getDirtyRecords(resolved);
  const status = resolved === true ? 'resolved' : resolved === false ? 'unresolved' : 'all';
  const outputFilename = filename || `dirty_records_${status}_${new Date().toISOString().split('T')[0]}.csv`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  const csvRecords = records.map(r => ({
    id: r.id,
    recordId: r.recordId,
    sourceType: r.sourceType,
    dirtyType: r.dirtyType,
    fieldName: r.fieldName || '',
    originalValue: r.originalValue || '',
    expectedValue: r.expectedValue || '',
    description: r.description,
    resolution: r.resolution || '',
    resolved: r.resolved ? '是' : '否',
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt || ''
  }));

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: '脏记录ID' },
      { id: 'recordId', title: '源记录ID' },
      { id: 'sourceType', title: '数据来源' },
      { id: 'dirtyType', title: '脏数据类型' },
      { id: 'fieldName', title: '字段名' },
      { id: 'originalValue', title: '原始值' },
      { id: 'expectedValue', title: '期望值' },
      { id: 'description', title: '描述' },
      { id: 'resolution', title: '处理方案' },
      { id: 'resolved', title: '已解决' },
      { id: 'createdAt', title: '创建时间' },
      { id: 'resolvedAt', title: '解决时间' }
    ]
  });

  await csvWriter.writeRecords(csvRecords);
  console.log(`[Export] Exported ${records.length} dirty records to ${filePath}`);
  
  return filePath;
}

export async function exportReconciliationReport(
  result: any,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const outputFilename = filename || `reconciliation_${result.periodStart}_${result.periodEnd}.json`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`[Export] Exported reconciliation report to ${filePath}`);
  
  return filePath;
}

export async function exportReconciliationReportToCsv(
  result: any,
  filename?: string
): Promise<string> {
  ensureExportDir();
  
  const outputFilename = filename || `reconciliation_${result.periodStart}_${result.periodEnd}.csv`;
  const filePath = path.join(EXPORT_DIR, outputFilename);

  const summaryRecords = [{
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    totalFactRecords: result.totalFactRecords,
    matchedRecords: result.matchedRecords,
    mismatchedRecords: result.mismatchedRecords,
    pendingRecords: result.pendingRecords,
    totalVerifiedAmount: result.totalVerifiedAmount,
    totalBilledAmount: result.totalBilledAmount,
    discrepancy: result.discrepancy
  }];

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'periodStart', title: '对账起始日期' },
      { id: 'periodEnd', title: '对账结束日期' },
      { id: 'totalFactRecords', title: '事实记录总数' },
      { id: 'matchedRecords', title: '已匹配记录' },
      { id: 'mismatchedRecords', title: '不匹配记录' },
      { id: 'pendingRecords', title: '待处理记录' },
      { id: 'totalVerifiedAmount', title: '验证总金额' },
      { id: 'totalBilledAmount', title: '账单总金额' },
      { id: 'discrepancy', title: '差额' }
    ]
  });

  await csvWriter.writeRecords(summaryRecords);
  console.log(`[Export] Exported reconciliation report to ${filePath}`);
  
  return filePath;
}
