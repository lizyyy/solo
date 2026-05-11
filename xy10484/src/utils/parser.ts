import fs from 'fs-extra';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { Order, SignRecord, RefuseRecord, ClaimRecord } from '../types';

export function parseJSON<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export function parseOrders(filePath: string): Order[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    const data = parseJSON<Order[]>(filePath);
    return data;
  }
  
  if (ext === '.csv') {
    const rows = parseCSV(filePath);
    return rows.map((row, index) => ({
      orderNo: row.orderNo || row['订单号'] || `ORD-${index + 1}`,
      trackingNo: row.trackingNo || row['运单号'] || '',
      amount: parseFloat(row.amount || row['金额'] || '0'),
      shippedAt: row.shippedAt || row['发货时间'] || '',
      status: (row.status || row['状态'] || 'pending') as Order['status'],
      product: row.product || row['商品'] || '',
      customer: row.customer || row['客户'] || '',
    }));
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}

export function parseSignRecords(filePath: string): SignRecord[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    const data = parseJSON<SignRecord[]>(filePath);
    return data;
  }
  
  if (ext === '.csv') {
    const rows = parseCSV(filePath);
    return rows.map((row) => ({
      trackingNo: row.trackingNo || row['运单号'] || '',
      signedAt: row.signedAt || row['签收时间'] || '',
      signedBy: row.signedBy || row['签收人'] || '',
      hasPhoto: (row.hasPhoto || row['有照片'] || 'false').toLowerCase() === 'true',
      photoUrl: row.photoUrl || row['照片链接'] || undefined,
      batchId: row.batchId || row['批次号'] || '',
      status: (row.status || row['状态'] || 'success') as SignRecord['status'],
    }));
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}

export function parseRefuseRecords(filePath: string): RefuseRecord[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    const data = parseJSON<RefuseRecord[]>(filePath);
    return data;
  }
  
  if (ext === '.csv') {
    const rows = parseCSV(filePath);
    return rows.map((row) => ({
      trackingNo: row.trackingNo || row['运单号'] || '',
      refusedAt: row.refusedAt || row['拒收时间'] || '',
      reason: row.reason || row['拒收原因'] || '',
      operator: row.operator || row['操作员'] || '',
      batchId: row.batchId || row['批次号'] || '',
    }));
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}

export function parseClaimRecords(filePath: string): ClaimRecord[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.json') {
    const data = parseJSON<ClaimRecord[]>(filePath);
    return data;
  }
  
  if (ext === '.csv') {
    const rows = parseCSV(filePath);
    return rows.map((row) => ({
      claimId: row.claimId || row['赔付单号'] || '',
      trackingNo: row.trackingNo || row['运单号'] || '',
      amount: parseFloat(row.amount || row['赔付金额'] || '0'),
      appliedAt: row.appliedAt || row['申请时间'] || '',
      approvedAt: row.approvedAt || row['批准时间'] || undefined,
      status: (row.status || row['状态'] || 'pending') as ClaimRecord['status'],
      reason: row.reason || row['赔付原因'] || '',
      batchId: row.batchId || row['批次号'] || '',
    }));
  }
  
  throw new Error(`不支持的文件格式: ${ext}`);
}
