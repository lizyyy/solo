import { 
  Batch, 
  BatchId, 
  BatchStatus, 
  Disbursement, 
  DisbursementStatus,
  BatchProgress,
  ReconciliationResult,
  PerformanceStats
} from '../types';
import { batchRepository } from '../repositories/BatchRepository';
import { disbursementRepository } from '../repositories/DisbursementRepository';
import { payrollRepository } from '../repositories/PayrollRepository';
import { ConcurrencyPool } from './ConcurrencyPool';
import { RateLimiter } from './RateLimiter';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
  errorCode?: string;
}

export interface PaymentGateway {
  processPayment(
    amount: number,
    bankAccountNumber: string,
    bankAccountName: string,
    bankName: string,
    idempotencyKey: string
  ): Promise<PaymentResult>;
}

class MockPaymentGateway implements PaymentGateway {
  private failureRate: number;
  private delayMs: number;

  constructor(failureRate: number = 0.05, delayMs: number = 100) {
    this.failureRate = failureRate;
    this.delayMs = delayMs;
  }

  async processPayment(
    _amount: number,
    _bankAccountNumber: string,
    _bankAccountName: string,
    _bankName: string,
    _idempotencyKey: string
  ): Promise<PaymentResult> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));

    if (Math.random() < this.failureRate) {
      const errors = [
        { message: 'Insufficient funds in source account', code: 'INSUFFICIENT_FUNDS' },
        { message: 'Bank account validation failed', code: 'ACCOUNT_VALIDATION_FAILED' },
        { message: 'Network timeout during transfer', code: 'NETWORK_TIMEOUT' },
        { message: 'Daily transfer limit exceeded', code: 'LIMIT_EXCEEDED' },
        { message: 'Account temporarily frozen', code: 'ACCOUNT_FROZEN' }
      ];
      const error = errors[Math.floor(Math.random() * errors.length)];
      if (error) {
        return {
          success: false,
          errorMessage: error.message,
          errorCode: error.code
        };
      }
      return {
        success: false,
        errorMessage: 'Unknown error',
        errorCode: 'UNKNOWN_ERROR'
      };
    }

    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    return {
      success: true,
      transactionId
    };
  }
}

export class BatchProcessor extends EventEmitter {
  private activeBatches: Map<BatchId, {
    isRunning: boolean;
    shouldPause: boolean;
    pool: ConcurrencyPool;
    rateLimiter: RateLimiter;
  }>;
  private paymentGateway: PaymentGateway;
  private processingTimes: number[];
  private processedCount: number;

  constructor(paymentGateway?: PaymentGateway) {
    super();
    this.activeBatches = new Map();
    this.paymentGateway = paymentGateway || new MockPaymentGateway();
    this.processingTimes = [];
    this.processedCount = 0;
  }

  public async createBatch(
    name: string,
    year: number,
    month: number,
    options?: {
      description?: string;
      concurrency?: number;
      rateLimit?: number;
      chunkSize?: number;
    }
  ): Promise<Batch> {
    logger.info('Creating new batch', { name, year, month });

    const payrolls = await payrollRepository.findByMonth(year, month);
    
    if (payrolls.length === 0) {
      throw new Error(`No payrolls found for ${year}-${month}`);
    }

    const totalAmount = payrolls.reduce((sum, p) => sum + p.netSalary, 0);

    const batchData: {
      name: string;
      description?: string;
      year: number;
      month: number;
      totalRecords: number;
      totalAmount: number;
      concurrency?: number;
      rateLimit?: number;
      chunkSize?: number;
    } = {
      name,
      year,
      month,
      totalRecords: payrolls.length,
      totalAmount
    };

    if (options?.description !== undefined) {
      batchData.description = options.description;
    }
    if (options?.concurrency !== undefined) {
      batchData.concurrency = options.concurrency;
    }
    if (options?.rateLimit !== undefined) {
      batchData.rateLimit = options.rateLimit;
    }
    if (options?.chunkSize !== undefined) {
      batchData.chunkSize = options.chunkSize;
    }

    const batch = await batchRepository.create(batchData);

    const disbursementsData = payrolls.map(p => ({
      batchId: batch.id,
      payrollId: p.id,
      employeeId: p.employeeId,
      amount: p.netSalary
    }));

    await disbursementRepository.bulkCreate(disbursementsData);

    logger.info('Batch created successfully', { 
      batchId: batch.id, 
      totalRecords: batch.totalRecords,
      totalAmount: batch.totalAmount
    });

    return batch;
  }

