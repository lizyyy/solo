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

    const summary = evaluation._buildSummary();

    const summaryRow = {
      评估ID: evaluation.id,
      版本: `v${evaluation.version}`,
      工作流阶段: evaluation.workflowStage,
      导出时间: moment().format('YYYY-MM-DD HH:mm:ss'),
      总记录数: summary.totalRecords,
      曾有采样时间问题记录数: summary.recordsEverHadMissingTime,
      初始累计缺失分钟数: summary.totalInitialMissingMinutes,
      当前仍有问题记录数: summary.recordsWithCurrentMissingTime,
      需质检员复核: summary.recordsNeedingReview,
      复核通过数: summary.recordsApproved,
      复核待处理数: summary.recordsPendingReview,
      复核未通过数: summary.recordsRejected,
      关联传感器数: summary.linkedSensors
    };

    const detailRows = evaluation.integratedResults.map(r => ({
      ...r.export
    }));

    const historyRows = evaluation.integratedResults.map(r => ({
      原始行号: r.sourceLineNumber,
      传感器编号: r.sensorId,
      原始说法: r.auditTrail.originalStatement,
      初始问题: r.initialIssue ? r.initialIssue.description : '（初始正常）',
      初始问题类型: r.initialIssue ? r.initialIssue.type : 'none',
      初始实际时长_分钟: r.initialIssue && r.initialIssue.actualMinutes ? r.initialIssue.actualMinutes : (r.originalSnapshot ? r.originalSnapshot.sampleDurationMinutes : null),
      初始缺失分钟数: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
      缺失分钟数: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
      当前处理状态: r.processingStatus,
      当前问题: r.currentIssue.description,
      当前问题类型: r.currentIssue.type,
      当前缺失分钟数: r.currentIssue.missingMinutes || 0,
      是否曾有异常: r.wasEverIssue ? '是' : '否',
      人工改动次数: r.manualChanges.length,
      最后一次改动: r.manualChanges.length > 0
        ? `${r.manualChanges[r.manualChanges.length - 1].operator} 修改 ${r.manualChanges[r.manualChanges.length - 1].field}`
        : '无',
      复核状态: r.qualityReview.status,
      复核员: r.qualityReview.reviewer || '—',
      复核结论: r.qualityReview.decision || '—',
      复核备注: r.qualityReview.reviewNotes || '（无）',
      下一步找谁: r.qualityReview.nextHandler || '—',
      下一步处理: r.qualityReview.nextStepDescription || '待处理'
    }));

    const reportRows = evaluation.integratedResults.map(r => {
      const initialMissing = r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0;
      const initialActual = r.initialIssue && r.initialIssue.actualMinutes
        ? r.initialIssue.actualMinutes
        : (r.originalSnapshot ? r.originalSnapshot.sampleDurationMinutes : null);
      return {
        原始行号: r.sourceLineNumber,
        传感器编号: r.sensorId,
        现场说法: r.siteStatement || '—',
        安装位置: r.installLocation || '—',
        采样时间_初始: r.originalSnapshot
          ? `${r.originalSnapshot.sampleStartTime || '（未填）'} | ${initialActual !== null ? initialActual + '分钟' : '（未填时长）'}`
          : '—',
        采样时间_当前: `${r.sampleStartTime || '（未填）'} | ${r.sampleDurationMinutes !== null ? r.sampleDurationMinutes + '分钟' : '（未填时长）'}`,
        初始问题描述: r.initialIssue ? r.initialIssue.description : '初始正常',
        初始缺失分钟数: initialMissing,
        是否曾有异常: r.wasEverIssue ? '是' : '否',
        当前处理结论: r.wasEverIssue
          ? (r.currentIssue.type === 'none'
            ? '已补录，待/已复核'
            : '补录后仍有问题')
          : '无异常',
        复核状态: r.qualityReview.status,
        复核员: r.qualityReview.reviewer || '待指定',
        是否纳入正常结果: r.qualityReview.status === 'approved' ? '是' : '否',
        证据链_原始说法: r.auditTrail.originalStatement,
        证据链_改后值: r.manualChanges.length > 0
          ? r.manualChanges.map(c => `${c.field}: ${c.oldValue}→${c.newValue}`).join('；')
          : '（未改动）',
        证据链_处理原因: r.manualChanges.length > 0
          ? r.manualChanges.map(c => `${c.operator}：${c.reason}`).join('；')
          : '—',
        证据链_责任人: r.manualChanges.length > 0
          ? Array.from(new Set(r.manualChanges.map(c => c.operator))).join('、')
          : (r.qualityReview.reviewer || '—'),
        证据链_复核备注: r.qualityReview.reviewNotes || '（无）',
        下一步处理: r.qualityReview.nextStepDescription || '待处理'
      };
    });

    const summaryCounters = {
      ...summaryRow,
      持续时间达标数: evaluation.integratedResults.filter(r => r.durationCompliant).length,
      持续时间不足数: evaluation.integratedResults.filter(r => !r.durationCompliant).length,
      补录过的记录数: summary.recordsSupplemented
    };

    return {
      summary: summaryCounters,
      details: detailRows,
      history: historyRows,
      report: reportRows,
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
      dataConsistencyNote: '重要：本导出明细、列表展示、接口返回、历史记录、审计报告 均源自 EvaluationResult.integratedResults（同一份最新数据），无独立计算逻辑，保证6处完全一致'
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
        initialIssueType: r.initialIssue ? r.initialIssue.type : 'none',
        initialIssueText: r.initialIssue ? r.initialIssue.description : '初始正常',
        initialMissingMinutes: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
        sampleStartTime: r.sampleStartTime,
        sampleDurationMinutes: r.sampleDurationMinutes,
        temperature: r.temperature,
        issueType: r.currentIssue.type,
        issueText: r.currentIssue.description,
        missingMinutes: r.currentIssue.missingMinutes || 0,
        wasEverIssue: r.wasEverIssue,
        hasIssue: r.hasMissingSampleTime,
        needsReview: r.needsQualityReview,
        reviewStatus: r.qualityReview.status,
        processingStatus: r.processingStatus,
        displayBadge: r.display.statusBadge,
        initialBadge: r.display.initialIssueBadge,
        currentStatusBadge: r.display.currentStatusBadge,
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

    const initialMissing = record.initialIssue && record.initialIssue.missingMinutes
      ? record.initialIssue.missingMinutes
      : 0;
    const initialActual = record.initialIssue && record.initialIssue.actualMinutes
      ? record.initialIssue.actualMinutes
      : (record.originalSnapshot ? record.originalSnapshot.sampleDurationMinutes : null);

    return {
      ...record,
      initialIssueDetail: {
        type: record.initialIssue ? record.initialIssue.type : 'none',
        description: record.initialIssue ? record.initialIssue.description : '初始正常',
        missingMinutes: initialMissing,
        actualMinutes: initialActual
      },
      sourceData: {
        originalRow: record.sourceLineNumber,
        originalInput: record.originalData,
        originalSnapshot: record.originalSnapshot,
        originalStatement: record.auditTrail.originalStatement,
        initialMissingMinutes: initialMissing,
        initialActualMinutes: initialActual,
        correctedValue: record.manualChanges.length > 0
          ? { field: record.manualChanges[record.manualChanges.length - 1].field, value: record.manualChanges[record.manualChanges.length - 1].newValue }
          : null,
        processingReason: record.manualChanges.length > 0
          ? record.manualChanges[record.manualChanges.length - 1].reason
          : null,
        allCorrections: record.manualChanges,
        handlerList: Array.from(new Set(record.manualChanges.map(c => c.operator))),
        nextHandler: record.qualityReview.nextHandler,
        nextAction: record.qualityReview.nextStepDescription,
        reviewNotes: record.qualityReview.reviewNotes,
        reviewer: record.qualityReview.reviewer
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
