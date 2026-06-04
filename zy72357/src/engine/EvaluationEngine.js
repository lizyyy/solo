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

    Object.keys(fieldUpdates).forEach(field => {
      record.updateField(field, fieldUpdates[field], operator, reason);
    });

    record.setProcessingStatus('supplemented');
    evaluation.incrementVersion();
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

    const status = decision === 'approve' ? 'quality_approved' : 'quality_rejected';
    record.setProcessingStatus(status);
    
    if (notes) {
      record.updateField('notes', record.notes + ` [质检员: ${notes}]`, reviewer, '质量复核');
    }

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

    evaluation.incrementVersion();
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

    return {
      summary: {
        evaluationId: evaluation.id,
        version: evaluation.version,
        exportTime: evaluation.exportSnapshot ? evaluation.exportSnapshot.exportTime : null,
        recordCount: evaluation.integratedResults.length
      },
      details: evaluation.integratedResults.map(r => ({
        原始行号: r.sourceLineNumber,
        传感器编号: r.sensorId,
        校准时间: r.calibrationTime,
        温度: r.temperature,
        湿度: r.humidity,
        现场说法: r.siteStatement,
        安装位置: r.installLocation,
        处理状态: r.processingStatus,
        采样时间缺失: r.hasMissingSampleTime ? '是' : '否',
        需质检员复核: r.needsQualityReview ? '是' : '否',
        人工改动记录: r.manualChanges.map(c => 
          `${c.timestamp}: ${c.operator} 修改 ${c.field} 从 ${c.oldValue} 到 ${c.newValue} (${c.reason})`
        ).join('; ')
      }))
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
