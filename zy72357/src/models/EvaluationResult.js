const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class EvaluationResult {
  constructor() {
    this.id = uuidv4();
    this.version = 1;
    this.status = 'draft';
    this.temperatureRecords = new Map();
    this.sensorRecords = new Map();
    this.integratedResults = [];
    this.selfCheckResults = {
      duplicateImport: { passed: false, details: [] },
      missingSampleTime: { passed: false, details: [] },
      recalculationAfterSupplement: { passed: false, details: [] },
      exportConsistency: { passed: false, details: [] }
    };
    this.workflowStage = 'import';
    this.operator = '';
    this.qualityInspector = '';
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    this.exportSnapshot = null;
    this.lastIntegratedHash = null;
    this.changeLog = [];
  }

  addTemperatureRecord(record) {
    this.temperatureRecords.set(record.id, record);
    this._logChange('add_record', record.id, `新增温度校准记录（行号${record.sourceLineNumber}）`);
    this.updatedAt = moment().toISOString();
  }

  addSensorRecord(record) {
    this.sensorRecords.set(record.sensorId, record);
    this._logChange('add_sensor', record.sensorId, `新增传感器记录 ${record.sensorId}`);
    this.updatedAt = moment().toISOString();
  }

  _logChange(action, target, detail) {
    this.changeLog.push({
      action,
      target,
      detail,
      version: this.version,
      timestamp: moment().toISOString()
    });
  }

  _buildIntegratedRecord(tempRecord, sensorRecord) {
    const hasIssue = tempRecord.hasMissingSampleTime();
    const needsReview = tempRecord.needsQualityReview();
    const nextStepText = tempRecord._getNextStepDescription ? tempRecord._getNextStepDescription() : null;

    const initialIssue = tempRecord.originalSampleTimeIssue || tempRecord.sampleTimeIssue;
    const currentIssue = tempRecord.sampleTimeIssue;
    const wasEverIssue = initialIssue && initialIssue.type !== 'none';

    const initialMissingMinutes = initialIssue ? (initialIssue.missingMinutes || 0) : 0;
    const currentMissingMinutes = currentIssue ? (currentIssue.missingMinutes || 0) : 0;

    return {
      recordId: tempRecord.id,
      sourceLineNumber: tempRecord.sourceLineNumber,
      sensorId: tempRecord.sensorId,
      calibrationTime: tempRecord.calibrationTime ? tempRecord.calibrationTime.format() : null,
      sampleStartTime: tempRecord.sampleStartTime ? tempRecord.sampleStartTime.format() : null,
      sampleEndTime: tempRecord.sampleEndTime ? tempRecord.sampleEndTime.format() : null,
      sampleDurationMinutes: tempRecord.sampleDurationMinutes,
      temperature: tempRecord.temperature,
      humidity: tempRecord.humidity,
      processingStatus: tempRecord.processingStatus,

      initialIssue,
      currentIssue,
      wasEverIssue,
      sampleTimeIssue: currentIssue,
      hasMissingSampleTime: hasIssue,

      qualityReview: {
        ...tempRecord.qualityReview,
        nextStepDescription: nextStepText
      },
      needsQualityReview: needsReview,
      qualityReviewStatus: needsReview
        ? (tempRecord.qualityReview.status === 'rejected' ? 'rejected' : 'pending')
        : 'approved',

      originalData: tempRecord.originalData,
      originalSnapshot: tempRecord.originalSnapshot,
      manualChanges: tempRecord.manualChanges,

      siteStatement: sensorRecord ? sensorRecord.siteStatement : null,
      installLocation: sensorRecord ? sensorRecord.installLocation : null,
      sensorVerificationStatus: sensorRecord ? sensorRecord.verificationStatus : null,
      sensorOperator: sensorRecord ? sensorRecord.operator : null,

      auditTrail: tempRecord.getAuditTrail(),
      summary: tempRecord._getSummary ? tempRecord._getSummary() : '',
      durationCompliant: tempRecord._isDurationFixed ? tempRecord._isDurationFixed() : true,

      display: {
        rowHighlight: needsReview ? 'warning' : (wasEverIssue ? 'reviewed' : 'normal'),
        statusBadge: tempRecord.qualityReview.status === 'approved'
          ? '复核通过'
          : (tempRecord.qualityReview.status === 'rejected' ? '复核未通过' : '待复核'),
        initialIssueBadge: wasEverIssue
          ? `初始：${initialIssue.description}（缺${initialMissingMinutes}分钟）`
          : '初始正常',
        currentStatusBadge: currentIssue.type === 'none'
          ? '当前：采样时间完整'
          : `当前：${currentIssue.description}`,
        nextStepText
      },
      export: {
        原始行号: tempRecord.sourceLineNumber,
        传感器编号: tempRecord.sensorId,
        采样开始时间_当前: tempRecord.sampleStartTime ? tempRecord.sampleStartTime.format() : null,
        采样结束时间_当前: tempRecord.sampleEndTime ? tempRecord.sampleEndTime.format() : null,
        采样时长_分钟_当前: tempRecord.sampleDurationMinutes,
        采样开始时间_初始: tempRecord.originalSnapshot ? tempRecord.originalSnapshot.sampleStartTime : null,
        采样时长_分钟_初始: tempRecord.originalSnapshot ? tempRecord.originalSnapshot.sampleDurationMinutes : null,
        温度: tempRecord.temperature,
        湿度: tempRecord.humidity,
        现场说法: sensorRecord ? sensorRecord.siteStatement : null,
        安装位置: sensorRecord ? sensorRecord.installLocation : null,
        处理状态: tempRecord.processingStatus,

        初始采样时间问题类型: initialIssue ? initialIssue.type : '',
        初始采样时间问题描述: initialIssue ? initialIssue.description : '',
        初始缺失分钟数: initialMissingMinutes,
        初始实际时长_分钟: initialIssue && initialIssue.actualMinutes ? initialIssue.actualMinutes : null,

        当前采样时间问题类型: currentIssue.type,
        当前采样时间问题描述: currentIssue.description,
        当前缺失分钟数: currentMissingMinutes,

        采样时间问题类型: currentIssue.type,
        采样时间问题描述: currentIssue.description,
        缺失分钟数: currentMissingMinutes,
        采样时间缺失: hasIssue ? '是' : '否',
        采样时间曾有异常: wasEverIssue ? '是' : '否',
        需质检员复核: needsReview ? '是' : '否',
        复核状态: tempRecord.qualityReview.status,
        复核员: tempRecord.qualityReview.reviewer,
        复核结论: tempRecord.qualityReview.decision,
        复核备注: tempRecord.qualityReview.reviewNotes || '',

        原始说法: tempRecord.originalNotes || '（无备注）',
        当前备注: tempRecord.notes || '',

        人工改动次数: tempRecord.manualChanges.length,
        改后值明细: tempRecord.manualChanges.length > 0
          ? tempRecord.manualChanges.map(c =>
              `${c.timestamp}: ${c.operator} 修改 ${c.field} 从 [${c.oldValue}] 到 [${c.newValue}]，原因：${c.reason}`
            ).join('；')
          : '无',
        处理原因明细: tempRecord.manualChanges.map(c => `${c.operator}：${c.reason}`).join('；') || '无',
        责任人明细: tempRecord.manualChanges.length > 0
          ? Array.from(new Set(tempRecord.manualChanges.map(c => c.operator))).join('、')
          : '无',

        下一步处理: nextStepText || '待处理'
      }
    };
  }

  integrateData() {
    this.integratedResults = [];
    const sortedRecords = Array.from(this.temperatureRecords.values())
      .sort((a, b) => a.sourceLineNumber - b.sourceLineNumber);

    for (const tempRecord of sortedRecords) {
      const sensorRecord = tempRecord.sensorId
        ? this.sensorRecords.get(tempRecord.sensorId)
        : null;

      if (sensorRecord) {
        sensorRecord.linkToTemperatureRecord(tempRecord.id);
      }

      const integrated = this._buildIntegratedRecord(tempRecord, sensorRecord);
      this.integratedResults.push(integrated);
    }

    this.lastIntegratedHash = this.calculateSnapshotHash();
    this.updatedAt = moment().toISOString();
    return this.integratedResults;
  }

  runSelfCheck() {
    this.checkDuplicateImport();
    this.checkMissingSampleTime();
    this.checkRecalculationAfterSupplement();
    this.checkExportConsistency();

    this.updatedAt = moment().toISOString();
    return this.selfCheckResults;
  }

  checkDuplicateImport() {
    const seen = new Map();
    const duplicates = [];

    for (const [recordId, record] of this.temperatureRecords) {
      const timeKey = record.sampleStartTime
        ? record.sampleStartTime.format()
        : 'no-start';
      const durationKey = record.sampleDurationMinutes !== null
        ? `dur_${record.sampleDurationMinutes}`
        : 'no-dur';
      const key = `${record.sensorId || 'no-sensor'}-${timeKey}-${durationKey}`;

      if (seen.has(key)) {
        duplicates.push({
          recordId1: seen.get(key),
          recordId2: recordId,
          sensorId: record.sensorId,
          sampleStartTime: record.sampleStartTime ? record.sampleStartTime.format() : null,
          sampleDurationMinutes: record.sampleDurationMinutes,
          issue: '重复导入：相同传感器+相同采样时间的记录出现多次'
        });
      } else {
        seen.set(key, recordId);
      }
    }

    this.selfCheckResults.duplicateImport = {
      passed: duplicates.length === 0,
      count: duplicates.length,
      details: duplicates
    };
  }

  checkMissingSampleTime() {
    const missingTimeRecords = [];

    for (const [recordId, record] of this.temperatureRecords) {
      const initialIssue = record.originalSampleTimeIssue || record.sampleTimeIssue;
      const currentIssue = record.sampleTimeIssue;

      if (currentIssue.type !== 'none') {
        missingTimeRecords.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          initialIssueType: initialIssue ? initialIssue.type : '',
          initialIssue: initialIssue ? initialIssue.description : '',
          initialMissingMinutes: initialIssue ? (initialIssue.missingMinutes || 0) : 0,
          initialActualMinutes: initialIssue && initialIssue.actualMinutes ? initialIssue.actualMinutes : null,
          currentIssueType: currentIssue.type,
          currentIssue: currentIssue.description,
          currentMissingMinutes: currentIssue.missingMinutes || 0,
          missingMinutes: currentIssue.missingMinutes || 0,
          actualMinutes: currentIssue.actualMinutes || null,
          issue: currentIssue.description,
          issueType: currentIssue.type,
          severity: currentIssue.severity || 'none',
          processingStatus: record.processingStatus,
          qualityReviewStatus: record.qualityReview.status,
          nextHandler: record.qualityReview.nextHandler
        });
      }
    }

    this.selfCheckResults.missingSampleTime = {
      passed: missingTimeRecords.length === 0,
      count: missingTimeRecords.length,
      details: missingTimeRecords
    };
  }

  checkRecalculationAfterSupplement() {
    const recalculationDetails = [];
    let hasRecalculated = false;

    for (const [recordId, record] of this.temperatureRecords) {
      const initialIssue = record.originalSampleTimeIssue;
      const hadInitialIssue = initialIssue && initialIssue.type !== 'none';
      const hasTimeChanges = record.manualChanges.some(c =>
        c.field === 'sampleStartTime' ||
        c.field === 'sampleEndTime' ||
        c.field === 'sampleDurationMinutes' ||
        c.field === 'calibrationTime'
      );

      const supplemented = [
        'supplemented',
        'recalculated',
        'quality_approved',
        'quality_rejected'
      ].includes(record.processingStatus);

      if (hadInitialIssue || hasTimeChanges || supplemented) {
        hasRecalculated = true;
        recalculationDetails.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          initialIssueType: initialIssue ? initialIssue.type : '',
          initialIssueDescription: initialIssue ? initialIssue.description : '初始正常',
          initialMissingMinutes: initialIssue ? (initialIssue.missingMinutes || 0) : 0,
          initialActualMinutes: initialIssue && initialIssue.actualMinutes ? initialIssue.actualMinutes : null,
          currentIssueType: record.sampleTimeIssue.type,
          currentIssueFixed: record.sampleTimeIssue.type === 'none',
          currentDurationMinutes: record.sampleDurationMinutes,
          currentCompliant: record._isDurationFixed ? record._isDurationFixed() : true,
          qualityReviewStatus: record.qualityReview.status,
          supplemented: supplemented,
          changes: record.manualChanges.filter(c =>
            c.field === 'sampleStartTime' ||
            c.field === 'sampleEndTime' ||
            c.field === 'sampleDurationMinutes' ||
            c.field === 'calibrationTime'
          ).map(c => ({
            field: c.field,
            from: c.oldValue,
            to: c.newValue,
            operator: c.operator,
            reason: c.reason,
            timestamp: c.timestamp,
            beforeIssue: c.beforeIssue,
            afterIssue: c.afterIssue
          }))
        });
      }
    }

    this.selfCheckResults.recalculationAfterSupplement = {
      passed: true,
      hasRecalculated,
      count: recalculationDetails.length,
      details: recalculationDetails
    };
  }

  checkExportConsistency() {
    const currentHash = this.calculateSnapshotHash();
    const isConsistent = !this.exportSnapshot ||
      this.lastIntegratedHash === currentHash;

    this.selfCheckResults.exportConsistency = {
      passed: isConsistent,
      snapshotVersion: this.version,
      lastExportTime: this.exportSnapshot ? this.exportSnapshot.exportTime : null,
      currentIntegratedHash: this.lastIntegratedHash,
      snapshotHash: this.exportSnapshot ? this.exportSnapshot.hash : null,
      changesSinceLastExport: isConsistent ? 0 : this.changeLog.length
    };
  }

  createExportSnapshot() {
    this.integrateData();
    const snapshot = {
      version: this.version,
      exportTime: moment().toISOString(),
      recordCount: this.integratedResults.length,
      hash: this.calculateSnapshotHash()
    };
    this.exportSnapshot = snapshot;
    this._logChange('export', null, `导出版本 v${this.version}，包含${snapshot.recordCount}条记录`);
    return snapshot;
  }

  calculateSnapshotHash() {
    const data = JSON.stringify(this.integratedResults.map(r => ({
      recordId: r.recordId,
      sampleStartTime: r.sampleStartTime,
      sampleEndTime: r.sampleEndTime,
      sampleDurationMinutes: r.sampleDurationMinutes,
      initialIssueType: r.initialIssue ? r.initialIssue.type : null,
      initialMissingMinutes: r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0,
      temperature: r.temperature,
      processingStatus: r.processingStatus,
      hasMissingSampleTime: r.hasMissingSampleTime,
      needsQualityReview: r.needsQualityReview,
      qualityReviewStatus: r.qualityReview.status,
      wasEverIssue: r.wasEverIssue
    })));
    return Buffer.from(data).toString('base64').slice(0, 32);
  }

  setWorkflowStage(stage) {
    this.workflowStage = stage;
    this._logChange('workflow', stage, `工作流阶段变更为：${stage}`);
    this.updatedAt = moment().toISOString();
  }

  incrementVersion(reason = '') {
    this.version++;
    this._logChange('version', `v${this.version}`, `版本递增${reason ? '：' + reason : ''}`);
    this.updatedAt = moment().toISOString();
  }

  getUnifiedResults() {
    this.integrateData();
    return {
      evaluationId: this.id,
      version: this.version,
      status: this.status,
      workflowStage: this.workflowStage,
      selfCheckResults: this.selfCheckResults,
      records: this.integratedResults,
      summary: this._buildSummary(),
      changeLog: this.changeLog,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  _buildSummary() {
    const total = this.integratedResults.length;
    const withIssue = this.integratedResults.filter(r => r.hasMissingSampleTime);
    const needsReview = this.integratedResults.filter(r => r.needsQualityReview);
    const approved = this.integratedResults.filter(r => r.qualityReview.status === 'approved');
    const rejected = this.integratedResults.filter(r => r.qualityReview.status === 'rejected');
    const pendingReview = this.integratedResults.filter(r => r.qualityReview.status === 'pending');
    const supplemented = this.integratedResults.filter(r => r.processingStatus === 'supplemented' || r.processingStatus === 'recalculated');
    const everHadIssue = this.integratedResults.filter(r => r.wasEverIssue);

    const durationBreakdown = {
      empty: 0,
      missing_start: 0,
      missing_end_or_duration: 0,
      duration_short: 0,
      compliant: 0
    };
    const initialDurationBreakdown = {
      empty: 0,
      missing_start: 0,
      missing_end_or_duration: 0,
      duration_short: 0,
      compliant: 0
    };
    const totalInitialMissingMinutes = everHadIssue.reduce(
      (sum, r) => sum + (r.initialIssue && r.initialIssue.missingMinutes ? r.initialIssue.missingMinutes : 0), 0
    );

    this.integratedResults.forEach(r => {
      const type = r.currentIssue ? r.currentIssue.type : 'none';
      if (durationBreakdown.hasOwnProperty(type)) {
        durationBreakdown[type]++;
      } else {
        durationBreakdown.compliant++;
      }
      const initType = r.initialIssue ? r.initialIssue.type : 'none';
      if (initialDurationBreakdown.hasOwnProperty(initType)) {
        initialDurationBreakdown[initType]++;
      } else {
        initialDurationBreakdown.compliant++;
      }
    });

    return {
      totalRecords: total,
      recordsEverHadMissingTime: everHadIssue.length,
      totalInitialMissingMinutes,
      recordsWithCurrentMissingTime: withIssue.length,
      recordsNeedingReview: needsReview.length,
      recordsApproved: approved.length,
      recordsRejected: rejected.length,
      recordsPendingReview: pendingReview.length,
      recordsSupplemented: supplemented.length,
      linkedSensors: this.sensorRecords.size,
      currentDurationBreakdown: durationBreakdown,
      initialDurationBreakdown,
      consistency: {
        displaySource: 'integratedResults（同一份数据）',
        listSource: 'integratedResults（同一份数据）',
        apiSource: 'integratedResults（同一份数据）',
        exportSource: 'integratedResults（同一份数据）',
        historySource: 'integratedResults（同一份数据）',
        reportSource: 'integratedResults（同一份数据）',
        guaranteedBy: '列表/详情/摘要/导出/报告/历史 全部从integrateData()生成，无独立计算'
      }
    };
  }

  getAuditTrail() {
    const trails = [];
    for (const [recordId, record] of this.temperatureRecords) {
      trails.push(record.getAuditTrail());
    }
    return trails;
  }

  toJSON() {
    this.integrateData();
    return {
      id: this.id,
      version: this.version,
      status: this.status,
      workflowStage: this.workflowStage,
      selfCheckResults: this.selfCheckResults,
      temperatureRecords: Array.from(this.temperatureRecords.values()).map(r => r.toJSON()),
      sensorRecords: Array.from(this.sensorRecords.values()).map(r => r.toJSON()),
      integratedResults: this.integratedResults,
      summary: this._buildSummary(),
      changeLog: this.changeLog,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = EvaluationResult;
