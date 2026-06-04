const EvaluationEngine = require('../engine/EvaluationEngine');
const moment = require('moment');

class AcousticIsolationWorkflow {
  constructor() {
    this.engine = new EvaluationEngine();
    this.workflowStates = new Map();
  }

  startEvaluation(operator = '老唐') {
    const evaluation = this.engine.createEvaluation(operator);
    this.workflowStates.set(evaluation.id, {
      currentStage: 'import',
      stageHistory: [{
        stage: 'import',
        enteredAt: moment().toISOString(),
        operator
      }]
    });
    return evaluation.id;
  }

  async step1_importTemperatureData(evaluationId, temperatureRecords) {
    this._validateStage(evaluationId, 'import');

    const result = this.engine.importTemperatureRecords(
      evaluationId,
      temperatureRecords,
      `batch_${Date.now()}`
    );

    this._advanceStage(evaluationId, 'sensor_review', '系统');

    return {
      success: true,
      message: `完成第一步：温度校准记录导入，成功导入 ${result.imported} 条`,
      importResult: result,
      nextStage: 'sensor_review',
      nextAction: '训练教练老唐查看传感器编号'
    };
  }

  async step2_reviewSensorData(evaluationId, sensorRecords, reviewer = '老唐') {
    this._validateStage(evaluationId, 'sensor_review');

    const result = this.engine.importSensorRecords(evaluationId, sensorRecords);
    const evaluation = this.engine.getEvaluation(evaluationId);
    
    const missingTimeRecords = evaluation.selfCheckResults.missingSampleTime.details;
    
    this._advanceStage(evaluationId, 'experiment_review', reviewer);

    return {
      success: true,
      message: `完成第二步：传感器编号信息补充，关联 ${result.imported} 个传感器信息`,
      sensorResult: result,
      alerts: missingTimeRecords.length > 0 ? [
        `注意：发现 ${missingTimeRecords.length} 条记录采样时间缺失，将留给质检员复核`
      ] : [],
      recordsNeedingReview: missingTimeRecords,
      nextStage: 'experiment_review',
      nextAction: '更新实验复盘图'
    };
  }

  async step3_updateExperimentReview(evaluationId, updateData, operator = '系统') {
    this._validateStage(evaluationId, 'experiment_review');

    const evaluation = this.engine.getEvaluation(evaluationId);
    const recordsToReview = [];

    for (const [recordId, record] of evaluation.temperatureRecords) {
      if (record.hasMissingSampleTime() && record.processingStatus === 'pending') {
        record.setProcessingStatus('pending_quality_review');
        recordsToReview.push(recordId);
      }
    }

    evaluation.integrateData();
    evaluation.runSelfCheck();

    this._advanceStage(evaluationId, 'quality_review', operator);

    return {
      success: true,
      message: '完成第三步：实验复盘图已更新，采样时间缺失的记录已标记等待质检员复核',
      recordsPendingQualityReview: recordsToReview.length,
      pendingRecordIds: recordsToReview,
      currentStage: 'quality_review',
      availableActions: [
        'qualityReview: 质检员复核',
        'supplementData: 补录数据',
        'recalculate: 补录后重算',
        'export: 导出结果'
      ]
    };
  }

  supplementMissingData(evaluationId, recordId, updates, operator, reason) {
    return this.engine.supplementMissingData(evaluationId, recordId, updates, operator, reason);
  }

  qualityReviewRecord(evaluationId, recordId, reviewer, decision, notes) {
    return this.engine.qualityReview(evaluationId, recordId, reviewer, decision, notes);
  }

  recalculateAfterSupplement(evaluationId) {
    return this.engine.recalculateAfterSupplement(evaluationId);
  }

  getUnifiedResults(evaluationId) {
    const evaluation = this.engine.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }
    return evaluation.getUnifiedResults();
  }

  getExportData(evaluationId) {
    return this.engine.getExportDetails(evaluationId);
  }

  getAuditTrail(evaluationId, recordId = null) {
    return this.engine.getAuditTrail(evaluationId, recordId);
  }

  getWorkflowStatus(evaluationId) {
    const state = this.workflowStates.get(evaluationId);
    const evaluation = this.engine.getEvaluation(evaluationId);
    
    if (!state || !evaluation) {
      return null;
    }

    return {
      evaluationId,
      currentStage: state.currentStage,
      stageHistory: state.stageHistory,
      selfCheckResults: evaluation.selfCheckResults,
      summary: {
        totalRecords: evaluation.integratedResults.length,
        recordsWithMissingTime: evaluation.integratedResults.filter(r => r.hasMissingSampleTime).length,
        recordsNeedingReview: evaluation.integratedResults.filter(r => r.needsQualityReview).length
      }
    };
  }

  _validateStage(evaluationId, expectedStage) {
    const state = this.workflowStates.get(evaluationId);
    if (!state) {
      throw new Error(`工作流 ${evaluationId} 不存在`);
    }
    if (state.currentStage !== expectedStage) {
      throw new Error(`当前阶段 ${state.currentStage}，不能执行 ${expectedStage} 阶段操作`);
    }
  }

  _advanceStage(evaluationId, nextStage, operator) {
    const state = this.workflowStates.get(evaluationId);
    if (state) {
      state.currentStage = nextStage;
      state.stageHistory.push({
        stage: nextStage,
        enteredAt: moment().toISOString(),
        operator
      });
      
      const evaluation = this.engine.getEvaluation(evaluationId);
      if (evaluation) {
        evaluation.setWorkflowStage(nextStage);
      }
    }
  }
}

module.exports = AcousticIsolationWorkflow;
