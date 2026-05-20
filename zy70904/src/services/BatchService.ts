import dataStore from '../models/DataStore';
import recordService from './RecordService';
import {
  Batch,
  BatchStatus,
  Receipt,
  Member,
  ActivityRule,
  RecordStatus,
  OperationType,
  ProcessingRecord
} from '../types';

class BatchService {
  createBatch(
    name: string,
    activityCode: string,
    storeCode: string,
    operator: string
  ): Batch {
    const batchNo = `BATCH${Date.now()}`;
    
    const batch: Batch = {
      id: dataStore.generateId(),
      batchNo,
      name,
      activityCode,
      storeCode,
      totalCount: 0,
      processedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      returnedCount: 0,
      status: BatchStatus.PROCESSING,
      createdBy: operator,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dataStore.saveBatch(batch);
    dataStore.addOperationLog({
      batchId: batch.id,
      operationType: OperationType.BATCH_CREATED,
      operator,
      reason: '创建新批次',
      detail: `批次${batchNo}创建成功，活动：${activityCode}，门店：${storeCode}`
    });

    return batch;
  }

  processBatch(
    batchId: string,
    receipts: Receipt[],
    members: Member[],
    activityRule: ActivityRule,
    operator: string
  ): { success: number; failed: number; records: ProcessingRecord[] } {
    const batch = dataStore.getBatch(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const memberMap = new Map(members.map(m => [m.memberId, m]));
    const phoneMemberMap = new Map(members.map(m => [m.phone, m]));
    const records: ProcessingRecord[] = [];
    let success = 0;
    let failed = 0;

    for (const receipt of receipts) {
      try {
        let member = memberMap.get(receipt.memberId) || phoneMemberMap.get(receipt.memberPhone);
        
        if (!member) {
          failed++;
          continue;
        }

        const record = recordService.createProcessingRecord(
          batchId,
          receipt,
          member,
          activityRule,
          operator
        );
        records.push(record);
        success++;
      } catch (error) {
        failed++;
      }
    }

    this.updateBatchStats(batchId);

    return { success, failed, records };
  }

  private updateBatchStats(batchId: string): void {
    const batch = dataStore.getBatch(batchId);
    if (!batch) return;

    const records = dataStore.getProcessingRecordsByBatch(batchId);
    
    batch.totalCount = records.length;
    batch.processedCount = records.filter(r => r.status !== RecordStatus.PENDING).length;
    batch.approvedCount = records.filter(r => r.status === RecordStatus.APPROVED).length;
    batch.rejectedCount = records.filter(r => r.status === RecordStatus.REJECTED).length;
    batch.returnedCount = records.filter(r => r.status === RecordStatus.RETURNED).length;
    
    if (batch.processedCount === batch.totalCount) {
      batch.status = BatchStatus.COMPLETED;
    }
    
    batch.updatedAt = new Date();
    dataStore.saveBatch(batch);
  }

  approveRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = recordService.approveRecord(recordId, operator, reason);
    this.updateBatchStats(record.batchId);
    return record;
  }

  rejectRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = recordService.rejectRecord(recordId, operator, reason);
    this.updateBatchStats(record.batchId);
    return record;
  }

  returnRecord(recordId: string, operator: string, reason: string): ProcessingRecord {
    const record = recordService.returnRecord(recordId, operator, reason);
    this.updateBatchStats(record.batchId);
    return record;
  }

  getBatch(batchId: string): Batch | undefined {
    return dataStore.getBatch(batchId);
  }

  getAllBatches(): Batch[] {
    return dataStore.getAllBatches();
  }

  getBatchRecords(batchId: string): ProcessingRecord[] {
    return dataStore.getProcessingRecordsByBatch(batchId);
  }

  getBatchStats(batchId: string) {
    const batch = dataStore.getBatch(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const records = dataStore.getProcessingRecordsByBatch(batchId);
    const boundaryRecords = records.filter(r => r.boundaryInfo);
    const returnRecords = records.filter(r => r.isReturn);

    return {
      batch,
      totalRecords: records.length,
      boundaryCount: boundaryRecords.length,
      returnCount: returnRecords.length,
      statusBreakdown: {
        pending: records.filter(r => r.status === RecordStatus.PENDING).length,
        approved: records.filter(r => r.status === RecordStatus.APPROVED).length,
        rejected: records.filter(r => r.status === RecordStatus.REJECTED).length,
        returned: records.filter(r => r.status === RecordStatus.RETURNED).length
      },
      totalPoints: records.reduce((sum, r) => sum + r.calculatedPoints, 0)
    };
  }
}

export default new BatchService();
