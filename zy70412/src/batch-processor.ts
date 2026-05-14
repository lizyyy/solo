import { LogisticsInterception, BatchResult, BatchItem } from './types';
import { LogisticsProcessor } from './logistics-processor';
import { ResultStore } from './result-store';
import { v4 as uuidv4 } from 'uuid';

export class BatchProcessor {
  private logisticsProcessor: LogisticsProcessor;
  private resultStore: ResultStore;

  constructor(resultStore?: ResultStore) {
    this.logisticsProcessor = new LogisticsProcessor();
    this.resultStore = resultStore || new ResultStore();
  }

  preview(items: LogisticsInterception[]): BatchResult {
    const preview = this.logisticsProcessor.createPreview(items);
    
    const batchItems: BatchItem[] = items.map(item => {
      const partition = this.logisticsProcessor.derivePartition(item);
      const validation = this.logisticsProcessor.validateInterception(item, this.getReferenceSchema());
      
      return {
        id: uuidv4(),
        orderId: item.orderId,
        status: 'preview',
        schemaDiffs: validation.schemaDiffs,
        failureGroup: validation.failedPath?.split(':')[0],
        failureReason: validation.failedPath,
        lakehousePartition: partition
      };
    });

    return {
      batchId: uuidv4(),
      submittedAt: new Date().toISOString(),
      totalCount: items.length,
      successCount: preview.willSucceed,
      failedCount: preview.willFail,
      skippedCount: 0,
      items: batchItems,
      previewMode: true
    };
  }

  execute(items: LogisticsInterception[], operator: string, skipPreview: boolean = false): BatchResult {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const batchItems: BatchItem[] = [];
    const partitions = new Set<string>();
    
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const partition = this.logisticsProcessor.derivePartition(item);
      partitions.add(partition);
      
      const validation = this.logisticsProcessor.validateInterception(item, this.getReferenceSchema());
      
      const conflictCheck = this.resultStore.detectConflict(
        item.orderId,
        validation.schemaDiffs
      );

      let status: BatchItem['status'];
      let previousResultId: string | undefined;
      let conflict: boolean | undefined;
      let conflictReason: string | undefined;

      if (conflictCheck.previousResult) {
        if (conflictCheck.conflict) {
          conflict = true;
          conflictReason = conflictCheck.reason;
          status = 'failed';
          failedCount++;
        } else if (conflictCheck.canReuse) {
          previousResultId = conflictCheck.previousResult.id;
          status = 'skipped';
          skippedCount++;
        } else if (validation.valid) {
          status = 'success';
          successCount++;
        } else {
          status = 'failed';
          failedCount++;
        }
      } else if (validation.valid) {
        status = 'success';
        successCount++;
      } else {
        status = 'failed';
        failedCount++;
      }

      const batchItem: BatchItem = {
        id: uuidv4(),
        orderId: item.orderId,
        status,
        previousResultId,
        conflict,
        conflictReason,
        schemaDiffs: validation.schemaDiffs,
        failureGroup: validation.failedPath?.split(':')[0],
        failureReason: validation.failedPath,
        lakehousePartition: partition
      };

      batchItems.push(batchItem);

      if (status !== 'skipped') {
        this.resultStore.storeResult({
          batchId,
          itemId: batchItem.id,
          orderId: item.orderId,
          waybillNo: item.waybillNo,
          status: status,
          schemaDiffs: validation.schemaDiffs,
          failureReason: validation.failedPath,
          failureGroup: validation.failedPath?.split(':')[0],
          lakehousePartition: partition
        });
      }
    }

    if (partitions.size > 0) {
      const partitionList = Array.from(partitions).map(name => ({
        name,
        date: new Date().toISOString().split('T')[0],
        region: 'cn',
        recordCount: items.filter(i => 
          this.logisticsProcessor.derivePartition(i) === name
        ).length
      }));
      this.resultStore.addOrUpdatePartitions(partitionList);
    }

    return {
      batchId,
      submittedAt: now,
      totalCount: items.length,
      successCount,
      failedCount,
      skippedCount,
      items: batchItems,
      previewMode: false
    };
  }

  filterByFailureGroup(result: BatchResult, failureGroup: string): BatchItem[] {
    return this.resultStore.filterByFailure(result.items, failureGroup);
  }

  private getReferenceSchema(): any {
    return {
      status: 'intercepted',
      grayRelease: true,
      hasCompensationActions: true,
      allCompensationsExecuted: true,
      requiredCompensationsCount: 2
    };
  }
}
