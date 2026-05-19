import * as fs from 'fs';
import { storage } from './storage';
import { ruleEngine } from './rules';
import { FaultRecord, RecordStatus, FaultType, BatchOperationResult } from './types';

interface ImportRecord {
  cabinetId: string;
  faultType: string;
  description: string;
  reporter: string;
  handler?: string;
}

export function batchImport(filePath: string): BatchOperationResult {
  const successes: string[] = [];
  const failures: Array<{ recordId?: string; error: string }> = [];

  let data: ImportRecord[];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(content);
    if (!Array.isArray(data)) {
      throw new Error('数据必须是数组格式');
    }
  } catch (error: any) {
    return storage.addBatchResult({
      total: 0,
      successCount: 0,
      failureCount: 1,
      successes: [],
      failures: [{ error: `文件读取失败: ${error.message}` }]
    });
  }

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    try {
      if (!item.cabinetId || !item.faultType || !item.description || !item.reporter) {
        throw new Error(`第 ${i + 1} 条记录缺少必填字段`);
      }

      if (!Object.values(FaultType).includes(item.faultType as FaultType)) {
        throw new Error(`第 ${i + 1} 条记录故障类型无效: ${item.faultType}`);
      }

      const record = storage.addRecord({
        cabinetId: item.cabinetId,
        faultType: item.faultType as FaultType,
        description: item.description,
        reporter: item.reporter,
        handler: item.handler,
        status: RecordStatus.PENDING,
        isOffline: storage.isCabinetOffline(item.cabinetId)
      });

      const result = ruleEngine.processRecord(record);
      successes.push(record.id);
    } catch (error: any) {
      failures.push({
        error: error.message
      });
    }
  }

  return storage.addBatchResult({
    total: data.length,
    successCount: successes.length,
    failureCount: failures.length,
    successes,
    failures
  });
}

export function retryFailed(batchId: string): BatchOperationResult {
  const originalBatch = storage.getBatchResult(batchId);
  if (!originalBatch) {
    return storage.addBatchResult({
      total: 0,
      successCount: 0,
      failureCount: 1,
      successes: [],
      failures: [{ error: `未找到批次: ${batchId}` }]
    });
  }

  const successes: string[] = [];
  const failures: Array<{ recordId?: string; error: string }> = [];

  const failedRecordIds = originalBatch.failures
    .filter(f => f.recordId)
    .map(f => f.recordId!);

  for (const recordId of failedRecordIds) {
    const record = storage.getRecord(recordId);
    if (!record) {
      failures.push({ recordId, error: '记录不存在' });
      continue;
    }

    try {
      const result = ruleEngine.processRecord(record);
      if (result.overallResult === '放行') {
        successes.push(recordId);
      } else {
        failures.push({ recordId, error: result.reason });
      }
    } catch (error: any) {
      failures.push({ recordId, error: error.message });
    }
  }

  return storage.addBatchResult({
    total: failedRecordIds.length,
    successCount: successes.length,
    failureCount: failures.length,
    successes,
    failures
  });
}
