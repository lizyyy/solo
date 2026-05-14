import { dataStore } from './store';
import { TaskPreview, RiskySample, CancellationResult, FailedSample, SampleStatus, SampleSource, ManualAdjustment } from './types';

export class BatchCancellationService {
  previewCancellation(batchId: string): TaskPreview | null {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) return null;

    const samples = dataStore.getSamplesByBatch(batchId);
    
    const riskySamples: RiskySample[] = [];
    let safeToCancel = 0;

    samples.forEach(sample => {
      if (sample.status === SampleStatus.COMPLETED) {
        riskySamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          reason: '样品已完成直播，取消可能影响数据统计',
          riskLevel: 'high'
        });
      } else if (sample.status === SampleStatus.PROCESSING) {
        riskySamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          reason: '样品正在处理中，强制取消可能产生脏数据',
          riskLevel: 'medium'
        });
      } else if (sample.status === SampleStatus.MANUALLY_ADJUSTED) {
        riskySamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          reason: '样品已被人工修正，取消需谨慎评估影响',
          riskLevel: 'medium'
        });
      } else if (sample.source === SampleSource.MIXED) {
        riskySamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          reason: '样本来源混杂，系统无法准确追溯原始创建者',
          riskLevel: 'high'
        });
      } else if (sample.source === SampleSource.MANUAL) {
        riskySamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          reason: '人工录入样品，建议确认后再取消',
          riskLevel: 'low'
        });
      } else {
        safeToCancel++;
      }
    });

    return {
      batchId,
      affectedCount: samples.length,
      safeToCancel,
      riskyCount: riskySamples.length,
      riskySamples,
      estimatedDuration: `${Math.ceil(samples.length * 0.5)} 秒`
    };
  }

  executeCancellation(batchId: string, operator: string, force: boolean = false): CancellationResult | null {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) return null;

    const samples = dataStore.getSamplesByBatch(batchId);
    const failedSamples: FailedSample[] = [];
    let successfullyCancelled = 0;

    samples.forEach(sample => {
      try {
        const canCancel = this.canCancelSample(sample, force);
        
        if (!canCancel.success) {
          throw new Error(canCancel.reason);
        }

        dataStore.updateSample(sample.id, {
          status: SampleStatus.CANCELLED,
          remarks: `由 ${operator} 于 ${new Date().toISOString()} 批量取消`
        });

        successfullyCancelled++;
      } catch (error) {
        failedSamples.push({
          sampleId: sample.id,
          productName: sample.productName,
          error: error instanceof Error ? error.message : '未知错误',
          source: sample.source,
          status: sample.status
        });
      }
    });

    return {
      success: failedSamples.length === 0,
      batchId,
      totalProcessed: samples.length,
      successfullyCancelled,
      failedCount: failedSamples.length,
      failedSamples,
      completedAt: new Date().toISOString()
    };
  }

  private canCancelSample(sample: any, force: boolean): { success: boolean; reason: string } {
    if (sample.status === SampleStatus.COMPLETED) {
      if (force) {
        return { success: true, reason: '' };
      }
      return { success: false, reason: '样品已完成直播，非强制模式下不可取消' };
    }

    if (sample.status === SampleStatus.MANUALLY_ADJUSTED && !force) {
      return { success: false, reason: '已人工修正的样品需要强制取消' };
    }

    if (sample.source === SampleSource.MIXED) {
      if (force) {
        return { success: true, reason: '' };
      }
      return { success: false, reason: '样本来源混杂，需人工复核后强制取消' };
    }

    if (sample.status === SampleStatus.CANCELLED) {
      return { success: false, reason: '样品已处于取消状态' };
    }

    return { success: true, reason: '' };
  }

  manuallyAdjustSample(
    sampleId: string,
    newStatus: SampleStatus,
    adjustedBy: string,
    reason: string,
    remarks: string
  ): { success: boolean; message: string; adjustment?: ManualAdjustment } {
    const sample = dataStore.getSampleById(sampleId);
    if (!sample) {
      return { success: false, message: '样品不存在' };
    }

    const oldStatus = sample.status;
    const now = new Date().toISOString();

    dataStore.updateSample(sampleId, {
      status: newStatus,
      adjustedBy,
      adjustedAt: now,
      adjustmentReason: reason,
      remarks: remarks + (sample.remarks ? `\n原有备注: ${sample.remarks}` : '')
    });

    const adjustment = dataStore.addManualAdjustment({
      sampleId,
      batchId: sample.batchId,
      adjustedBy,
      adjustedAt: now,
      oldStatus,
      newStatus,
      reason,
      remarks
    });

    return {
      success: true,
      message: '人工修正成功',
      adjustment
    };
  }
}

export const batchCancellationService = new BatchCancellationService();