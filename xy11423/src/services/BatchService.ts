import {
  BatchRepository,
  InspectionSheetRepository,
  RepairQuoteRepository,
  PhotoItemRepository,
  AbnormalPhotoRepository,
  SmsScreenshotRepository,
  AuditLogRepository,
  StatusTransitionRepository
} from '../repositories';
import {
  Batch,
  BatchStatus,
  IdempotentStrategy,
  BatchSubmitRequest,
  SubmitResult,
  SubmitError,
  AuditAction
} from '../types';
import { getDatabase, beginTransaction, commitTransaction, rollbackTransaction } from '../database';

export class BatchService {
  private get db() {
    return getDatabase();
  }
  private batchRepo = new BatchRepository();
  private inspectionRepo = new InspectionSheetRepository();
  private repairQuoteRepo = new RepairQuoteRepository();
  private photoItemRepo = new PhotoItemRepository();
  private abnormalPhotoRepo = new AbnormalPhotoRepository();
  private smsRepo = new SmsScreenshotRepository();
  private auditLogRepo = new AuditLogRepository();
  private statusTransitionRepo = new StatusTransitionRepository();

  async submitBatch(request: BatchSubmitRequest, ipAddress?: string, userAgent?: string): Promise<SubmitResult> {
    const errors: SubmitError[] = [];
    let batchId: string | null = null;
    const existingBatch = await this.batchRepo.findByBatchNo(request.batchNo);
    const isRetry = !!existingBatch;
    
    if (existingBatch) {
      if (existingBatch.frozen) {
        throw new Error(`批次 ${request.batchNo} 已冻结，无法提交`);
      }

      if (request.strategy === IdempotentStrategy.IGNORE) {
        return {
          batchId: existingBatch.id,
          batchNo: existingBatch.batchNo,
          status: existingBatch.status,
          strategyApplied: IdempotentStrategy.IGNORE,
          totalItems: 0,
          successItems: 0,
          failedItems: 0,
          errors: [],
          isRetry: true
        };
      }
    }

    let transactionStarted = false;
    try {
      await beginTransaction(this.db);
      transactionStarted = true;

      let batch: Batch;

      if (existingBatch) {
        batchId = existingBatch.id;

        switch (request.strategy) {
          case IdempotentStrategy.OVERWRITE:
            await this.clearBatchItems(existingBatch.id);
            batch = existingBatch;
            break;

          case IdempotentStrategy.APPEND:
          default:
            batch = existingBatch;
            break;
        }
      } else {
        batch = await this.batchRepo.create({
          batchNo: request.batchNo,
          vin: request.vin,
          plateNumber: request.plateNumber,
          responsiblePerson: request.responsiblePerson,
          idempotentStrategy: request.strategy,
          createdBy: request.operator
        });
        batchId = batch.id;

        await this.auditLogRepo.create({
          batchId: batch.id,
          action: AuditAction.BATCH_CREATED,
          newValue: JSON.stringify({
            batchNo: request.batchNo,
            vin: request.vin,
            plateNumber: request.plateNumber
          }),
          operator: request.operator,
          operatorRole: request.operatorRole,
          ipAddress,
          userAgent,
          remark: '创建批次'
        });

        await this.statusTransitionRepo.create({
          batchId: batch.id,
          fromStatus: null,
          toStatus: BatchStatus.DRAFT,
          reason: '批次创建',
          operator: request.operator
        });
      }

      const totalItems = 
        request.inspectionSheets.length + 
        request.repairQuotes.length + 
        request.photoItems.length + 
        request.smsScreenshots.length;

      let successItems = 0;

      for (const item of request.inspectionSheets) {
        try {
          const index = request.inspectionSheets.indexOf(item);
          this.validateInspectionSheet(item, index, errors);
          await this.inspectionRepo.create({
            batchId: batch.id,
            ...item
          });
          successItems++;
        } catch (e: any) {
          errors.push({
            type: 'inspectionSheet',
            index: request.inspectionSheets.indexOf(item),
            field: 'general',
            message: e.message,
            value: item
          });
        }
      }

      for (const item of request.repairQuotes) {
        try {
          this.validateRepairQuote(item, request.repairQuotes.indexOf(item), errors);
          await this.repairQuoteRepo.create({
            batchId: batch.id,
            ...item
          });
          successItems++;
        } catch (e: any) {
          errors.push({
            type: 'repairQuote',
            index: request.repairQuotes.indexOf(item),
            field: 'general',
            message: e.message,
            value: item
          });
        }
      }

      for (const item of request.photoItems) {
        try {
          this.validatePhotoItem(item, request.photoItems.indexOf(item), errors);
          const photoItem = await this.photoItemRepo.create({
            batchId: batch.id,
            ...item
          });

          if (item.isAbnormal && item.abnormalDesc) {
            await this.abnormalPhotoRepo.create({
              batchId: batch.id,
              photoItemId: photoItem.id,
              abnormalType: item.category,
              description: item.abnormalDesc,
              severity: 'medium',
              reportedBy: item.uploadedBy,
              reportedAt: item.uploadedAt
            });
          }
          successItems++;
        } catch (e: any) {
          errors.push({
            type: 'photoItem',
            index: request.photoItems.indexOf(item),
            field: 'general',
            message: e.message,
            value: item
          });
        }
      }

      for (const item of request.smsScreenshots) {
        try {
          this.validateSmsScreenshot(item, request.smsScreenshots.indexOf(item), errors);
          await this.smsRepo.create({
            batchId: batch.id,
            ...item
          });
          successItems++;
        } catch (e: any) {
          errors.push({
            type: 'smsScreenshot',
            index: request.smsScreenshots.indexOf(item),
            field: 'general',
            message: e.message,
            value: item
          });
        }
      }

      await this.batchRepo.incrementSubmitCount(batch.id);

      let newStatus: BatchStatus;
      let statusReason: string;
      
      if (errors.length === 0) {
        newStatus = BatchStatus.SUCCESS;
        statusReason = '全部数据提交成功';
      } else if (successItems > 0) {
        newStatus = BatchStatus.PARTIAL_SUCCESS;
        statusReason = `部分成功: ${successItems}/${totalItems} 项`;
      } else {
        newStatus = BatchStatus.FAILED;
        statusReason = '全部数据提交失败';
      }

      const oldStatus = batch.status;
      await this.batchRepo.updateStatus(batch.id, newStatus);

      await this.statusTransitionRepo.create({
        batchId: batch.id,
        fromStatus: oldStatus,
        toStatus: newStatus,
        reason: statusReason,
        operator: request.operator
      });

      await this.auditLogRepo.create({
        batchId: batch.id,
        action: isRetry ? AuditAction.BATCH_RE_SUBMITTED : AuditAction.BATCH_SUBMITTED,
        oldValue: oldStatus,
        newValue: newStatus,
        operator: request.operator,
        operatorRole: request.operatorRole,
        ipAddress,
        userAgent,
        remark: isRetry ? '重新提交批次' : '提交批次'
      });

      await commitTransaction(this.db);

      return {
        batchId: batch.id,
        batchNo: batch.batchNo,
        status: newStatus,
        strategyApplied: request.strategy,
        totalItems,
        successItems,
        failedItems: errors.length,
        errors,
        isRetry
      };
    } catch (e: any) {
      if (transactionStarted) {
        try {
          await rollbackTransaction(this.db);
        } catch (rollbackErr) {
        }
      }
      throw e;
    }
  }

