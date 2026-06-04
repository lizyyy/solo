const AcousticIsolationWorkflow = require('../workflow/AcousticIsolationWorkflow');

class UnifiedDataAccess {
  constructor() {
    this.workflow = new AcousticIsolationWorkflow();
  }

  startNewEvaluation(operator) {
    return this.workflow.startEvaluation(operator);
  }

  async executeStep1(evaluationId, temperatureRecords) {
    return this.workflow.step1_importTemperatureData(evaluationId, temperatureRecords);
  }

  async executeStep2(evaluationId, sensorRecords, reviewer) {
    return this.workflow.step2_reviewSensorData(evaluationId, sensorRecords, reviewer);
  }

  async executeStep3(evaluationId, updateData, operator) {
    return this.workflow.step3_updateExperimentReview(evaluationId, updateData, operator);
  }

  supplementData(evaluationId, recordId, updates, operator, reason) {
    return this.workflow.supplementMissingData(evaluationId, recordId, updates, operator, reason);
  }

  qualityReview(evaluationId, recordId, reviewer, decision, notes) {
    return this.workflow.qualityReviewRecord(evaluationId, recordId, reviewer, decision, notes);
  }

  recalculate(evaluationId) {
    return this.workflow.recalculateAfterSupplement(evaluationId);
  }

  getResultsForDisplay(evaluationId) {
    const unified = this.workflow.getUnifiedResults(evaluationId);
    return {
      ...unified,
      displayConfig: {
        showOriginalLineNumber: true,
        showManualChanges: true,
        showQualityReviewStatus: true,
        highlightMissingTime: true
      }
    };
  }

  getResultsForExport(evaluationId) {
    return this.workflow.getExportData(evaluationId);
  }

  getResultsForAPI(evaluationId) {
    const unified = this.workflow.getUnifiedResults(evaluationId);
    return {
      code: 200,
      message: 'success',
      data: {
        evaluationId: unified.evaluationId,
        version: unified.version,
        workflowStage: unified.workflowStage,
        selfCheck: unified.selfCheckResults,
        summary: unified.summary,
        records: unified.records.map(r => ({
          id: r.recordId,
          sourceLine: r.sourceLineNumber,
          sensorId: r.sensorId,
          calibrationTime: r.calibrationTime,
          temperature: r.temperature,
          humidity: r.humidity,
          siteStatement: r.siteStatement,
          installLocation: r.installLocation,
          status: r.processingStatus,
          hasMissingSampleTime: r.hasMissingSampleTime,
          needsQualityReview: r.needsQualityReview,
          qualityReviewStatus: r.qualityReviewStatus
        }))
      }
    };
  }

  getAuditTrail(evaluationId, recordId = null) {
    return this.workflow.getAuditTrail(evaluationId, recordId);
  }

  getWorkflowStatus(evaluationId) {
    return this.workflow.getWorkflowStatus(evaluationId);
  }

  verifyDataConsistency(evaluationId) {
    const display = this.getResultsForDisplay(evaluationId);
    const api = this.getResultsForAPI(evaluationId);
    const exportData = this.getResultsForExport(evaluationId);

    const displayCount = display.records.length;
    const apiCount = api.data.records.length;
    const exportCount = exportData.details.length;

    const displayMissingCount = display.records.filter(r => r.hasMissingSampleTime).length;
    const apiMissingCount = api.data.records.filter(r => r.hasMissingSampleTime).length;
    const exportMissingCount = exportData.details.filter(r => r.采样时间缺失 === '是').length;

    const isConsistent = (
      displayCount === apiCount && 
      apiCount === exportCount &&
      displayMissingCount === apiMissingCount &&
      apiMissingCount === exportMissingCount
    );

    return {
      isConsistent,
      checks: {
        recordCount: {
          display: displayCount,
          api: apiCount,
          export: exportCount,
          consistent: displayCount === apiCount && apiCount === exportCount
        },
        missingTimeCount: {
          display: displayMissingCount,
          api: apiMissingCount,
          export: exportMissingCount,
          consistent: displayMissingCount === apiMissingCount && apiMissingCount === exportMissingCount
        }
      }
    };
  }
}

module.exports = UnifiedDataAccess;
