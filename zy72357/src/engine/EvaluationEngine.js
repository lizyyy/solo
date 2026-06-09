const moment = require('moment');
const { 
  TemperatureCalibrationRecord, 
  SensorRecord, 
  EvaluationResult 
} = require('../models');

class EvaluationEngine {
  constructor() {
    this.evaluations = new Map();
  }

  createEvaluation(operator = '') {
    const evaluation = new EvaluationResult();
    evaluation.operator = operator;
    this.evaluations.set(evaluation.id, evaluation);
    return evaluation;
  }

  getEvaluation(evaluationId) {
    return this.evaluations.get(evaluationId);
  }

  importTemperatureRecords(evaluationId, recordsData, importBatchId = null) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    const importResults = {
      total: recordsData.length,
      imported: 0,
      duplicates: 0,
      errors: [],
      recordIds: []
    };

    recordsData.forEach((data, index) => {
      try {
        const sourceLineNumber = index + 2;
        const record = new TemperatureCalibrationRecord(
          { ...data, importBatchId },
          sourceLineNumber
        );
        evaluation.addTemperatureRecord(record);
        importResults.recordIds.push(record.id);
        importResults.imported++;
      } catch (error) {
        importResults.errors.push({
          line: index + 2,
          error: error.message,
          data
        });
      }
    });

    evaluation.integrateData();
    evaluation.runSelfCheck();
    
    importResults.duplicates = evaluation.selfCheckResults.duplicateImport.count;
    importResults.recordsWithMissingTime = evaluation.selfCheckResults.missingSampleTime.count;
    
