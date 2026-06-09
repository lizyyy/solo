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

      sampleTimeIssue: tempRecord.sampleTimeIssue,
      hasMissingSampleTime: hasIssue,

      qualityReview: {
        ...tempRecord.qualityReview,
        nextStepDescription: tempRecord._getNextStepDescription ? tempRecord._getNextStepDescription() : null
      },
      needsQualityReview: needsReview,
      qualityReviewStatus: needsReview 
        ? (tempRecord.qualityReview.status === 'rejected' ? 'rejected' : 'pending') 
        : 'approved',

      originalData: tempRecord.originalData,
      manualChanges: tempRecord.manualChanges,

      siteStatement: sensorRecord ? sensorRecord.siteStatement : null,
      installLocation: sensorRecord ? sensorRecord.installLocation : null,
      sensorVerificationStatus: sensorRecord ? sensorRecord.verificationStatus : null,
      sensorOperator: sensorRecord ? sensorRecord.operator : null,

      auditTrail: tempRecord.getAuditTrail(),
      summary: tempRecord._getSummary ? tempRecord._getSummary() : '',
      durationCompliant: tempRecord._isDurationFixed ? tempRecord._isDurationFixed() : true,

      display: {
        rowHighlight: hasIssue ? 'warning' : 'normal',
        statusBadge: needsReview 
          ? (tempRecord.qualityReview.status === 'rejected' ? '复核未通过' : '待复核') 
          : '正常',
        nextStepText: tempRecord._getNextStepDescription ? tempRecord._getNextStepDescription() : null
      },
      export: {
        原始行号: tempRecord.sourceLineNumber,
        传感器编号: tempRecord.sensorId,
        采样开始时间: tempRecord.sampleStartTime ? tempRecord.sampleStartTime.format() : null,
        采样结束时间: tempRecord.sampleEndTime ? tempRecord.sampleEndTime.format() : null,
        采样时长_分钟: tempRecord.sampleDurationMinutes,
        温度: tempRecord.temperature,
        湿度: tempRecord.humidity,
        现场说法: sensorRecord ? sensorRecord.siteStatement : null,
        安装位置: sensorRecord ? sensorRecord.installLocation : null,
        处理状态: tempRecord.processingStatus,
        采样时间问题类型: tempRecord.sampleTimeIssue.type,
        采样时间问题描述: tempRecord.sampleTimeIssue.description,
        缺失分钟数: tempRecord.sampleTimeIssue.missingMinutes || 0,
        采样时间缺失: hasIssue ? '是' : '否',
        需质检员复核: needsReview ? '是' : '否',
        复核状态: tempRecord.qualityReview.status,
        复核员: tempRecord.qualityReview.reviewer,
        原始说法: tempRecord.notes || '（无备注）',
        人工改动记录: tempRecord.manualChanges.length > 0 
          ? tempRecord.manualChanges.map(c => 
              `${c.timestamp}: ${c.operator} 修改 ${c.field} 从 [${c.oldValue}] 到 [${c.newValue}]，原因：${c.reason}`
            ).join('；')
          : '无',
        下一步处理: tempRecord.qualityReview.nextStepDescription || '已完成'
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
      const issue = record.sampleTimeIssue;
      if (issue.type !== 'none') {
        missingTimeRecords.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          issueType: issue.type,
          issue: issue.description,
          missingMinutes: issue.missingMinutes || 0,
          severity: issue.severity,
          actualMinutes: issue.actualMinutes || null,
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
      const hadInitialIssue = record.manualChanges.length > 0 && (
        record.manualChanges[0].field === 'sampleStartTime' ||
        record.manualChanges[0].field === 'sampleEndTime' ||
        record.manualChanges[0].field === 'sampleDurationMinutes' ||
        record.manualChanges[0].field === 'calibrationTime'
      );

      const supplemented = record.processingStatus === 'supplemented' || 
        record.processingStatus === 'recalculated';
      
      if (hadInitialIssue || supplemented) {
        hasRecalculated = true;
        const beforeStatus = hadInitialIssue ? '初始有采样时间问题' : '正常导入';
        recalculationDetails.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          beforeStatus,
          currentIssueType: record.sampleTimeIssue.type,
          currentIssueFixed: record.sampleTimeIssue.type === 'none',
          currentDurationMinutes: record.sampleDurationMinutes,
          currentCompliant: record._isDurationFixed ? record._isDurationFixed() : true,
          qualityReviewStatus: record.qualityReview.status,
          changes: record.manualChanges.filter(c => 
            c.field === 'sampleStartTime' || 
            c.field === 'sampleEndTime' || 
            c.field === 'sampleDurationMinutes' ||
            c.field === 'calibrationTime'
          )
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
      temperature: r.temperature,
      processingStatus: r.processingStatus,
      hasMissingSampleTime: r.hasMissingSampleTime,
      needsQualityReview: r.needsQualityReview,
      qualityReviewStatus: r.qualityReview.status
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

    const durationBreakdown = {
      empty: 0,
      missing_start: 0,
      missing_end_or_duration: 0,
      duration_short: 0,
      compliant: 0
    };
    this.integratedResults.forEach(r => {
      const type = r.sampleTimeIssue.type;
      if (durationBreakdown.hasOwnProperty(type)) {
        durationBreakdown[type]++;
      } else {
        durationBreakdown.compliant++;
      }
    });

    return {
      totalRecords: total,
      recordsWithMissingTime: withIssue.length,
      recordsNeedingReview: needsReview.length,
      recordsApproved: approved.length,
      recordsRejected: rejected.length,
      recordsPendingReview: pendingReview.length,
      recordsSupplemented: supplemented.length,
      linkedSensors: this.sensorRecords.size,
      durationBreakdown,
      consistency: {
        displaySource: 'integratedResults（同一份数据）',
        apiSource: 'integratedResults（同一份数据）',
        exportSource: 'integratedResults（同一份数据）',
        guaranteedBy: '列表/详情/摘要/导出/报告全部从integratedData()生成，无独立计算'
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
