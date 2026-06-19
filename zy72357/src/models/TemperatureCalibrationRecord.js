const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const MIN_SAMPLE_DURATION_MINUTES = 30;

class TemperatureCalibrationRecord {
  constructor(data, sourceLineNumber) {
    this.id = uuidv4();
    this.sourceLineNumber = sourceLineNumber;
    this.originalData = { ...data };
    this.originalNotes = data.notes || '';
    this.manualChanges = [];
    this.sensorId = data.sensorId || null;

    this.sampleStartTime = data.sampleStartTime
      ? moment(data.sampleStartTime)
      : (data.calibrationTime ? moment(data.calibrationTime) : null);

    this.sampleEndTime = data.sampleEndTime
      ? moment(data.sampleEndTime)
      : (data.calibrationEndTime ? moment(data.calibrationEndTime) : null);

    this.sampleDurationMinutes = data.sampleDurationMinutes
      ? Number(data.sampleDurationMinutes)
      : this._calculateDurationMinutes();

    const originalStartTime = this.sampleStartTime ? this.sampleStartTime.clone() : null;
    const originalEndTime = this.sampleEndTime ? this.sampleEndTime.clone() : null;
    const originalDurationMinutes = this.sampleDurationMinutes;
    this.originalSnapshot = {
      sampleStartTime: originalStartTime ? originalStartTime.format() : null,
      sampleEndTime: originalEndTime ? originalEndTime.format() : null,
      sampleDurationMinutes: originalDurationMinutes,
      notes: this.originalNotes
    };

    this.calibrationTime = this.sampleStartTime;
    this.temperature = data.temperature || null;
    this.humidity = data.humidity || null;
    this.processingStatus = 'pending';
    this.importBatchId = data.importBatchId || null;
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    this.notes = data.notes || '';

    this.qualityReview = {
      required: false,
      status: 'not_required',
      reviewer: null,
      decision: null,
      reviewNotes: '',
      reviewedAt: null,
      nextAction: null,
      nextHandler: null
    };

    this.sampleTimeIssue = this._detectSampleTimeIssue();
    this.originalSampleTimeIssue = { ...this.sampleTimeIssue };
    if (this.sampleTimeIssue.type !== 'none') {
      this.qualityReview.required = true;
      this.qualityReview.status = 'pending';
      this.qualityReview.nextAction = '质检员复核采样时间问题';
      this.qualityReview.nextHandler = '质检员';
    }
  }

  _calculateDurationMinutes() {
    if (this.sampleStartTime && this.sampleEndTime) {
      return this.sampleEndTime.diff(this.sampleStartTime, 'minutes');
    }
    return null;
  }

  _detectSampleTimeIssue() {
    if (!this.sampleStartTime && !this.sampleEndTime) {
      return {
        type: 'empty',
        description: '采样时间完全缺失（开始和结束时间均为空）',
        missingMinutes: MIN_SAMPLE_DURATION_MINUTES,
        severity: 'high'
      };
    }

    if (!this.sampleStartTime) {
      return {
        type: 'missing_start',
        description: '缺少采样开始时间',
        missingMinutes: MIN_SAMPLE_DURATION_MINUTES,
        severity: 'high'
      };
    }

    if (!this.sampleEndTime && this.sampleDurationMinutes === null) {
      return {
        type: 'missing_end_or_duration',
        description: '缺少采样结束时间且未提供时长，无法确认采样是否满足30分钟要求',
        missingMinutes: MIN_SAMPLE_DURATION_MINUTES,
        severity: 'medium'
      };
    }

    const duration = this.sampleDurationMinutes !== null
      ? this.sampleDurationMinutes
      : this._calculateDurationMinutes();

    if (duration !== null && duration < MIN_SAMPLE_DURATION_MINUTES) {
      return {
        type: 'duration_short',
        description: `采样时长不足30分钟（仅${duration}分钟），缺${MIN_SAMPLE_DURATION_MINUTES - duration}分钟`,
        actualMinutes: duration,
        missingMinutes: MIN_SAMPLE_DURATION_MINUTES - duration,
        severity: 'high'
      };
    }

    return {
      type: 'none',
      description: '采样时间完整且满足30分钟要求'
    };
  }

