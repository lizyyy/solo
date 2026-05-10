import { createObjectCsvWriter } from 'csv-writer';
import { getLogsByTimeRange, getFailedOperations } from './loggingService';
import { getObjectById } from './lifecycleService';
import { getThawJobsByObject } from './thawService';
import { OperationLog, ThawJob } from '../models/types';
import * as fs from 'fs';
import * as path from 'path';

const EXPORT_DIR = './exports';

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

export async function exportOperationsReport(
  startTime: string,
  endTime: string,
  userId?: string
): Promise<string> {
  const logs = await getLogsByTimeRange(startTime, endTime, userId);
  
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      let objectInfo = '';
      let thawInfo = '';
      
      if (log.objectId) {
        const obj = await getObjectById(log.objectId);
        if (obj) {
          const sizeGB = obj.size / (1024 * 1024 * 1024);
          objectInfo = `${obj.storageClass} (${sizeGB.toFixed(2)} GB)`;
        }
        
        const thawJobs = await getThawJobsByObject(log.objectId);
        if (thawJobs.length > 0) {
          thawInfo = `${thawJobs.length} 次解冻`;
        }
      }
      
      return {
        ...log,
        objectInfo,
        thawInfo
      };
    })
  );
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `operations_report_${timestamp}.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'timestamp', title: '操作时间' },
      { id: 'logId', title: '日志ID' },
      { id: 'operation', title: '操作类型' },
      { id: 'bucketName', title: '存储桶' },
      { id: 'objectKey', title: '对象键' },
      { id: 'userId', title: '操作用户' },
      { id: 'status', title: '操作状态' },
      { id: 'details', title: '操作详情' },
      { id: 'objectInfo', title: '对象信息' },
      { id: 'thawInfo', title: '解冻信息' },
      { id: 'costEstimate', title: '预估费用(USD)' }
    ]
  });
  
  await csvWriter.writeRecords(
    enrichedLogs.map(log => ({
      timestamp: log.timestamp,
      logId: log.logId,
      operation: log.operation,
      bucketName: log.bucketName || '',
      objectKey: log.objectKey || '',
      userId: log.userId,
      status: log.status,
      details: log.details,
      objectInfo: log.objectInfo,
      thawInfo: log.thawInfo,
      costEstimate: log.costEstimate || 0
    }))
  );
  
  return filepath;
}

export async function exportFailedOperationsReport(): Promise<string> {
  const logs = await getFailedOperations(1000);
  
  const enrichedLogs = await Promise.all(
    logs.map(async (log) => {
      let objectInfo = '';
      let currentStatus = '';
      
      if (log.objectId) {
        const obj = await getObjectById(log.objectId);
        if (obj) {
          objectInfo = `${obj.storageClass}, 删除保护: ${obj.deleteProtection ? '是' : '否'}`;
          currentStatus = obj.currentThawJobId ? '有解冻任务' : '无解冻任务';
        }
      }
      
      return {
        ...log,
        objectInfo,
        currentStatus
      };
    })
  );
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `failed_operations_${timestamp}.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'timestamp', title: '失败时间' },
      { id: 'logId', title: '日志ID' },
      { id: 'operation', title: '失败操作' },
      { id: 'bucketName', title: '存储桶' },
      { id: 'objectKey', title: '对象键' },
      { id: 'userId', title: '操作用户' },
      { id: 'details', title: '失败原因' },
      { id: 'objectInfo', title: '对象当前状态' },
      { id: 'currentStatus', title: '对象操作状态' },
      { id: 'requestId', title: '请求ID' }
    ]
  });
  
  await csvWriter.writeRecords(
    enrichedLogs.map(log => ({
      timestamp: log.timestamp,
      logId: log.logId,
      operation: log.operation,
      bucketName: log.bucketName || '',
      objectKey: log.objectKey || '',
      userId: log.userId,
      details: log.details,
      objectInfo: log.objectInfo,
      currentStatus: log.currentStatus,
      requestId: log.requestId
    }))
  );
  
  return filepath;
}
