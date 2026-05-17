const store = require('../storage/memoryStore');
const { TRIAL_STATUS } = require('../models/TrialTask');

class TrialService {
  createTrial(data) {
    const trial = store.createTrial(data);
    trial.updateStatus(TRIAL_STATUS.PENDING, '试算任务已创建，等待处理');
    return trial;
  }

  getTrial(id, throwOnNotFound = false) {
    const trial = store.getTrial(id);
    if (throwOnNotFound && !trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }
    return trial;
  }

  getAllTrials(filters) {
    return store.getAllTrials(filters);
  }

  async runThresholdCalculation(trialId) {
    const trial = store.getTrial(trialId);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }

    trial.updateStatus(TRIAL_STATUS.PROCESSING, '开始进行阈值试算');

    try {
      for (const threshold of trial.candidateThresholds) {
        const result = this.calculateThresholdResult(
          threshold,
          trial.historySamples
        );
        trial.addThresholdResult(result);
      }

      trial.updateStatus(TRIAL_STATUS.CALCULATED, '阈值试算完成，等待误报确认');
      return trial;
    } catch (error) {
      trial.updateStatus(TRIAL_STATUS.FAILED, `阈值试算失败: ${error.message}`);
      throw error;
    }
  }

  calculateThresholdResult(threshold, samples) {
    const triggerPoints = [];
    samples.forEach((sample, index) => {
      if (sample.value >= threshold) {
        triggerPoints.push({
          index,
          timestamp: sample.timestamp,
          value: sample.value,
          isRealIncident: sample.isRealIncident || false
        });
      }
    });

    return {
      threshold,
      triggerCount: triggerPoints.length,
      triggerRate: triggerPoints.length / samples.length,
      triggerPoints
    };
  }

  advanceStatus(trialId, targetStatus, note) {
    const trial = store.getTrial(trialId);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }

    const validTransitions = {
      [TRIAL_STATUS.PENDING]: [TRIAL_STATUS.PROCESSING],
      [TRIAL_STATUS.PROCESSING]: [TRIAL_STATUS.CALCULATED, TRIAL_STATUS.FAILED],
      [TRIAL_STATUS.CALCULATED]: [TRIAL_STATUS.CONFIRMING],
      [TRIAL_STATUS.CONFIRMING]: [TRIAL_STATUS.COMPLETED],
      [TRIAL_STATUS.FAILED]: [TRIAL_STATUS.PENDING]
    };

    if (!validTransitions[trial.status]?.includes(targetStatus)) {
      const error = new Error(`无法从 ${trial.status} 转换到 ${targetStatus}`);
      error.statusCode = 400;
      error.errorCode = 'INVALID_STATUS_TRANSITION';
      error.processingBasis = `状态转换规则: ${JSON.stringify(validTransitions)}`;
      throw error;
    }

    trial.updateStatus(targetStatus, note || '状态手动推进');

    if (targetStatus === TRIAL_STATUS.COMPLETED) {
      trial.generateReport();
    }

    return trial;
  }

  addFalsePositive(trialId, data) {
    const trial = store.getTrial(trialId);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }

    const thresholdResult = trial.thresholdResults.find(t => t.id === data.thresholdId);
    if (!thresholdResult) {
      const error = new Error('阈值结果不存在');
      error.statusCode = 404;
      error.errorCode = 'THRESHOLD_NOT_FOUND';
      error.processingBasis = '根据 thresholdId 在阈值结果中未找到对应记录';
      throw error;
    }

    const sample = trial.historySamples[data.pointIndex];
    if (!sample) {
      const error = new Error('历史样本索引不存在');
      error.statusCode = 400;
      error.errorCode = 'INVALID_SAMPLE_INDEX';
      error.processingBasis = `历史样本总数: ${trial.historySamples.length}, 请求索引: ${data.pointIndex}`;
      throw error;
    }

    trial.addFalsePositiveRecord({
      thresholdId: data.thresholdId,
      pointIndex: data.pointIndex,
      timestamp: sample.timestamp,
      value: sample.value,
      description: data.description
    });

    thresholdResult.falsePositiveCount++;
    thresholdResult.falsePositiveRate = thresholdResult.falsePositiveCount / thresholdResult.triggerCount;

    return trial;
  }

  applyManualCorrection(trialId, data) {
    const trial = store.getTrial(trialId);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }

    const thresholdResult = trial.thresholdResults.find(t => t.id === data.thresholdId);
    if (!thresholdResult) {
      const error = new Error('阈值结果不存在');
      error.statusCode = 404;
      error.errorCode = 'THRESHOLD_NOT_FOUND';
      error.processingBasis = '根据 thresholdId 在阈值结果中未找到对应记录';
      throw error;
    }

    if (thresholdResult[data.field] !== data.oldValue) {
      const error = new Error('原值不匹配，可能已被修改');
      error.statusCode = 409;
      error.errorCode = 'VALUE_MISMATCH';
      error.processingBasis = `当前值: ${thresholdResult[data.field]}, 提供的原值: ${data.oldValue}`;
      throw error;
    }

    trial.addManualCorrection({
      field: data.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      correctedBy: data.correctedBy,
      reason: data.reason
    });

    thresholdResult[data.field] = data.newValue;

    return trial;
  }

  exportReport(trialId, format = 'json') {
    const trial = store.getTrial(trialId);
    if (!trial) {
      const error = new Error('试算任务不存在');
      error.statusCode = 404;
      error.errorCode = 'TRIAL_NOT_FOUND';
      error.processingBasis = '根据 trialId 在存储中未找到对应记录';
      throw error;
    }

    if (trial.status !== TRIAL_STATUS.COMPLETED || !trial.report) {
      const error = new Error('试算尚未完成，无法导出报告');
      error.statusCode = 400;
      error.errorCode = 'TRIAL_NOT_COMPLETED';
      error.processingBasis = `当前状态: ${trial.status}, 报告生成状态: ${!!trial.report}`;
      throw error;
    }

    if (format === 'csv') {
      return this.generateCsvReport(trial);
    }

    return trial.report;
  }

  generateCsvReport(trial) {
    const lines = [];
    lines.push(['指标名称', trial.metricName].join(','));
    lines.push(['样本总数', trial.historySamples.length].join(','));
    lines.push(['推荐阈值', trial.report.recommendedThreshold].join(','));
    lines.push('');
    lines.push(['阈值', '触发次数', '触发率', '误报次数', '误报率'].join(','));
    
    trial.thresholdResults.forEach(r => {
      lines.push([
        r.threshold,
        r.triggerCount,
        (r.triggerRate * 100).toFixed(2) + '%',
        r.falsePositiveCount,
        (r.falsePositiveRate * 100).toFixed(2) + '%'
      ].join(','));
    });

    return lines.join('\n');
  }
}

module.exports = new TrialService();