  updateField(field, value, operator, reason) {
    const oldValue = this[field];
    let processedValue = value;

    if ((field === 'sampleStartTime' || field === 'sampleEndTime' || field === 'calibrationTime') && value) {
      processedValue = moment(value);
    }

    if (field === 'sampleDurationMinutes') {
      processedValue = Number(value);
    }

    let oldDisplayValue = oldValue ? (oldValue.format ? oldValue.format() : String(oldValue)) : null;
    let newDisplayValue = processedValue ? (processedValue.format ? processedValue.format() : String(processedValue)) : null;

    const issueBeforeChange = { ...this.sampleTimeIssue };

    this[field] = processedValue;

    if (field === 'sampleStartTime' || field === 'calibrationTime') {
      this.sampleStartTime = processedValue;
      this.calibrationTime = processedValue;
    }
    if (field === 'sampleEndTime') {
      this.sampleEndTime = processedValue;
    }
    if (field === 'sampleDurationMinutes') {
      this.sampleDurationMinutes = processedValue;
    }
    if (field === 'sampleStartTime' || field === 'sampleEndTime' || field === 'sampleDurationMinutes') {
      if (this.sampleDurationMinutes === null && this.sampleStartTime && this.sampleEndTime) {
        this.sampleDurationMinutes = this.sampleEndTime.diff(this.sampleStartTime, 'minutes');
      }
      this.sampleTimeIssue = this._detectSampleTimeIssue();
      this._updateQualityReviewStatus();
    }

    this.manualChanges.push({
      field,
      oldValue: oldDisplayValue,
      newValue: newDisplayValue,
      operator,
      reason,
      beforeIssue: issueBeforeChange,
      afterIssue: { ...this.sampleTimeIssue },
      timestamp: moment().toISOString()
    });
    this.updatedAt = moment().toISOString();
  }

  _updateQualityReviewStatus() {
    const hadIssue = this.sampleTimeIssue.type !== 'none';
    if (hadIssue) {
      this.qualityReview.required = true;
      if (this.qualityReview.status === 'not_required') {
        this.qualityReview.status = 'pending';
      }
      this.qualityReview.nextAction = '补录完成，待质检员确认修正结果';
      this.qualityReview.nextHandler = '质检员';
    } else {
      if (this.qualityReview.status !== 'approved' && this.qualityReview.status !== 'rejected') {
        this.qualityReview.nextAction = '时长已达标，仍需质检员复核后归正常';
        this.qualityReview.nextHandler = '质检员';
      }
    }
  }

  setProcessingStatus(status) {
    this.processingStatus = status;
    this.updatedAt = moment().toISOString();
  }

  setQualityReview(reviewer, decision, notes = '') {
    this.qualityReview.reviewer = reviewer;
    this.qualityReview.decision = decision;
    this.qualityReview.reviewNotes = notes;
    this.qualityReview.reviewedAt = moment().toISOString();

    if (decision === 'approve') {
      this.qualityReview.status = 'approved';
      this.qualityReview.required = this.sampleTimeIssue.type !== 'none' && !this._isDurationFixed();
      this.qualityReview.nextAction = this.qualityReview.required ? '仍存在采样时间问题，请补录后再复核' : null;
      this.qualityReview.nextHandler = this.qualityReview.required ? '训练教练（补录）' : null;
    } else if (decision === 'reject') {
      this.qualityReview.status = 'rejected';
      this.qualityReview.required = true;
      this.qualityReview.nextAction = '复核未通过，请补录采样时间后重新提交';
      this.qualityReview.nextHandler = '训练教练（补录）';
    }

    this.updatedAt = moment().toISOString();
  }

  _isDurationFixed() {
    if (this.sampleTimeIssue.type === 'none') return true;

    if (this.sampleDurationMinutes !== null) {
      return this.sampleDurationMinutes >= MIN_SAMPLE_DURATION_MINUTES;
    }
    if (this.sampleStartTime && this.sampleEndTime) {
      return this.sampleEndTime.diff(this.sampleStartTime, 'minutes') >= MIN_SAMPLE_DURATION_MINUTES;
    }
    return false;
  }

  hasMissingSampleTime() {
    return this.sampleTimeIssue.type !== 'none'
      || this.qualityReview.status === 'pending'
      || this.qualityReview.status === 'rejected';
  }

  needsQualityReview() {
    return this.qualityReview.required && this.qualityReview.status !== 'approved';
  }

