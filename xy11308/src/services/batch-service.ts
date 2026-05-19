import { QueryRunner } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { BatchOperation, BatchOperationType, BatchOperationStatus, SuccessItemResult, FailureItemResult } from '../entities/BatchOperation';
import { AuditContext } from './audit-service';

export interface BatchItem<T> {
  index: number;
  data: T;
}

export interface BatchResult<T> {
  operationId: string;
  status: BatchOperationStatus;
  totalItems: number;
  successCount: number;
  failureCount: number;
  successItems: SuccessItemResult[];
  failureItems: FailureItemResult[];
  errorSummary?: string;
}

export interface BatchProcessor<T> {
  validateItem(item: T, index: number): Promise<void>;
  processItem(item: T, index: number, queryRunner: QueryRunner): Promise<any>;
}

export class BatchService {
  private static get repository() {
    return AppDataSource.getRepository(BatchOperation);
  }

  static async execute<T>(
    type: BatchOperationType,
    items: T[],
    processor: BatchProcessor<T>,
    context: AuditContext,
    retryFailedItems?: string
  ): Promise<BatchResult<T>> {
    const successItems: SuccessItemResult[] = [];
    const failureItems: FailureItemResult[] = [];

    let operation: BatchOperation;

    if (retryFailedItems) {
      const existingOp = await this.repository.findOneBy({ id: retryFailedItems });
      if (!existingOp) {
        throw new Error('批量操作记录不存在');
      }
      operation = existingOp;
    } else {
      operation = this.repository.create({
        type,
        totalItems: items.length,
        operatedBy: context.operator,
        operatedByRole: context.operatorRole
      });
      operation = await this.repository.save(operation);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await processor.validateItem(item, i);
        const result = await processor.processItem(item, i, queryRunner);
        await queryRunner.commitTransaction();

        successItems.push({
          index: i,
          itemId: result?.id,
          data: item
        });
      } catch (error: any) {
        await queryRunner.rollbackTransaction();

        failureItems.push({
          index: i,
          error: error.message || '未知错误',
          data: item
        });
      } finally {
        await queryRunner.release();
      }
    }

    operation.successCount = successItems.length;
    operation.failureCount = failureItems.length;
    operation.setSuccessItems(successItems);
    operation.setFailureItems(failureItems);

    if (failureItems.length === 0) {
      operation.status = BatchOperationStatus.COMPLETED;
    } else if (successItems.length === 0) {
      operation.status = BatchOperationStatus.FAILED;
    } else {
      operation.status = BatchOperationStatus.PARTIALLY_COMPLETED;
    }

    if (failureItems.length > 0) {
      operation.errorSummary = `共${failureItems.length}项失败：${failureItems.slice(0, 3).map(f => f.error).join('；')}${failureItems.length > 3 ? '...' : ''}`;
    }

    await this.repository.save(operation);

    return {
      operationId: operation.id,
      status: operation.status,
      totalItems: operation.totalItems,
      successCount: operation.successCount,
      failureCount: operation.failureCount,
      successItems,
      failureItems,
      errorSummary: operation.errorSummary
    };
  }

  static async retryBatch(
    operationId: string,
    processor: BatchProcessor<any>,
    context: AuditContext
  ): Promise<BatchResult<any>> {
    const operation = await this.repository.findOneBy({ id: operationId });
    if (!operation) {
      throw new Error('批量操作记录不存在');
    }

    const failureItems = operation.getFailureItems();
    if (failureItems.length === 0) {
      throw new Error('没有需要重试的失败项');
    }

    const itemsToRetry = failureItems.map(f => f.data);
    return this.execute(operation.type, itemsToRetry, processor, context, operationId);
  }

  static async getOperation(operationId: string): Promise<BatchOperation | null> {
    return await this.repository.findOneBy({ id: operationId });
  }

  static async getOperations(filters: {
    type?: BatchOperationType;
    status?: BatchOperationStatus;
    operatedBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<BatchOperation[]> {
    const query = this.repository.createQueryBuilder('op');

    if (filters.type) {
      query.andWhere('op.type = :type', { type: filters.type });
    }
    if (filters.status) {
      query.andWhere('op.status = :status', { status: filters.status });
    }
    if (filters.operatedBy) {
      query.andWhere('op.operatedBy LIKE :operatedBy', { operatedBy: `%${filters.operatedBy}%` });
    }
    if (filters.startDate) {
      query.andWhere('op.startedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('op.startedAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('op.startedAt', 'DESC');
    return await query.getMany();
  }
}