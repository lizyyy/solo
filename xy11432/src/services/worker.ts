import { getPendingItems, getRetryableItems, markAsProcessing, markForRetry, updateQueueStatus } from './queue';
import { moveToDeadLetter } from './deadLetter';
import { logInfo, logError } from './logger';
import { QueueStatus } from '../types';

export interface ProcessingResult {
  success: boolean;
  error?: Error;
  resultData?: any;
}

export type ProcessItemCallback = (queueItem: any, record: any) => Promise<ProcessingResult>;

export class QueueWorker {
  private isRunning: boolean = false;
  private processCallback: ProcessItemCallback | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private batchSize: number = 10;
  private pollInterval: number = 5000;

  constructor(options?: { batchSize?: number; pollInterval?: number }) {
    this.batchSize = options?.batchSize || 10;
    this.pollInterval = options?.pollInterval || 5000;
  }

  setProcessCallback(callback: ProcessItemCallback): void {
    this.processCallback = callback;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logInfo('Queue worker started', { batchSize: this.batchSize, pollInterval: this.pollInterval });
    
    this.processBatch();
    this.intervalId = setInterval(() => this.processBatch(), this.pollInterval);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logInfo('Queue worker stopped');
  }

  private async processBatch(): Promise<void> {
    if (!this.isRunning) return;
    
    try {
      const pendingItems = getPendingItems(this.batchSize);
      const retryableItems = getRetryableItems(this.batchSize);
      const allItems = [...pendingItems, ...retryableItems].slice(0, this.batchSize);
      
      if (allItems.length === 0) return;
      
      logInfo(`Processing batch of ${allItems.length} items`);
      
      for (const item of allItems) {
        await this.processItem(item);
      }
    } catch (error) {
      logError('Error in worker batch processing', error as Error);
    }
  }

  private async processItem(queueItem: any): Promise<void> {
    try {
      markAsProcessing(queueItem.id, 'system_worker');
      
      if (this.processCallback) {
        const record = this.getRecordData(queueItem);
        const result = await this.processCallback(queueItem, record);
        
        if (result.success) {
          updateQueueStatus(queueItem.id, QueueStatus.SUCCESS, 'system_worker', {
            comment: 'Processed successfully by worker',
          });
        } else {
          this.handleProcessingError(queueItem, result.error || new Error('Processing failed'));
        }
      } else {
        this.handleProcessingError(queueItem, new Error('No process callback defined'));
      }
    } catch (error) {
      logError(`Error processing queue item ${queueItem.id}`, error as Error);
      this.handleProcessingError(queueItem, error as Error);
    }
  }

  private handleProcessingError(queueItem: any, error: Error): void {
    const newRetryCount = queueItem.retry_count + 1;
    
    if (newRetryCount >= queueItem.max_retries) {
      moveToDeadLetter(queueItem.id, 'system_worker', `Max retries exceeded: ${error.message}`);
    } else {
      markForRetry(queueItem.id, 'system_worker', error);
    }
  }

  private getRecordData(queueItem: any): any {
    return {
      id: queueItem.record_id,
      sourceType: queueItem.source_type,
      batchId: queueItem.batch_id,
    };
  }
}

export const defaultWorker = new QueueWorker();
