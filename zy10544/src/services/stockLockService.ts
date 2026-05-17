import { dataStore } from '../store';
import {
  ActivityStockLock,
  ReleaseRecord,
  ExceptionDetail,
  ReleaseReport,
  ReportDetail,
  LockStatus,
  ReleaseCondition,
  ExceptionType,
  CreateLockRequest,
  QueryLocksRequest,
  AdvanceStatusRequest,
  ManualCorrectionRequest,
  ResolveExceptionRequest,
} from '../types';

export class StockLockService {
  async createLocks(request: CreateLockRequest): Promise<{
    success: boolean;
    locks: ActivityStockLock[];
    exceptions: ExceptionDetail[];
  }> {
    const exceptions: ExceptionDetail[] = [];
    const locks: ActivityStockLock[] = [];
    const now = new Date();

    for (const skuItem of request.skuItems) {
      if (!dataStore.validateSkuExists(skuItem.sku)) {
        exceptions.push(
          this.createException(
            request.activityId,
            skuItem.sku,
            ExceptionType.SKU_NOT_FOUND,
            `SKU ${skuItem.sku} 不存在`,
            request,
            'SKU 有效性校验失败'
          )
        );
        continue;
      }

      if (skuItem.quantity <= 0) {
        exceptions.push(
          this.createException(
            request.activityId,
            skuItem.sku,
            ExceptionType.INSUFFICIENT_STOCK,
            `SKU ${skuItem.sku} 锁定数量必须大于0`,
            request,
            '锁定数量校验失败'
          )
        );
        continue;
      }

      const lock: ActivityStockLock = {
        id: dataStore.generateId(),
        activityId: request.activityId,
        sku: skuItem.sku,
        skuName: skuItem.skuName,
        lockQuantity: skuItem.quantity,
        releasedQuantity: 0,
        status: LockStatus.LOCKED,
        releaseCondition: request.releaseCondition,
        operator: request.operator,
        createdAt: now,
        updatedAt: now,
        lockTime: now,
        expectedReleaseTime: request.expectedReleaseTime
          ? new Date(request.expectedReleaseTime)
          : undefined,
      };

      dataStore.saveLock(lock);
      locks.push(lock);
    }

    return { success: exceptions.length === 0, locks, exceptions };
  }

  async queryLocks(request: QueryLocksRequest): Promise<{
    data: ActivityStockLock[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    let locks = dataStore.getAllLocks();

    if (request.activityId) {
      locks = locks.filter((l) => l.activityId === request.activityId);
    }
    if (request.sku) {
      locks = locks.filter((l) => l.sku.includes(request.sku!));
    }
    if (request.status) {
      locks = locks.filter((l) => l.status === request.status);
    }

    const page = request.page || 1;
    const pageSize = request.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const paginatedLocks = locks.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedLocks,
      total: locks.length,
      page,
      pageSize,
    };
  }

  async advanceStatus(request: AdvanceStatusRequest): Promise<{
    success: boolean;
    processed: number;
    skipped: number;
    exceptions: ExceptionDetail[];
  }> {
    const idempotentResult = dataStore.getIdempotentResult(request.requestId);
    if (idempotentResult) {
      return {
        success: true,
        processed: 0,
        skipped: 1,
        exceptions: [],
      };
    }

    const exceptions: ExceptionDetail[] = [];
    let processed = 0;
    const now = new Date();

    let locks: ActivityStockLock[];
    if (request.skus && request.skus.length > 0) {
      locks = dataStore.getLocksByActivityAndSkus(request.activityId, request.skus);
    } else {
      locks = dataStore.getLocksByActivity(request.activityId);
    }

    for (const lock of locks) {
      if (lock.status === LockStatus.RELEASED) {
        continue;
      }

      if (
        lock.status !== LockStatus.LOCKED &&
        lock.status !== LockStatus.PARTIALLY_RELEASED
      ) {
        exceptions.push(
          this.createException(
            lock.activityId,
            lock.sku,
            ExceptionType.INVALID_STATUS,
            `SKU ${lock.sku} 当前状态 ${lock.status} 不允许释放`,
            request,
            `仅 LOCKED 或 PARTIALLY_RELEASED 状态可释放，当前状态: ${lock.status}`,
            lock.id
          )
        );
        continue;
      }

      const quantityToRelease = lock.lockQuantity - lock.releasedQuantity;

      const releaseRecord: ReleaseRecord = {
        id: dataStore.generateId(),
        lockId: lock.id,
        activityId: lock.activityId,
        sku: lock.sku,
        releaseQuantity: quantityToRelease,
        releasedBy: request.operator,
        releasedAt: now,
        releaseCondition: request.releaseCondition,
        isIdempotent: false,
        requestId: request.requestId,
      };

      dataStore.saveReleaseRecord(releaseRecord);

      lock.releasedQuantity += quantityToRelease;
      lock.status = LockStatus.RELEASED;
      lock.updatedAt = now;
      dataStore.saveLock(lock);

      processed++;
    }

    dataStore.saveIdempotentResult(request.requestId, request.activityId);

    return {
      success: exceptions.length === 0,
      processed,
      skipped: locks.length - processed,
      exceptions,
    };
  }