    return importResults;
  }

  importSensorRecords(evaluationId, sensorDataList) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    const importResults = {
      total: sensorDataList.length,
      imported: 0,
      errors: []
    };

    sensorDataList.forEach((data, index) => {
      try {
        const record = new SensorRecord(data);
        evaluation.addSensorRecord(record);
        importResults.imported++;
      } catch (error) {
        importResults.errors.push({
          index,
          error: error.message,
          data
        });
      }
    });

    evaluation.integrateData();
    evaluation.runSelfCheck();
    
    return importResults;
  }

  supplementMissingData(evaluationId, recordId, fieldUpdates, operator, reason) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    const record = evaluation.temperatureRecords.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    const changeFields = Object.keys(fieldUpdates);
    changeFields.forEach(field => {
      record.updateField(field, fieldUpdates[field], operator, reason);
    });

    record.setProcessingStatus('supplemented');
    evaluation.incrementVersion(`补录记录 ${recordId}：${changeFields.join(', ')}`);
    evaluation.integrateData();
    evaluation.runSelfCheck();

    return record.toJSON();
  }

  qualityReview(evaluationId, recordId, reviewer, decision, notes = '') {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    const record = evaluation.temperatureRecords.get(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.setQualityReview(reviewer, decision, notes);

    if (notes) {
      const currentNotes = record.notes;
      if (!currentNotes.includes(notes)) {
        record.updateField('notes', currentNotes + (currentNotes ? ' ' : '') + `[质检员备注: ${notes}]`, reviewer, '质量复核');
      }
    }

    const status = decision === 'approve' ? 'quality_approved' : 'quality_rejected';
    record.setProcessingStatus(status);

    evaluation.integrateData();
    evaluation.runSelfCheck();

    return record.toJSON();
  }

  recalculateAfterSupplement(evaluationId) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    const supplementedRecords = [];
    for (const [recordId, record] of evaluation.temperatureRecords) {
      if (record.processingStatus === 'supplemented') {
        record.setProcessingStatus('recalculated');
        supplementedRecords.push(recordId);
      }
    }

    evaluation.incrementVersion('补录后重算');
    evaluation.integrateData();
    evaluation.runSelfCheck();

    return {
      recalculatedCount: supplementedRecords.length,
      recalculatedIds: supplementedRecords
    };
  }

  exportUnifiedData(evaluationId) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    evaluation.createExportSnapshot();
    return evaluation.getUnifiedResults();
  }

  getExportDetails(evaluationId) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    evaluation.integrateData();

    const summaryRow = {
      评估ID: evaluation.id,
      版本: `v${evaluation.version}`,
      工作流阶段: evaluation.workflowStage,
      导出时间: moment().format('YYYY-MM-DD HH:mm:ss'),
      总记录数: evaluation.integratedResults.length,
      有采样时间问题: evaluation.selfCheckResults.missingSampleTime.count,
      需质检员复核: evaluation.integratedResults.filter(r => r.needsQualityReview).length,
      关联传感器数: evaluation.sensorRecords.size
    };

    const detailRows = evaluation.integratedResults.map(r => ({
      ...r.export
    }));

    const historyRows = evaluation.integratedResults.map(r => ({
      原始行号: r.sourceLineNumber,
      传感器编号: r.sensorId,
      原始说法: r.auditTrail.originalStatement,
      初始问题: r.sampleTimeIssue.description,
      初始问题类型: r.sampleTimeIssue.type,
      缺失分钟数: r.sampleTimeIssue.missingMinutes || 0,
      人工改动次数: r.manualChanges.length,
      最后一次改动: r.manualChanges.length > 0 
        ? `${r.manualChanges[r.manualChanges.length - 1].operator} 修改 ${r.manualChanges[r.manualChanges.length - 1].field}` 
        : '无',
      当前处理状态: r.processingStatus,
      复核状态: r.qualityReview.status,
      复核员: r.qualityReview.reviewer || '—',
      下一步找谁: r.qualityReview.nextHandler || '—',
      下一步处理: r.qualityReview.nextStepDescription || '已完成'
    }));

    const summaryCounters = {
      ...summaryRow,
      持续时间达标数: evaluation.integratedResults.filter(r => r.durationCompliant).length,
      持续时间不足数: evaluation.integratedResults.filter(r => !r.durationCompliant).length,
      复核通过数: evaluation.integratedResults.filter(r => r.qualityReview.status === 'approved').length,
      复核待处理数: evaluation.integratedResults.filter(r => r.qualityReview.status === 'pending').length,
      复核未通过数: evaluation.integratedResults.filter(r => r.qualityReview.status === 'rejected').length
    };

    return {
      summary: summaryCounters,
      details: detailRows,
      history: historyRows,
      selfCheckReport: {
        duplicateImport: evaluation.selfCheckResults.duplicateImport,
        missingSampleTime: evaluation.selfCheckResults.missingSampleTime,
        recalculationAfterSupplement: evaluation.selfCheckResults.recalculationAfterSupplement,
        exportConsistency: evaluation.selfCheckResults.exportConsistency,
        overall: {
          allPassed: Object.values(evaluation.selfCheckResults).every(r => r.passed),
          totalIssues: Object.values(evaluation.selfCheckResults).reduce((sum, r) => sum + (r.count || 0), 0)
        }
      },
      dataConsistencyNote: '重要：本导出明细、列表展示、接口返回均源自 EvaluationResult.integratedResults（同一份最新数据），无独立计算逻辑，保证三处完全一致'
    };
  }

  getDisplayList(evaluationId) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }
    evaluation.integrateData();

    return {
      total: evaluation.integratedResults.length,
      summary: evaluation._buildSummary(),
      list: evaluation.integratedResults.map(r => ({
        id: r.recordId,
        row: r.sourceLineNumber,
        sensorId: r.sensorId,
        siteStatement: r.siteStatement,
        sampleStartTime: r.sampleStartTime,
        sampleDurationMinutes: r.sampleDurationMinutes,
        temperature: r.temperature,
        issueType: r.sampleTimeIssue.type,
        issueText: r.sampleTimeIssue.description,
        missingMinutes: r.sampleTimeIssue.missingMinutes || 0,
        hasIssue: r.hasMissingSampleTime,
        needsReview: r.needsQualityReview,
        reviewStatus: r.qualityReview.status,
        processingStatus: r.processingStatus,
        displayBadge: r.display.statusBadge,
        rowHighlight: r.display.rowHighlight,
        nextStep: r.display.nextStepText,
        summary: r.summary
      }))
    };
  }

  getDetail(evaluationId, recordId) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }
    evaluation.integrateData();

    const record = evaluation.integratedResults.find(r => r.recordId === recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    return {
      ...record,
      sourceData: {
        originalRow: record.sourceLineNumber,
        originalInput: record.originalData,
        originalStatement: record.auditTrail.originalStatement,
        correctedValue: record.manualChanges.length > 0 
          ? { field: record.manualChanges[record.manualChanges.length - 1].field, value: record.manualChanges[record.manualChanges.length - 1].newValue }
          : null,
        processingReason: record.manualChanges.length > 0 
          ? record.manualChanges[record.manualChanges.length - 1].reason
          : null,
        allCorrections: record.manualChanges,
        nextHandler: record.qualityReview.nextHandler,
        nextAction: record.qualityReview.nextStepDescription
      },
      fullAuditTrail: record.auditTrail
    };
  }

  getAuditTrail(evaluationId, recordId = null) {
    const evaluation = this.getEvaluation(evaluationId);
    if (!evaluation) {
      throw new Error(`评估 ${evaluationId} 不存在`);
    }

    if (recordId) {
      const record = evaluation.temperatureRecords.get(recordId);
      return record ? record.getAuditTrail() : null;
    }

    return evaluation.getAuditTrail();
  }
}

module.exports = EvaluationEngine;
