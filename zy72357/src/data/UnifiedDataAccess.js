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
        highlightMissingTime: true,
        showNextStepHint: true,
        showInitialVsCurrentDualView: true
      },
      list: this.getListForDisplay(evaluationId).list,
      history: this.getHistoryForDisplay(evaluationId).history,
      dataSource: 'integratedResults（同一份数据，保证6处一致，初始证据+当前状态分开展示）'
    };
  }

  getListForDisplay(evaluationId) {
    return this.workflow.engine.getDisplayList(evaluationId);
  }

  getDetailForDisplay(evaluationId, recordId) {
    return this.workflow.engine.getDetail(evaluationId, recordId);
  }

  getHistoryForDisplay(evaluationId) {
    const exportData = this.workflow.engine.getExportDetails(evaluationId);
    return {
      summary: exportData.summary,
      history: exportData.history
    };
  }

  getResultsForExport(evaluationId) {
    return this.workflow.engine.getExportDetails(evaluationId);
  }

  getReport(evaluationId) {
    const exportData = this.workflow.engine.getExportDetails(evaluationId);
    const unified = this.workflow.getUnifiedResults(evaluationId);

    return {
      reportId: `RPT-${evaluationId.slice(0, 8)}-v${unified.version}`,
      generatedAt: new Date().toISOString(),
      evaluation: {
        id: evaluationId,
        version: unified.version,
        workflowStage: unified.workflowStage,
        operator: unified.operator || '老唐'
      },
      overview: exportData.summary,
      selfCheckReport: exportData.selfCheckReport,
      initialDurationBreakdown: unified.summary.initialDurationBreakdown,
      currentDurationBreakdown: unified.summary.currentDurationBreakdown,
      pendingActions: unified.records
        .filter(r => r.needsQualityReview)
        .map(r => ({
          sourceLine: r.sourceLineNumber,
          sensorId: r.sensorId,
          initialIssue: r.initialIssue ? r.initialIssue.description : '（初始正常）',
          initialMissingMinutes: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
          currentIssue: r.currentIssue.description,
          missingMinutes: r.currentIssue.missingMinutes || 0,
          nextHandler: r.qualityReview.nextHandler,
          nextAction: r.qualityReview.nextStepDescription
        })),
      records: exportData.report,
      recordAudits: unified.records.map(r => ({
        sourceLine: r.sourceLineNumber,
        sensorId: r.sensorId,
        siteStatement: r.siteStatement,
        originalInput: r.originalData,
        originalSnapshot: r.originalSnapshot,
        originalStatement: r.auditTrail.originalStatement,
        initialIssue: r.initialIssue,
        initialMissingMinutes: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
        currentIssue: r.currentIssue,
        wasEverIssue: r.wasEverIssue,
        sampleTimeIssue: r.currentIssue,
        corrections: r.manualChanges.map(c => ({
          field: c.field,
          originalValue: c.oldValue,
          correctedValue: c.newValue,
          operator: c.operator,
          reason: c.reason,
          beforeIssue: c.beforeIssue,
          afterIssue: c.afterIssue,
          at: c.timestamp
        })),
        review: {
          status: r.qualityReview.status,
          reviewer: r.qualityReview.reviewer,
          decision: r.qualityReview.decision,
          notes: r.qualityReview.reviewNotes,
          nextHandler: r.qualityReview.nextHandler,
          nextStepDescription: r.qualityReview.nextStepDescription
        },
        processingStatus: r.processingStatus,
        isInNormalResults: r.qualityReview.status === 'approved' && r.durationCompliant
      })),
      consistencyGuarantee: exportData.dataConsistencyNote,
      changeLog: unified.changeLog
    };
  }

  getResultsForAPI(evaluationId) {
    const unified = this.workflow.getUnifiedResults(evaluationId);
    const list = this.getListForDisplay(evaluationId);

    return {
      code: 200,
      message: 'success',
      data: {
        evaluationId: unified.evaluationId,
        version: unified.version,
        workflowStage: unified.workflowStage,
        selfCheck: unified.selfCheckResults,
        summary: unified.summary,
        list: list.list,
        records: unified.records.map(r => ({
          id: r.recordId,
          sourceLine: r.sourceLineNumber,
          sensorId: r.sensorId,
          calibrationTime: r.calibrationTime,
          sampleStartTime: r.sampleStartTime,
          sampleEndTime: r.sampleEndTime,
          sampleDurationMinutes: r.sampleDurationMinutes,
          temperature: r.temperature,
          humidity: r.humidity,
          siteStatement: r.siteStatement,
          installLocation: r.installLocation,
          initialIssue: r.initialIssue,
          initialMissingMinutes: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
          currentIssue: r.currentIssue,
          wasEverIssue: r.wasEverIssue,
          sampleTimeIssue: r.sampleTimeIssue,
          hasMissingSampleTime: r.hasMissingSampleTime,
          needsQualityReview: r.needsQualityReview,
          processingStatus: r.processingStatus,
          qualityReview: r.qualityReview,
          durationCompliant: r.durationCompliant
        })),
        changeLog: unified.changeLog
      },
      consistency: unified.summary.consistency
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
    const list = this.getListForDisplay(evaluationId);
    const report = this.getReport(evaluationId);

    const displayCount = display.records.length;
    const listCount = list.total;
    const apiCount = api.data.records.length;
    const exportCount = exportData.details.length;
    const historyCount = exportData.history.length;
    const reportCount = report.recordAudits.length;

    const displayEverIssueCount = display.records.filter(r => r.wasEverIssue).length;
    const listEverIssueCount = list.list.filter(r => r.wasEverIssue).length;
    const apiEverIssueCount = api.data.records.filter(r => r.wasEverIssue).length;
    const exportEverIssueCount = exportData.details.filter(r => r.采样时间曾有异常 === '是').length;
    const historyEverIssueCount = exportData.history.filter(h => h.初始问题类型 !== 'none').length;
    const reportEverIssueCount = report.recordAudits.filter(r => r.wasEverIssue).length;

    const displayReviewCount = display.records.filter(r => r.needsQualityReview).length;
    const listReviewCount = list.list.filter(r => r.needsReview).length;
    const apiReviewCount = api.data.records.filter(r => r.needsQualityReview).length;
    const exportReviewCount = exportData.details.filter(r => r.需质检员复核 === '是').length;
    const historyReviewCount = exportData.history.filter(
      h => h.复核状态 === 'pending' || h.复核状态 === 'rejected'
    ).length;
    const reportReviewCount = report.pendingActions.length;

    const displayMissingTimeCount = displayEverIssueCount;
    const listMissingTimeCount = listEverIssueCount;
    const apiMissingTimeCount = apiEverIssueCount;
    const exportMissingTimeCount = exportEverIssueCount;
    const historyMissingTimeCount = historyEverIssueCount;
    const reportMissingTimeCount = reportEverIssueCount;

    const allCountConsistent = (
      displayCount === listCount &&
      listCount === apiCount &&
      apiCount === exportCount &&
      exportCount === historyCount &&
      historyCount === reportCount
    );

    const allMissingConsistent = (
      displayMissingTimeCount === listMissingTimeCount &&
      listMissingTimeCount === apiMissingTimeCount &&
      apiMissingTimeCount === exportMissingTimeCount &&
      exportMissingTimeCount === historyMissingTimeCount &&
      historyMissingTimeCount === reportMissingTimeCount
    );

    const allReviewConsistent = (
      displayReviewCount === listReviewCount &&
      listReviewCount === apiReviewCount &&
      apiReviewCount === exportReviewCount &&
      exportReviewCount === historyReviewCount &&
      historyReviewCount === reportReviewCount
    );

    const sampleRecord = display.records[0];
    const sampleListRecord = list.list[0];
    const sampleAPIRecord = api.data.records[0];
    const sampleExportRecord = exportData.details[0];
    const sampleHistoryRecord = exportData.history[0];

    const fieldConsistencyChecks = sampleRecord ? {
      sourceLine: {
        display: sampleRecord.sourceLineNumber,
        list: sampleListRecord.row,
        api: sampleAPIRecord.sourceLine,
        export: sampleExportRecord.原始行号,
        history: sampleHistoryRecord.原始行号,
        consistent: (
          sampleRecord.sourceLineNumber === sampleListRecord.row &&
          sampleListRecord.row === sampleAPIRecord.sourceLine &&
          sampleAPIRecord.sourceLine === sampleExportRecord.原始行号 &&
          sampleExportRecord.原始行号 === sampleHistoryRecord.原始行号
        )
      },
      sensorId: {
        display: sampleRecord.sensorId,
        list: sampleListRecord.sensorId,
        api: sampleAPIRecord.sensorId,
        export: sampleExportRecord.传感器编号,
        history: sampleHistoryRecord.传感器编号,
        consistent: (
          sampleRecord.sensorId === sampleListRecord.sensorId &&
          sampleListRecord.sensorId === sampleAPIRecord.sensorId &&
          sampleAPIRecord.sensorId === sampleExportRecord.传感器编号 &&
          sampleExportRecord.传感器编号 === sampleHistoryRecord.传感器编号
        )
      },
      initialMissingMinutes: {
        display: sampleRecord.initialIssue && sampleRecord.initialIssue.missingMinutes ? sampleRecord.initialIssue.missingMinutes : 0,
        list: sampleListRecord.initialMissingMinutes,
        api: sampleAPIRecord.initialMissingMinutes,
        export: sampleExportRecord.初始缺失分钟数,
        history: sampleHistoryRecord.初始缺失分钟数,
        consistent: (
          (sampleRecord.initialIssue && sampleRecord.initialIssue.missingMinutes ? sampleRecord.initialIssue.missingMinutes : 0)
          === sampleListRecord.initialMissingMinutes &&
          sampleListRecord.initialMissingMinutes === sampleAPIRecord.initialMissingMinutes &&
          sampleAPIRecord.initialMissingMinutes === sampleExportRecord.初始缺失分钟数 &&
          sampleExportRecord.初始缺失分钟数 === sampleHistoryRecord.初始缺失分钟数
        )
      }
    } : {};

    const isConsistent = allCountConsistent && allMissingConsistent && allReviewConsistent;

    return {
      isConsistent,
      summary: {
        totalSourcesVerified: 6,
        display: '页面展示',
        list: '列表',
        api: '接口返回',
        export: '导出明细',
        history: '历史记录',
        report: '报告'
      },
      checks: {
        recordCount: {
          display: displayCount,
          list: listCount,
          api: apiCount,
          export: exportCount,
          history: historyCount,
          report: reportCount,
          consistent: allCountConsistent
        },
        missingTimeCount: {
          display: displayMissingTimeCount,
          list: listMissingTimeCount,
          api: apiMissingTimeCount,
          export: exportMissingTimeCount,
          history: historyMissingTimeCount,
          report: reportMissingTimeCount,
          consistent: allMissingConsistent
        },
        recordsEverHadIssue: {
          display: displayEverIssueCount,
          list: listEverIssueCount,
          api: apiEverIssueCount,
          export: exportEverIssueCount,
          history: historyEverIssueCount,
          report: reportEverIssueCount,
          consistent: allMissingConsistent
        },
        qualityReviewCount: {
          display: displayReviewCount,
          list: listReviewCount,
          api: apiReviewCount,
          export: exportReviewCount,
          history: historyReviewCount,
          report: reportReviewCount,
          consistent: allReviewConsistent
        }
      },
      sampleFieldConsistency: fieldConsistencyChecks,
      guarantee: '列表/详情/摘要/导出/报告/历史 全部从 integratedResults（同一份数据）生成，无独立计算'
    };
  }
}

module.exports = UnifiedDataAccess;
