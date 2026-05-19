import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PrintBatch } from '../models/PrintBatch';
import { LabRecord } from '../models/LabRecord';
import { PaperBatch } from '../models/PaperBatch';
import { ReworkRecord, ReworkType } from '../models/ReworkRecord';
import { QualityOrder, OrderStatus } from '../models/QualityOrder';
import { AppDataSource } from '../database/data-source';
import { BatchStatus, ReviewResult, ImportResult } from '../types';
import {
  validateLabRecord,
  validateBatchStatusTransition,
  generateImportKey,
  printBatchImportSchema,
  judgmentSchema,
  reviewSchema,
  reworkSchema,
  qualityOrderSchema,
} from '../utils/validation';
import { auditService } from './AuditService';
import { AuditAction } from '../models/AuditLog';
import { logger } from '../utils/logger';

export class QualityControlService {
  private printBatchRepository: Repository<PrintBatch>;
  private labRecordRepository: Repository<LabRecord>;
  private paperBatchRepository: Repository<PaperBatch>;
  private reworkRecordRepository: Repository<ReworkRecord>;
  private qualityOrderRepository: Repository<QualityOrder>;

  constructor() {
    this.printBatchRepository = AppDataSource.getRepository(PrintBatch);
    this.labRecordRepository = AppDataSource.getRepository(LabRecord);
    this.paperBatchRepository = AppDataSource.getRepository(PaperBatch);
    this.reworkRecordRepository = AppDataSource.getRepository(ReworkRecord);
    this.qualityOrderRepository = AppDataSource.getRepository(QualityOrder);
  }