  getAuditTrail() {
    return {
      id: this.id,
      sourceLineNumber: this.sourceLineNumber,
      originalData: {
        ...this.originalData,
        sampleStartTime: this.originalData.sampleStartTime || this.originalData.calibrationTime || null,
        sampleEndTime: this.originalData.sampleEndTime || this.originalData.calibrationEndTime || null,
        sampleDurationMinutes: this.originalData.sampleDurationMinutes || null
      },
      originalSnapshot: this.originalSnapshot,
      originalStatement: this.originalNotes || '（原始记录无备注）',
      initialIssue: this.originalSampleTimeIssue,
      currentIssue: this.sampleTimeIssue,
      manualChanges: this.manualChanges.map(c => ({
        field: c.field,
        originalValue: c.oldValue,
        correctedValue: c.newValue,
        operator: c.operator,
        processingReason: c.reason,
        beforeIssue: c.beforeIssue,
        afterIssue: c.afterIssue,
        timestamp: c.timestamp
      })),
      processingStatus: this.processingStatus,
      qualityReview: {
        ...this.qualityReview,
        currentNextStep: this._getNextStepDescription()
      },
      summary: this._getSummary(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  _getNextStepDescription() {
    if (this.qualityReview.status === 'approved') {
      return '已通过质检员复核，可纳入正常结果';
    }
    if (this.qualityReview.status === 'rejected') {
      return '复核未通过，请联系训练教练补录';
    }
    if (this.qualityReview.status === 'pending') {
      return `等待${this.qualityReview.nextHandler || '质检员'}：${this.qualityReview.nextAction || '完成复核'}`;
    }
    return null;
  }

  _getSummary() {
    const parts = [];
    parts.push(`原始行号：${this.sourceLineNumber}`);
    if (this.sensorId) parts.push(`传感器：${this.sensorId}`);
    if (this.originalSampleTimeIssue.type !== 'none') {
      parts.push(`初始问题：${this.originalSampleTimeIssue.description}`);
      if (this.originalSampleTimeIssue.missingMinutes) {
        parts.push(`初始缺${this.originalSampleTimeIssue.missingMinutes}分钟`);
      }
    }
    if (this.sampleTimeIssue.type !== this.originalSampleTimeIssue.type) {
      parts.push(`当前状态：${this.sampleTimeIssue.description}`);
    }
    if (this.manualChanges.length > 0) {
      const lastChange = this.manualChanges[this.manualChanges.length - 1];
      parts.push(`最近改动：${lastChange.operator}于${moment(lastChange.timestamp).format('MM-DD HH:mm')}修改${lastChange.field}`);
    }
    return parts.join(' | ');
  }

  toJSON() {
    return {
      id: this.id,
      sourceLineNumber: this.sourceLineNumber,
      sensorId: this.sensorId,
      sampleStartTime: this.sampleStartTime ? this.sampleStartTime.format() : null,
      sampleEndTime: this.sampleEndTime ? this.sampleEndTime.format() : null,
      sampleDurationMinutes: this.sampleDurationMinutes,
      calibrationTime: this.calibrationTime ? this.calibrationTime.format() : null,
      temperature: this.temperature,
      humidity: this.humidity,
      processingStatus: this.processingStatus,
      importBatchId: this.importBatchId,
      notes: this.notes,
      originalNotes: this.originalNotes,
      originalSnapshot: this.originalSnapshot,
      sampleTimeIssue: this.sampleTimeIssue,
      originalSampleTimeIssue: this.originalSampleTimeIssue,
      qualityReview: {
        ...this.qualityReview,
        nextStepDescription: this._getNextStepDescription()
      },
      hasMissingSampleTime: this.hasMissingSampleTime(),
      needsQualityReview: this.needsQualityReview(),
      durationCompliant: this._isDurationFixed(),
      manualChanges: this.manualChanges,
      originalData: this.originalData,
      summary: this._getSummary(),
      auditTrail: {
        originalStatement: this.originalNotes || '（原始记录无备注）',
        correctedValues: this.manualChanges.length > 0 ? this.manualChanges[this.manualChanges.length - 1] : null,
        processingReasons: this.manualChanges.map(c => `${c.operator}: ${c.reason}`),
        nextHandler: this.qualityReview.nextHandler,
        initialIssue: this.originalSampleTimeIssue,
        initialMissingMinutes: this.originalSampleTimeIssue.missingMinutes || 0,
        reviewNotes: this.qualityReview.reviewNotes,
        reviewer: this.qualityReview.reviewer
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TemperatureCalibrationRecord;