  async recallBatch(batchId: string, operator: string, operatorRole: string, reason: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.frozen) {
      throw new Error('批次已冻结，无法撤回');
    }

    const oldStatus = batch.status;
    await this.batchRepo.updateStatus(batchId, BatchStatus.RECALLED);

    await this.statusTransitionRepo.create({
      batchId,
      fromStatus: oldStatus,
      toStatus: BatchStatus.RECALLED,
      reason: reason || '撤回批次',
      operator
    });

    await this.auditLogRepo.create({
      batchId,
      action: AuditAction.BATCH_RECALLED,
      oldValue: oldStatus,
      newValue: BatchStatus.RECALLED,
      operator,
      operatorRole,
      remark: reason
    });

    return (await this.batchRepo.findById(batchId))!;
  }

  async freezeBatch(batchId: string, operator: string, operatorRole: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.frozen) {
      throw new Error('批次已冻结');
    }

    const oldStatus = batch.status;
    await this.batchRepo.freeze(batchId, operator);

    await this.statusTransitionRepo.create({
      batchId,
      fromStatus: oldStatus,
      toStatus: BatchStatus.FROZEN,
      reason: '导出前冻结',
      operator
    });

    await this.auditLogRepo.create({
      batchId,
      action: AuditAction.BATCH_FROZEN,
      oldValue: oldStatus,
      newValue: BatchStatus.FROZEN,
      operator,
      operatorRole,
      remark: '冻结批次用于导出'
    });

    return (await this.batchRepo.findById(batchId))!;
  }

  async unfreezeBatch(batchId: string, operator: string, operatorRole: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (!batch.frozen) {
      throw new Error('批次未冻结');
    }

    await this.batchRepo.unfreeze(batchId);

    await this.auditLogRepo.create({
      batchId,
      action: AuditAction.BATCH_UNFROZEN,
      oldValue: BatchStatus.FROZEN,
      newValue: batch.status,
      operator,
      operatorRole,
      remark: '解冻批次'
    });

    return (await this.batchRepo.findById(batchId))!;
  }

  async manualOverride(
    abnormalPhotoId: string, operator: string, operatorRole: string, reviewResult: string): Promise<void> {
    const abnormalPhoto = await this.abnormalPhotoRepo.findById(abnormalPhotoId);
    if (!abnormalPhoto) {
      throw new Error('异常照片不存在');
    }

    const batch = await this.batchRepo.findById(abnormalPhoto.batchId);
    if (batch?.frozen) {
      throw new Error('批次已冻结，无法人工改判');
    }

    await this.abnormalPhotoRepo.review(abnormalPhotoId, operator, reviewResult);
    await this.abnormalPhotoRepo.manualOverride(abnormalPhotoId, operator);

    await this.auditLogRepo.create({
      batchId: abnormalPhoto.batchId,
      itemType: 'abnormalPhoto',
      itemId: abnormalPhotoId,
      action: AuditAction.MANUAL_JUDGMENT,
      oldValue: abnormalPhoto.reviewResult || '未审核',
      newValue: reviewResult,
      operator,
      operatorRole,
      remark: '人工改判异常照片'
    });
  }

  async getBatchDetail(batchId: string) {
    const batch = await this.batchRepo.findById(batchId);
    if (!batch) {
      return null;
    }

    return {
      batch,
      inspectionSheets: await this.inspectionRepo.findByBatchId(batchId),
      repairQuotes: await this.repairQuoteRepo.findByBatchId(batchId),
      photoItems: await this.photoItemRepo.findByBatchId(batchId),
      abnormalPhotos: await this.abnormalPhotoRepo.findByBatchId(batchId),
      smsScreenshots: await this.smsRepo.findByBatchId(batchId),
      auditLogs: await this.auditLogRepo.findByBatchId(batchId),
      statusTransitions: await this.statusTransitionRepo.findByBatchId(batchId)
    };
  }

  async getBatchesByVin(vin: string) {
    return this.batchRepo.findByVin(vin);
  }

  async getAllBatches() {
    return this.batchRepo.findAll();
  }

  private async clearBatchItems(batchId: string): Promise<void> {
    await this.abnormalPhotoRepo.deleteByBatchId(batchId);
    await this.inspectionRepo.deleteByBatchId(batchId);
    await this.repairQuoteRepo.deleteByBatchId(batchId);
    await this.photoItemRepo.deleteByBatchId(batchId);
    await this.smsRepo.deleteByBatchId(batchId);
  }

  private validateInspectionSheet(item: any, index: number, errors: SubmitError[]): void {
    if (!item.sheetNo) {
      errors.push({ type: 'inspectionSheet', index, field: 'sheetNo', message: '检测单编号不能为空', value: item.sheetNo });
    }
    if (!item.inspector) {
      errors.push({ type: 'inspectionSheet', index, field: 'inspector', message: '检测员不能为空', value: item.inspector });
    }
    if (!item.inspectionDate) {
      errors.push({ type: 'inspectionSheet', index, field: 'inspectionDate', message: '检测日期不能为空', value: item.inspectionDate });
    }
    if (!item.overallStatus) {
      errors.push({ type: 'inspectionSheet', index, field: 'overallStatus', message: '整体状态不能为空', value: item.overallStatus });
    }
  }

  private validateRepairQuote(item: any, index: number, errors: SubmitError[]): void {
    if (!item.quoteNo) {
      errors.push({ type: 'repairQuote', index, field: 'quoteNo', message: '报价单编号不能为空', value: item.quoteNo });
    }
    if (!item.workshop) {
      errors.push({ type: 'repairQuote', index, field: 'workshop', message: '维修厂不能为空', value: item.workshop });
    }
    if (item.totalAmount === undefined || item.totalAmount < 0) {
      errors.push({ type: 'repairQuote', index, field: 'totalAmount', message: '总金额必须大于等于0', value: item.totalAmount });
    }
  }

  private validatePhotoItem(item: any, index: number, errors: SubmitError[]): void {
    if (!item.photoNo) {
      errors.push({ type: 'photoItem', index, field: 'photoNo', message: '照片编号不能为空', value: item.photoNo });
    }
    if (!item.category) {
      errors.push({ type: 'photoItem', index, field: 'category', message: '照片分类不能为空', value: item.category });
    }
    if (!item.name) {
      errors.push({ type: 'photoItem', index, field: 'name', message: '照片名称不能为空', value: item.name });
    }
    if (!item.url) {
      errors.push({ type: 'photoItem', index, field: 'url', message: '照片URL不能为空', value: item.url });
    }
  }

  private validateSmsScreenshot(item: any, index: number, errors: SubmitError[]): void {
    if (!item.smsNo) {
      errors.push({ type: 'smsScreenshot', index, field: 'smsNo', message: '短信编号不能为空', value: item.smsNo });
    }
    if (!item.sender) {
      errors.push({ type: 'smsScreenshot', index, field: 'sender', message: '发送者不能为空', value: item.sender });
    }
    if (!item.content) {
      errors.push({ type: 'smsScreenshot', index, field: 'content', message: '短信内容不能为空', value: item.content });
    }
    if (!item.url) {
      errors.push({ type: 'smsScreenshot', index, field: 'url', message: '截图URL不能为空', value: item.url });
    }
  }
}