  async importBatch(batchData: any, options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<{ batch: PrintBatch; isNew: boolean }> {
    const { error, value } = printBatchImportSchema.validate(batchData);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const importKey = generateImportKey(value);
    const existingBatch = await this.printBatchRepository.findOne({
      where: { importKey },
      relations: ['labRecords'],
    });

    if (existingBatch) {
      logger.info(`Batch already imported, returning existing: ${value.batchNumber}`, {
        requestId: options.requestId,
      });
      return { batch: existingBatch, isNew: false };
    }

    return await AppDataSource.transaction(async (manager) => {
      let paperBatchId: string | undefined;
      if (value.paperBatchNumber) {
        let paperBatch = await manager.findOne(PaperBatch, {
          where: { batchNumber: value.paperBatchNumber },
        });
        if (!paperBatch) {
          paperBatch = manager.create(PaperBatch, {
            batchNumber: value.paperBatchNumber,
            paperType: 'Unknown',
            supplier: 'Unknown',
            productionDate: new Date(),
            isActive: true,
          });
          paperBatch = await manager.save(paperBatch);
        }
        paperBatchId = paperBatch.id;
      }

      const printBatch = manager.create(PrintBatch, {
        batchNumber: value.batchNumber,
        productName: value.productName,
        customerName: value.customerName,
        paperBatchId,
        quantity: value.quantity,
        productionDate: value.productionDate,
        machineId: value.machineId,
        operator: value.operator,
        standardLabValues: value.standardLabValues,
        status: BatchStatus.PENDING_JUDGMENT,
        remark: value.remark,
        importKey,
        createdBy: options.operator,
      });

      const savedBatch = await manager.save(printBatch);

      if (value.labRecords && value.labRecords.length > 0) {
        const labRecords = value.labRecords.map((lab: any) => {
          let validationResult = { deltaE: undefined, isWithinTolerance: true };
          if (value.standardLabValues) {
            validationResult = validateLabRecord(lab, value.standardLabValues);
          }

          return manager.create(LabRecord, {
            printBatchId: savedBatch.id,
            L: lab.L,
            a: lab.a,
            b: lab.b,
            standardL: value.standardLabValues?.L,
            standardA: value.standardLabValues?.a,
            standardB: value.standardLabValues?.b,
            deltaE: validationResult.deltaE,
            tolerance: lab.tolerance || value.standardLabValues?.tolerance || 2.0,
            measurePoint: lab.measurePoint,
            measureOrder: lab.measureOrder,
            isWithinTolerance: validationResult.isWithinTolerance,
          });
        });

        await manager.save(labRecords);

        const allDeltaE = labRecords
          .map((l: LabRecord) => l.deltaE)
          .filter((d: number | undefined): d is number => d !== undefined);

        if (allDeltaE.length > 0) {
          const avgDeltaE = allDeltaE.reduce((a: number, b: number) => a + b, 0) / allDeltaE.length;
          savedBatch.avgDeltaE = parseFloat(avgDeltaE.toFixed(2));
          await manager.save(savedBatch);
        }
      }

      await auditService.createLog(AuditAction.IMPORT, 'PrintBatch', {
        entityId: savedBatch.id,
        batchNumber: savedBatch.batchNumber,
        afterData: savedBatch,
        operator: options.operator,
        requestId: options.requestId,
        ipAddress: options.ipAddress,
      });

      return { batch: savedBatch, isNew: true };
    });
  }

  async batchImport(batchesData: any[], options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<ImportResult> {
    const result: ImportResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
      batchIds: [],
    };

    for (let i = 0; i < batchesData.length; i++) {
      try {
        const { batch, isNew } = await this.importBatch(batchesData[i], options);
        if (isNew) {
          result.successCount++;
          result.batchIds.push(batch.id);
        } else {
          result.skippedCount++;
          result.batchIds.push(batch.id);
        }
      } catch (error: any) {
        result.failedCount++;
        result.errors.push(`Batch ${i + 1}: ${error.message}`);
      }
    }

    return result;
  }

  async performJudgment(judgmentData: any, options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<PrintBatch> {
    const { error, value } = judgmentSchema.validate(judgmentData);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const batch = await this.printBatchRepository.findOne({
      where: { batchNumber: value.batchNumber },
      relations: ['labRecords'],
    });

    if (!batch) {
      throw new Error(`Batch not found: ${value.batchNumber}`);
    }

    const targetStatus = value.isPassed ? BatchStatus.PASSED : BatchStatus.FAILED;
    if (!validateBatchStatusTransition(batch.status, targetStatus)) {
      throw new Error(`Invalid status transition from ${batch.status} to ${targetStatus}`);
    }

    const beforeData = { ...batch };

    batch.status = targetStatus;
    batch.isPassed = value.isPassed;
    batch.judgmentRemark = value.remark;
    batch.judgedBy = value.judgeName || options.operator;
    batch.judgedAt = new Date();
    batch.updatedBy = options.operator;

    const savedBatch = await this.printBatchRepository.save(batch);

    await auditService.createLog(AuditAction.JUDGMENT, 'PrintBatch', {
      entityId: savedBatch.id,
      batchNumber: savedBatch.batchNumber,
      beforeData,
      afterData: savedBatch,
      operator: options.operator,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });

    return savedBatch;
  }

  async performReview(reviewData: any, options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<PrintBatch> {
    const { error, value } = reviewSchema.validate(reviewData);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const batch = await this.printBatchRepository.findOne({
      where: { batchNumber: value.batchNumber },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${value.batchNumber}`);
    }

    let targetStatus: BatchStatus;
    switch (value.reviewResult) {
      case ReviewResult.CONFIRM_PASS:
        targetStatus = BatchStatus.REVIEWED;
        batch.isPassed = true;
        break;
      case ReviewResult.CONFIRM_FAIL:
        targetStatus = BatchStatus.REVIEWED;
        batch.isPassed = false;
        break;
      case ReviewResult.NEED_REWORK:
        targetStatus = BatchStatus.REWORKED;
        batch.hasRework = true;
        batch.reworkCount = (batch.reworkCount || 0) + 1;
        break;
      default:
        throw new Error(`Invalid review result: ${value.reviewResult}`);
    }

    if (!validateBatchStatusTransition(batch.status, targetStatus)) {
      throw new Error(`Invalid status transition from ${batch.status} to ${targetStatus}`);
    }

    const beforeData = { ...batch };

    batch.status = targetStatus;
    batch.reviewRemark = value.remark;
    batch.reviewedBy = value.reviewerName || options.operator;
    batch.reviewedAt = new Date();
    batch.updatedBy = options.operator;

    const savedBatch = await this.printBatchRepository.save(batch);

    await auditService.createLog(AuditAction.REVIEW, 'PrintBatch', {
      entityId: savedBatch.id,
      batchNumber: savedBatch.batchNumber,
      beforeData,
      afterData: savedBatch,
      operator: options.operator,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });

    return savedBatch;
  }

  async recordRework(reworkData: any, options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<ReworkRecord> {
    const { error, value } = reworkSchema.validate(reworkData);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const batch = await this.printBatchRepository.findOne({
      where: { batchNumber: value.batchNumber },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${value.batchNumber}`);
    }

    return await AppDataSource.transaction(async (manager) => {
      const reworkRecord = manager.create(ReworkRecord, {
        printBatchId: batch.id,
        reworkType: value.reworkType,
        reason: value.reason,
        solution: value.solution,
        reworkCount: batch.reworkCount + 1,
        reworkedQuantity: value.reworkedQuantity,
        scrappedQuantity: value.scrappedQuantity,
        startedAt: new Date(),
        operator: value.operator || options.operator,
        beforeLabValues: value.beforeLabValues,
        afterLabValues: value.afterLabValues,
      });

      const savedRecord = await manager.save(reworkRecord);

      batch.hasRework = true;
      batch.reworkCount++;
      batch.status = BatchStatus.REWORKED;
      batch.updatedBy = options.operator;
      await manager.save(batch);

      await auditService.createLog(AuditAction.REWORK, 'ReworkRecord', {
        entityId: savedRecord.id,
        batchNumber: batch.batchNumber,
        afterData: savedRecord,
        operator: options.operator,
        requestId: options.requestId,
        ipAddress: options.ipAddress,
      });

      return savedRecord;
    });
  }

  async generateQualityOrder(orderData: any, options: {
    operator?: string;
    requestId?: string;
    ipAddress?: string;
  } = {}): Promise<QualityOrder> {
    const { error, value } = qualityOrderSchema.validate(orderData);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const batch = await this.printBatchRepository.findOne({
      where: { batchNumber: value.batchNumber },
      relations: ['labRecords'],
    });

    if (!batch) {
      throw new Error(`Batch not found: ${value.batchNumber}`);
    }

    const existingOrder = await this.qualityOrderRepository.findOne({
      where: { printBatchId: batch.id },
    });

    if (existingOrder) {
      logger.info(`Quality order already exists for batch: ${value.batchNumber}`, {
        requestId: options.requestId,
      });
      return existingOrder;
    }

    const orderNumber = `QC-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const passCount = batch.labRecords?.filter((l) => l.isWithinTolerance).length || 0;
    const failCount = (batch.labRecords?.length || 0) - passCount;

    const qualityOrder = this.qualityOrderRepository.create({
      printBatchId: batch.id,
      orderNumber,
      status: OrderStatus.ISSUED,
      orderDate: new Date(),
      inspector: value.inspector || options.operator,
      sampleCount: batch.labRecords?.length || 0,
      passCount: value.passCount ?? passCount,
      failCount: value.failCount ?? failCount,
      passRate: batch.labRecords?.length ? parseFloat(((passCount / batch.labRecords.length) * 100).toFixed(2)) : 0,
      inspectionItems: value.inspectionItems || 'Lab值检测, 外观检查, 套印精度',
      defectDescription: value.defectDescription,
      conclusion: value.conclusion || (batch.isPassed ? '合格' : '不合格'),
      createdBy: options.operator,
    });

    const savedOrder = await this.qualityOrderRepository.save(qualityOrder);

    await auditService.createLog(AuditAction.GENERATE_ORDER, 'QualityOrder', {
      entityId: savedOrder.id,
      batchNumber: batch.batchNumber,
      afterData: savedOrder,
      operator: options.operator,
      requestId: options.requestId,
      ipAddress: options.ipAddress,
    });

    return savedOrder;
  }

  async getBatch(batchNumber: string): Promise<PrintBatch | null> {
    return this.printBatchRepository.findOne({
      where: { batchNumber },
      relations: ['labRecords', 'reworkRecords', 'qualityOrders', 'paperBatch'],
    });
  }

  async getBatches(filters: {
    status?: BatchStatus;
    startDate?: Date;
    endDate?: Date;
    productName?: string;
    isPassed?: boolean;
    hasRework?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: PrintBatch[]; total: number }> {
    const { page = 1, pageSize = 20, ...whereFilters } = filters;

    let query = this.printBatchRepository
      .createQueryBuilder('batch')
      .leftJoinAndSelect('batch.labRecords', 'labRecords')
      .orderBy('batch.createdAt', 'DESC');

    if (whereFilters.status) {
      query = query.andWhere('batch.status = :status', { status: whereFilters.status });
    }
    if (whereFilters.startDate) {
      query = query.andWhere('batch.productionDate >= :startDate', { startDate: whereFilters.startDate });
    }
    if (whereFilters.endDate) {
      query = query.andWhere('batch.productionDate <= :endDate', { endDate: whereFilters.endDate });
    }
    if (whereFilters.productName) {
      query = query.andWhere('batch.productName LIKE :productName', { productName: `%${whereFilters.productName}%` });
    }
    if (whereFilters.isPassed !== undefined) {
      query = query.andWhere('batch.isPassed = :isPassed', { isPassed: whereFilters.isPassed });
    }
    if (whereFilters.hasRework !== undefined) {
      query = query.andWhere('batch.hasRework = :hasRework', { hasRework: whereFilters.hasRework });
    }

    const [data, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  async getTrendData(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<any> {
    const { startDate, endDate, groupBy = 'day' } = filters;

    let dateFormat = '%Y-%m-%d';
    if (groupBy === 'week') {
      dateFormat = '%Y-%W';
    } else if (groupBy === 'month') {
      dateFormat = '%Y-%m';
    }

    let query = this.printBatchRepository
      .createQueryBuilder('batch')
      .select(`strftime('${dateFormat}', batch.productionDate) as period`)
      .addSelect('COUNT(*) as totalBatches')
      .addSelect('SUM(CASE WHEN batch.isPassed = 1 THEN 1 ELSE 0 END) as passedBatches')
      .addSelect('SUM(CASE WHEN batch.hasRework = 1 THEN 1 ELSE 0 END) as reworkBatches')
      .addSelect('AVG(batch.avgDeltaE) as avgDeltaE')
      .groupBy('period')
      .orderBy('period', 'ASC');

    if (startDate) {
      query = query.andWhere('batch.productionDate >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('batch.productionDate <= :endDate', { endDate });
    }

    const rawData = await query.getRawMany();

    return rawData.map((item) => ({
      period: item.period,
      totalBatches: parseInt(item.totalBatches),
      passedBatches: parseInt(item.passedBatches),
      reworkBatches: parseInt(item.reworkBatches),
      passRate: item.totalBatches > 0 ? parseFloat(((item.passedBatches / item.totalBatches) * 100).toFixed(2)) : 0,
      reworkRate: item.totalBatches > 0 ? parseFloat(((item.reworkBatches / item.totalBatches) * 100).toFixed(2)) : 0,
      avgDeltaE: item.avgDeltaE ? parseFloat(item.avgDeltaE) : 0,
    }));
  }

  async markBatchComplete(batchNumber: string, options: {
    operator?: string;
    requestId?: string;
  } = {}): Promise<PrintBatch> {
    const batch = await this.printBatchRepository.findOne({
      where: { batchNumber },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${batchNumber}`);
    }

    if (!validateBatchStatusTransition(batch.status, BatchStatus.COMPLETED)) {
      throw new Error(`Cannot complete batch from status: ${batch.status}`);
    }

    const beforeData = { ...batch };
    batch.status = BatchStatus.COMPLETED;
    batch.updatedBy = options.operator;

    const savedBatch = await this.printBatchRepository.save(batch);

    await auditService.createLog(AuditAction.UPDATE, 'PrintBatch', {
      entityId: savedBatch.id,
      batchNumber: savedBatch.batchNumber,
      beforeData,
      afterData: savedBatch,
      operator: options.operator,
      requestId: options.requestId,
      remark: 'Batch marked as completed',
    });

    return savedBatch;
  }
}

export const qcService = new QualityControlService();