  async manualCorrection(request: ManualCorrectionRequest): Promise<{
    success: boolean;
    lock?: ActivityStockLock;
    exception?: ExceptionDetail;
  }> {
    const lock = dataStore.getLock(request.lockId);
    if (!lock) {
      return {
        success: false,
        exception: this.createException(
          'UNKNOWN',
          undefined,
          ExceptionType.SKU_NOT_FOUND,
          `锁定记录 ${request.lockId} 不存在`,
          request,
          '锁定记录不存在'
        ),
      };
    }

    const now = new Date();

    if (request.newStatus) {
      lock.status = request.newStatus;
    }

    if (request.adjustQuantity !== undefined) {
      lock.releasedQuantity = Math.max(
        0,
        Math.min(lock.lockQuantity, request.adjustQuantity)
      );

      if (lock.releasedQuantity === lock.lockQuantity) {
        lock.status = LockStatus.RELEASED;
      } else if (lock.releasedQuantity > 0) {
        lock.status = LockStatus.PARTIALLY_RELEASED;
      } else {
        lock.status = LockStatus.LOCKED;
      }
    }

    lock.updatedAt = now;
    dataStore.saveLock(lock);

    const correctionException: ExceptionDetail = {
      id: dataStore.generateId(),
      lockId: lock.id,
      activityId: lock.activityId,
      sku: lock.sku,
      exceptionType: ExceptionType.SYSTEM_ERROR,
      errorMessage: `人工修正: ${request.correctionReason}`,
      originalInput: request as any,
      processingBasis: `人工操作，操作人: ${request.operator}`,
      operator: request.operator,
      createdAt: now,
      resolved: true,
      resolvedAt: now,
      resolvedBy: request.operator,
      resolution: request.correctionReason,
    };
    dataStore.saveException(correctionException);

    return { success: true, lock };
  }

  async resolveException(request: ResolveExceptionRequest): Promise<{
    success: boolean;
    exception?: ExceptionDetail;
  }> {
    const exception = dataStore.getException(request.exceptionId);
    if (!exception) {
      return { success: false };
    }

    exception.resolved = true;
    exception.resolvedAt = new Date();
    exception.resolvedBy = request.operator;
    exception.resolution = request.resolution;

    dataStore.saveException(exception);

    return { success: true, exception };
  }

  async queryExceptions(activityId?: string): Promise<ExceptionDetail[]> {
    if (activityId) {
      return dataStore.getExceptionsByActivity(activityId);
    }
    return dataStore.getAllExceptions();
  }

  async generateReport(activityId: string, operator?: string): Promise<ReleaseReport> {
    const locks = dataStore.getLocksByActivity(activityId);
    const now = new Date();

    const details: ReportDetail[] = locks.map((lock) => ({
      sku: lock.sku,
      skuName: lock.skuName,
      lockQuantity: lock.lockQuantity,
      releasedQuantity: lock.releasedQuantity,
      status: this.getStatusDescription(lock.status),
      lastReleaseTime: lock.updatedAt,
    }));

    const report: ReleaseReport = {
      id: dataStore.generateId(),
      reportId: `RPT-${activityId}-${now.getTime()}`,
      activityId,
      generatedAt: now,
      generatedBy: operator,
      totalSkus: locks.length,
      totalLockedQuantity: locks.reduce((sum, l) => sum + l.lockQuantity, 0),
      totalReleasedQuantity: locks.reduce((sum, l) => sum + l.releasedQuantity, 0),
      successCount: locks.filter((l) => l.status === LockStatus.RELEASED).length,
      failedCount: locks.filter((l) => l.status === LockStatus.FAILED).length,
      pendingCount: locks.filter(
        (l) =>
          l.status === LockStatus.LOCKED || l.status === LockStatus.PARTIALLY_RELEASED
      ).length,
      details,
    };

    dataStore.saveReport(report);
    return report;
  }

  async getReports(activityId?: string): Promise<ReleaseReport[]> {
    if (activityId) {
      return dataStore.getReportsByActivity(activityId);
    }
    return dataStore.getAllReports();
  }

  private createException(
    activityId: string,
    sku: string | undefined,
    exceptionType: ExceptionType,
    errorMessage: string,
    originalInput: any,
    processingBasis: string,
    lockId?: string
  ): ExceptionDetail {
    const exception: ExceptionDetail = {
      id: dataStore.generateId(),
      lockId,
      activityId,
      sku,
      exceptionType,
      errorMessage,
      originalInput: { ...originalInput },
      processingBasis,
      createdAt: new Date(),
      resolved: false,
    };
    dataStore.saveException(exception);
    return exception;
  }

  private getStatusDescription(status: LockStatus): string {
    const descriptions: Record<LockStatus, string> = {
      [LockStatus.LOCKED]: '已锁定 - 库存已锁定，等待释放条件触发',
      [LockStatus.RELEASING]: '释放中 - 正在执行库存释放操作',
      [LockStatus.PARTIALLY_RELEASED]: '部分释放 - 部分库存已释放',
      [LockStatus.RELEASED]: '已释放 - 全部库存已成功释放',
      [LockStatus.FAILED]: '失败 - 库存释放失败',
    };
    return descriptions[status] || status;
  }
}

export const stockLockService = new StockLockService();
