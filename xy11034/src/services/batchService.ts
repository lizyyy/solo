import { v4 as uuidv4 } from 'uuid';
import { RoastingBatch, BatchStatus, ValidationError, GreenCoffee, RoastingCurve } from '../types';
import { store } from '../data/store';
import { rulesEngine } from './businessRules';
import { reportService } from './reportService';

export class BatchService {
  public createBatch(batchData: Partial<RoastingBatch>, createdBy: string): {
    success: boolean;
    batch?: RoastingBatch;
    errors?: ValidationError[];
    explanation?: string;
  } {
    const validationErrors = rulesEngine.validateBatchCreation(batchData);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }

    const greenCoffee = store.getGreenCoffee(batchData.greenCoffeeId!);
    const roastingCurve = store.getRoastingCurve(batchData.roastingCurveId!);

    if (!greenCoffee || !roastingCurve) {
      return {
        success: false,
        errors: [{
          field: !greenCoffee ? 'greenCoffeeId' : 'roastingCurveId',
          message: !greenCoffee ? '生豆批次不存在' : '烘焙曲线不存在',
          code: 'NOT_FOUND'
        }]
      };
    }

    const now = new Date();
    const batchNumber = this.generateBatchNumber();

    const batch: RoastingBatch = {
      id: uuidv4(),
      batchNumber,
      greenCoffeeId: batchData.greenCoffeeId!,
      greenCoffee,
      roastingCurveId: batchData.roastingCurveId!,
      roastingCurve,
      roastMaster: batchData.roastMaster!,
      machineId: batchData.machineId || 'UNKNOWN',
      machineName: batchData.machineName || '未知设备',
      plannedWeightKg: batchData.plannedWeightKg!,
      actualWeightKg: batchData.actualWeightKg || batchData.plannedWeightKg!,
      roastLevel: batchData.roastLevel!,
      status: BatchStatus.DRAFT,
      startTime: batchData.startTime || null,
      endTime: batchData.endTime || null,
      firstCrackTime: batchData.firstCrackTime || null,
      secondCrackTime: batchData.secondCrackTime || null,
      dropTemperature: batchData.dropTemperature || null,
      weightLossPercentage: batchData.weightLossPercentage || null,
      actualTemperaturePoints: batchData.actualTemperaturePoints || [],
      cuppingResult: batchData.cuppingResult || null,
      qualityAssessor: batchData.qualityAssessor || null,
      rejectionReason: null,
      attentionReasons: [],
      traceabilityNotes: batchData.traceabilityNotes || '',
      parentBatchId: batchData.parentBatchId || null,
      childBatchIds: [],
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    const traceabilityCheck = rulesEngine.checkTraceabilityConsistency(batch);
    const qualityCheck = rulesEngine.checkRoastingQuality(batch);
    const statusResult = rulesEngine.determineBatchStatus(batch, traceabilityCheck, qualityCheck);

    batch.status = statusResult.status;
    batch.attentionReasons = statusResult.attentionReasons;
    batch.rejectionReason = statusResult.rejectionReason;

    store.addBatch(batch);
    store.createHistoryRecord(
      batch.id,
      '创建批次',
      null,
      batch.status,
      createdBy,
      `创建烘焙批次 ${batchNumber}`,
      { initialData: batchData }
    );

    return {
      success: true,
      batch,
      explanation: rulesEngine.generateExplanationMessage(batch)
    };
  }

  public updateBatchStatus(
    batchId: string,
    updates: Partial<RoastingBatch>,
    updatedBy: string
  ): {
    success: boolean;
    batch?: RoastingBatch;
    errors?: string[];
    explanation?: string;
  } {
    const batch = store.getBatch(batchId);
    if (!batch) {
      return {
        success: false,
        errors: ['批次不存在']
      };
    }

    const previousStatus = batch.status;
    const updatedBatch = { ...batch, ...updates, updatedAt: new Date(), version: batch.version + 1 };

    const traceabilityCheck = rulesEngine.checkTraceabilityConsistency(updatedBatch);
    const qualityCheck = rulesEngine.checkRoastingQuality(updatedBatch);
    const statusResult = rulesEngine.determineBatchStatus(updatedBatch, traceabilityCheck, qualityCheck);

    updatedBatch.status = statusResult.status;
    updatedBatch.attentionReasons = statusResult.attentionReasons;
    updatedBatch.rejectionReason = statusResult.rejectionReason;

    store.updateBatch(batchId, updatedBatch);

    if (previousStatus !== updatedBatch.status) {
      store.createHistoryRecord(
        batchId,
        '状态变更',
        previousStatus,
        updatedBatch.status,
        updatedBy,
        `批次状态从 ${previousStatus} 变更为 ${updatedBatch.status}`,
        { updates }
      );
    }

    return {
      success: true,
      batch: updatedBatch,
      explanation: rulesEngine.generateExplanationMessage(updatedBatch)
    };
  }

  public getBatchDetail(batchId: string) {
    const batch = store.getBatch(batchId);
    if (!batch) {
      return null;
    }

    return {
      ...reportService.getBatchDetail(batch),
      history: reportService.getBatchHistoryWithDetails(batchId),
      explanation: rulesEngine.generateExplanationMessage(batch)
    };
  }

  public getAllBatches() {
    return store.getAllBatches().map(batch => ({
      ...reportService.generateBatchReport(batch),
      explanation: rulesEngine.generateExplanationMessage(batch)
    }));
  }

  public getBatchReports() {
    const batches = store.getAllBatches();
    return {
      reports: reportService.generateBatchReportList(batches),
      statistics: reportService.generateSummaryStatistics(batches)
    };
  }

  public getBatchesByStatus(status: BatchStatus) {
    return store.getAllBatches()
      .filter(b => b.status === status)
      .map(batch => ({
        ...reportService.generateBatchReport(batch),
        explanation: rulesEngine.generateExplanationMessage(batch)
      }));
  }

  public resolveAttentionBatch(
    batchId: string,
    resolution: string,
    resolvedBy: string,
    approve: boolean
  ): {
    success: boolean;
    batch?: RoastingBatch;
    errors?: string[];
  } {
    const batch = store.getBatch(batchId);
    if (!batch) {
      return {
        success: false,
        errors: ['批次不存在']
      };
    }

    if (batch.status !== BatchStatus.NEEDS_ATTENTION) {
      return {
        success: false,
        errors: ['批次状态不是待处理状态']
      };
    }

    const newStatus = approve ? BatchStatus.APPROVED : BatchStatus.REJECTED;
    const updatedBatch = store.updateBatch(batchId, {
      status: newStatus,
      qualityAssessor: resolvedBy,
      attentionReasons: [],
      rejectionReason: approve ? null : resolution
    });

    if (updatedBatch) {
      store.createHistoryRecord(
        batchId,
        '处理待办',
        BatchStatus.NEEDS_ATTENTION,
        newStatus,
        resolvedBy,
        resolution,
        { approve }
      );
    }

    return {
      success: true,
      batch: updatedBatch
    };
  }

  private generateBatchNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const count = store.getAllBatches().length + 1;
    return `RB-${year}-${month}-${String(count).padStart(3, '0')}`;
  }
}

export const batchService = new BatchService();
