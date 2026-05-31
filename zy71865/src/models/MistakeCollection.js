const { v4: uuidv4 } = require('uuid');

class MistakeRecord {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.studentId = data.studentId;
    this.studentName = data.studentName || '';
    this.questionNo = data.questionNo;
    this.studentAnswer = data.studentAnswer;
    this.originalJudgment = data.originalJudgment || 'wrong';
    this.manualOverride = data.manualOverride || null;
    this.finalJudgment = data.finalJudgment || data.originalJudgment || 'wrong';
    this.errorType = data.errorType || '';
    this.errorAnalysis = data.errorAnalysis || '';
    this.teacherNotes = data.teacherNotes || '';
    this.reviewStatus = data.reviewStatus || 'pending';
    this.anomalyFlag = data.anomalyFlag || false;
    this.anomalyReason = data.anomalyReason || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  setFinalJudgment(judgment, reason = '') {
    this.manualOverride = judgment;
    this.finalJudgment = judgment;
    this.reviewStatus = 'reviewed';
    if (reason) {
      this.teacherNotes = this.teacherNotes 
        ? `${this.teacherNotes}\n${new Date().toLocaleString()}: ${reason}`
        : `${new Date().toLocaleString()}: ${reason}`;
    }
    this.updatedAt = new Date().toISOString();
  }

  flagAnomaly(reason) {
    this.anomalyFlag = true;
    this.anomalyReason = reason;
    this.updatedAt = new Date().toISOString();
  }

  clearAnomaly() {
    this.anomalyFlag = false;
    this.anomalyReason = '';
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      studentId: this.studentId,
      studentName: this.studentName,
      questionNo: this.questionNo,
      studentAnswer: this.studentAnswer,
      originalJudgment: this.originalJudgment,
      manualOverride: this.manualOverride,
      finalJudgment: this.finalJudgment,
      errorType: this.errorType,
      errorAnalysis: this.errorAnalysis,
      teacherNotes: this.teacherNotes,
      reviewStatus: this.reviewStatus,
      anomalyFlag: this.anomalyFlag,
      anomalyReason: this.anomalyReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class MistakeCollection {
  constructor() {
    this.records = [];
    this.metadata = {
      examName: '',
      className: '',
      examDate: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  load(data) {
    if (data.metadata) {
      this.metadata = { ...this.metadata, ...data.metadata };
    }
    this.records = (data.records || []).map(r => new MistakeRecord(r));
    return this;
  }

  addRecord(recordData) {
    const record = new MistakeRecord(recordData);
    this.records.push(record);
    this.metadata.updatedAt = new Date().toISOString();
    return record;
  }

  findByQuestionNo(questionNo) {
    return this.records.filter(r => r.questionNo === questionNo);
  }

  findByStudentId(studentId) {
    return this.records.filter(r => r.studentId === studentId);
  }

  getAnomalies() {
    return this.records.filter(r => r.anomalyFlag);
  }

  getPendingReview() {
    return this.records.filter(r => r.reviewStatus === 'pending');
  }

  getReviewed() {
    return this.records.filter(r => r.reviewStatus === 'reviewed');
  }

  getStatistics() {
    const total = this.records.length;
    const pending = this.getPendingReview().length;
    const reviewed = this.getReviewed().length;
    const anomalies = this.getAnomalies().length;
    const correctOverride = this.records.filter(r => r.manualOverride === 'correct').length;

    return {
      total,
      pending,
      reviewed,
      anomalies,
      correctOverride,
      progress: total > 0 ? Math.round((reviewed / total) * 100) : 0
    };
  }

  toJSON() {
    return {
      metadata: this.metadata,
      records: this.records.map(r => r.toJSON())
    };
  }
}

module.exports = { MistakeRecord, MistakeCollection };