  public async startBatch(batchId: BatchId): Promise<void> {
    const batch = await batchRepository.findById(batchId);
    
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (batch.status === BatchStatus.RUNNING) {
      logger.warn('Batch is already running', { batchId });
      return;
    }

    if (batch.status === BatchStatus.COMPLETED) {
      throw new Error('Cannot start a completed batch');
    }

    if (batch.status === BatchStatus.CANCELLED) {
      throw new Error('Cannot start a cancelled batch');
    }

    const existing = this.activeBatches.get(batchId);
    if (existing?.isRunning) {
      logger.warn('Batch is already active', { batchId });
      return;
    }

    const pool = new ConcurrencyPool(batch.concurrency);
    const rateLimiter = new RateLimiter(batch.rateLimit);

    this.activeBatches.set(batchId, {
      isRunning: true,
      shouldPause: false,
      pool,
      rateLimiter
    });

    await batchRepository.updateStatus(batchId, BatchStatus.RUNNING);
    
    this.emit('batchStarted', { batchId });
    logger.info('Batch started', { batchId });

    this.processBatch(batchId).catch(error => {
      logger.error('Batch processing failed', { batchId, error: error.message });
      this.handleBatchFailure(batchId, error).catch(() => {});
    });
  }

  private async processBatch(batchId: BatchId): Promise<void> {
    const activeState = this.activeBatches.get(batchId);
    if (!activeState) {
      return;
    }

    const batch = await batchRepository.findById(batchId);
    if (!batch) {
      return;
    }

    let disbursements = await disbursementRepository.findByBatchIdAndStatus(
      batchId,
      DisbursementStatus.PENDING
    );

    logger.info('Starting to process disbursements', { 
      batchId, 
      pendingCount: disbursements.length 
    });

    const chunkSize = batch.chunkSize;
    const totalChunks = Math.ceil(disbursements.length / chunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (activeState.shouldPause) {
        logger.info('Pausing batch processing', { batchId, chunkIndex });
        await batchRepository.updateStatus(batchId, BatchStatus.PAUSED);
        this.emit('batchPaused', { batchId });
        
        while (activeState.shouldPause) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const currentBatch = await batchRepository.findById(batchId);
          if (currentBatch?.status !== BatchStatus.PAUSED && !activeState.shouldPause) {
            break;
          }
        }
        
        if (!activeState.isRunning) {
          return;
        }
      }

      const chunk = disbursements.slice(
        chunkIndex * chunkSize,
        (chunkIndex + 1) * chunkSize
      );

      logger.debug('Processing chunk', { 
        batchId, 
        chunkIndex: chunkIndex + 1, 
        totalChunks,
        chunkSize: chunk.length
      });

      const promises = chunk.map(disbursement => 
        activeState.pool.submit(async () => {
          const startTime = Date.now();
          
          try {
            await activeState.rateLimiter.acquire();
            await this.processSingleDisbursement(batchId, disbursement);
            
            const processingTime = Date.now() - startTime;
            this.recordProcessingTime(processingTime);
            
          } catch (error) {
            logger.error('Error processing disbursement', {
              disbursementId: disbursement.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        })
      );

      await Promise.all(promises);

      const currentBatch = await batchRepository.findById(batchId);
      if (currentBatch?.status === BatchStatus.CANCELLED) {
        logger.info('Batch cancelled, stopping processing', { batchId });
        return;
      }

      this.emit('chunkCompleted', { 
        batchId, 
        chunkIndex: chunkIndex + 1, 
        totalChunks 
      });
    }

    const finalBatch = await batchRepository.findById(batchId);
    if (finalBatch && finalBatch.processedRecords >= finalBatch.totalRecords) {
      await batchRepository.updateStatus(batchId, BatchStatus.COMPLETED);
      this.emit('batchCompleted', { batchId });
      logger.info('Batch completed successfully', { batchId });
    }

    activeState.isRunning = false;
    this.activeBatches.delete(batchId);
  }

  private async processSingleDisbursement(
    batchId: BatchId,
    disbursement: Disbursement
  ): Promise<void> {
    const { employeeRepository } = await import('../repositories/EmployeeRepository');
    
    await disbursementRepository.markAsProcessing(disbursement.id);

    const employee = await employeeRepository.findById(disbursement.employeeId);
    
    if (!employee) {
      await disbursementRepository.markAsFailed(
        disbursement.id,
        'Employee not found',
        'EMPLOYEE_NOT_FOUND'
      );
      await batchRepository.incrementProgress(batchId, false);
      return;
    }

    try {
      const result = await this.paymentGateway.processPayment(
        disbursement.amount,
        employee.bankAccountNumber,
        employee.bankAccountName,
        employee.bankName,
        disbursement.idempotencyKey
      );

      if (result.success) {
        await disbursementRepository.markAsSuccess(
          disbursement.id,
          result.transactionId
        );
        await batchRepository.incrementProgress(batchId, true);
        logger.debug('Disbursement successful', {
          disbursementId: disbursement.id,
          transactionId: result.transactionId
        });
      } else {
        await disbursementRepository.markAsFailed(
          disbursement.id,
          result.errorMessage || 'Payment failed',
          result.errorCode
        );
        await batchRepository.incrementProgress(batchId, false);
        logger.warn('Disbursement failed', {
          disbursementId: disbursement.id,
          error: result.errorMessage,
          errorCode: result.errorCode
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await disbursementRepository.markAsFailed(
        disbursement.id,
        errorMessage,
        'PROCESSING_EXCEPTION'
      );
      await batchRepository.incrementProgress(batchId, false);
      
      logger.error('Disbursement processing exception', {
        disbursementId: disbursement.id,
        error: errorMessage
      });
    }
  }

  public async pauseBatch(batchId: BatchId): Promise<void> {
    const activeState = this.activeBatches.get(batchId);
    
    if (!activeState) {
      const batch = await batchRepository.findById(batchId);
      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }
      if (batch.status !== BatchStatus.RUNNING) {
        throw new Error('Batch is not running');
      }
    }

    if (activeState) {
      activeState.shouldPause = true;
    }

    logger.info('Pausing batch', { batchId });
  }

  public async resumeBatch(batchId: BatchId): Promise<void> {
    const batch = await batchRepository.findById(batchId);
    
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (batch.status !== BatchStatus.PAUSED) {
      throw new Error('Batch is not paused');
    }

    const activeState = this.activeBatches.get(batchId);
    if (activeState) {
      activeState.shouldPause = false;
      await batchRepository.updateStatus(batchId, BatchStatus.RUNNING);
      this.emit('batchResumed', { batchId });
      logger.info('Batch resumed', { batchId });
    } else {
      await this.startBatch(batchId);
    }
  }

  public async cancelBatch(batchId: BatchId): Promise<void> {
    const activeState = this.activeBatches.get(batchId);
    
    if (activeState) {
      activeState.isRunning = false;
      activeState.shouldPause = true;
      this.activeBatches.delete(batchId);
    }

    await batchRepository.updateStatus(batchId, BatchStatus.CANCELLED);
    this.emit('batchCancelled', { batchId });
    logger.info('Batch cancelled', { batchId });
  }

  public async getBatchProgress(batchId: BatchId): Promise<BatchProgress> {
    const batch = await batchRepository.findById(batchId);
    
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const totalChunks = Math.ceil(batch.totalRecords / batch.chunkSize);
    const currentChunk = Math.ceil(batch.processedRecords / batch.chunkSize);

    const progressPercentage = batch.totalRecords > 0 
      ? (batch.processedRecords / batch.totalRecords) * 100 
      : 0;

    let estimatedTimeRemaining: number | null = null;
    if (batch.status === BatchStatus.RUNNING && batch.processedRecords > 0 && batch.startedAt) {
      const elapsed = Date.now() - batch.startedAt.getTime();
      const timePerRecord = elapsed / batch.processedRecords;
      const remainingRecords = batch.totalRecords - batch.processedRecords;
      estimatedTimeRemaining = Math.ceil(remainingRecords * timePerRecord);
    }

    return {
      batchId: batch.id,
      status: batch.status,
      totalRecords: batch.totalRecords,
      processedRecords: batch.processedRecords,
      successRecords: batch.successRecords,
      failedRecords: batch.failedRecords,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      estimatedTimeRemaining,
      currentChunk: Math.min(currentChunk, totalChunks),
      totalChunks
    };
  }

  public async retryFailedDisbursements(batchId: BatchId): Promise<{ retried: number; failed: number }> {
    const batch = await batchRepository.findById(batchId);
    
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    if (batch.status === BatchStatus.RUNNING) {
      throw new Error('Cannot retry while batch is running');
    }

    const failedDisbursements = await disbursementRepository.findFailedByBatchId(batchId);
    
    if (failedDisbursements.length === 0) {
      return { retried: 0, failed: 0 };
    }

    logger.info('Retrying failed disbursements', { 
      batchId, 
      count: failedDisbursements.length 
    });

    const pool = new ConcurrencyPool(batch.concurrency);
    const rateLimiter = new RateLimiter(batch.rateLimit);
    let retried = 0;
    let failed = 0;

    const promises = failedDisbursements.map(disbursement =>
      pool.submit(async () => {
        try {
          await disbursementRepository.prepareForRetry(disbursement.id);
          await rateLimiter.acquire();
          await this.processSingleDisbursement(batchId, disbursement);
          retried++;
        } catch (error) {
          failed++;
          logger.error('Retry failed', {
            disbursementId: disbursement.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })
    );

    await Promise.all(promises);

    return { retried, failed };
  }

  public async reconcileBatch(batchId: BatchId): Promise<ReconciliationResult> {
    const batch = await batchRepository.findById(batchId);
    
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const expectedAmount = batch.totalAmount;
    const expectedCount = batch.totalRecords;

    const successAmount = await disbursementRepository.sumAmountByBatchIdAndStatus(
      batchId,
      DisbursementStatus.SUCCESS
    );
    const successCount = await disbursementRepository.countByBatchIdAndStatus(
      batchId,
      DisbursementStatus.SUCCESS
    );

    const failedAmount = await disbursementRepository.sumAmountByBatchIdAndStatus(
      batchId,
      DisbursementStatus.FAILED
    );
    const failedCount = await disbursementRepository.countByBatchIdAndStatus(
      batchId,
      DisbursementStatus.FAILED
    );

    const cancelledCount = await disbursementRepository.countByBatchIdAndStatus(
      batchId,
      DisbursementStatus.CANCELLED
    );

    const discrepancies: ReconciliationResult['discrepancies'] = [];

    const actualTotal = successAmount + failedAmount;
    if (Math.abs(actualTotal - expectedAmount) > 0.01) {
      discrepancies.push({
        type: 'amount',
        description: `Amount mismatch: expected ${expectedAmount.toFixed(2)}, actual ${actualTotal.toFixed(2)}`,
        affectedRecords: expectedCount - (successCount + failedCount + cancelledCount)
      });
    }

    const actualCount = successCount + failedCount + cancelledCount;
    if (actualCount !== expectedCount) {
      discrepancies.push({
        type: 'count',
        description: `Count mismatch: expected ${expectedCount}, actual ${actualCount}`
      });
    }

    if (batch.status === BatchStatus.COMPLETED && failedCount > 0) {
      discrepancies.push({
        type: 'status',
        description: `Batch marked as completed but has ${failedCount} failed disbursements`,
        affectedRecords: failedCount
      });
    }

    return {
      batchId: batch.id,
      expectedAmount,
      actualAmount: successAmount,
      expectedCount,
      actualCount: successCount,
      discrepancies,
      isBalanced: discrepancies.length === 0
    };
  }

  public async getPerformanceStats(): Promise<PerformanceStats> {
    const totalBatches = await batchRepository.count();
    const totalDisbursements = await disbursementRepository.count();

    const successCount = await disbursementRepository.countByBatchIdAndStatus(
      '' as BatchId,
      DisbursementStatus.SUCCESS
    );

    const successRate = totalDisbursements > 0 
      ? (successCount / totalDisbursements) * 100 
      : 0;

    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return {
      totalBatches,
      totalDisbursements,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(avgProcessingTime),
      throughput: this.processedCount > 0 
        ? Math.round(this.processedCount / Math.max(1, this.processingTimes.length))
        : 0,
      last24Hours: {
        batches: 0,
        disbursements: 0,
        successRate: 0
      }
    };
  }

  private async handleBatchFailure(batchId: BatchId, error: Error): Promise<void> {
    try {
      await batchRepository.updateStatus(batchId, BatchStatus.FAILED);
      this.emit('batchFailed', { batchId, error: error.message });
      logger.error('Batch failed', { batchId, error: error.message });
    } catch (updateError) {
      logger.error('Failed to update batch status after failure', {
        batchId,
        error: updateError instanceof Error ? updateError.message : 'Unknown error'
      });
    }
  }

  private recordProcessingTime(timeMs: number): void {
    this.processedCount++;
    this.processingTimes.push(timeMs);
    
    if (this.processingTimes.length > 10000) {
      this.processingTimes = this.processingTimes.slice(-5000);
    }
  }

  public getActiveBatches(): BatchId[] {
    return Array.from(this.activeBatches.keys());
  }

  public isBatchActive(batchId: BatchId): boolean {
    const activeState = this.activeBatches.get(batchId);
    return activeState?.isRunning ?? false;
  }
}

export const batchProcessor = new BatchProcessor();
