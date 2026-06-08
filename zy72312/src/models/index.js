import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

export class StudentAnswer {
  constructor(data) {
    this.studentId = data.studentId;
    this.studentName = data.studentName;
    this.answerId = data.answerId;
    this.version = data.version || 1;
    this.points = data.points || [];
    this.calculatedArea = data.calculatedArea || 0;
    this.submittedAt = data.submittedAt || new Date().toISOString();
    this.source = data.source;
  }

  toJSON() {
    return {
      studentId: this.studentId,
      studentName: this.studentName,
      answerId: this.answerId,
      version: this.version,
      points: this.points,
      calculatedArea: this.calculatedArea,
      submittedAt: this.submittedAt,
      source: this.source
    };
  }
}

export class ManualCounterExample {
  constructor(data) {
    this.id = data.id;
    this.studentId = data.studentId;
    this.answerId = data.answerId;
    this.issues = data.issues || [];
    this.expectedArea = data.expectedArea;
    this.actualArea = data.actualArea;
    this.reviewer = data.reviewer;
    this.reviewedAt = data.reviewedAt || new Date().toISOString();
    this.notes = data.notes || '';
    this.sourceType = 'manual';
  }

  toJSON() {
    return {
      id: this.id,
      studentId: this.studentId,
      answerId: this.answerId,
      issues: this.issues,
      expectedArea: this.expectedArea,
      actualArea: this.actualArea,
      reviewer: this.reviewer,
      reviewedAt: this.reviewedAt,
      notes: this.notes,
      sourceType: this.sourceType
    };
  }
}

export class QuestionnaireRow {
  constructor(data) {
    this.id = data.id;
    this.studentId = data.studentId;
    this.answerId = data.answerId;
    this.siteStatement = data.siteStatement || '';
    this.sitePhotos = data.sitePhotos || [];
    this.measurementData = data.measurementData || {};
    this.interviewer = data.interviewer || '';
    this.interviewedAt = data.interviewedAt || new Date().toISOString();
    this.additionalNotes = data.additionalNotes || '';
    this.sourceType = 'questionnaire';
  }

  toJSON() {
    return {
      id: this.id,
      studentId: this.studentId,
      answerId: this.answerId,
      siteStatement: this.siteStatement,
      sitePhotos: this.sitePhotos,
      measurementData: this.measurementData,
      interviewer: this.interviewer,
      interviewedAt: this.interviewedAt,
      additionalNotes: this.additionalNotes,
      sourceType: this.sourceType
    };
  }
}

export class ReviewRecord {
  constructor(data) {
    this.id = data.id;
    this.studentId = data.studentId;
    this.answerId = data.answerId;
    this.status = data.status || 'pending';
    this.geometryAnalysis = data.geometryAnalysis || null;
    this.manualExample = data.manualExample || null;
    this.questionnaire = data.questionnaire || null;
    this.errorAnalysis = data.errorAnalysis || '';
    this.nextStep = data.nextStep || '';
    this.nextStepDetail = data.nextStepDetail || '';
    this.assignedTo = data.assignedTo || '';
    this.hasMultipleVersions = data.hasMultipleVersions || false;
    this.versions = data.versions || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.reviewHistory = data.reviewHistory || [];
    this.snapshotBefore = null;
  }

  snapshot() {
    return {
      status: this.status,
      errorAnalysis: this.errorAnalysis,
      nextStep: this.nextStep,
      nextStepDetail: this.nextStepDetail,
      assignedTo: this.assignedTo,
      manualExample: this.manualExample ? '存在' : '缺失',
      questionnaire: this.questionnaire ? '存在' : '缺失'
    };
  }

  addHistoryEntry(entry) {
    const now = new Date().toISOString();
    const fullEntry = {
      timestamp: now,
      snapshotBefore: this.snapshotBefore,
      ...entry
    };
    if (entry.snapshotAfter !== undefined) {
      fullEntry.snapshotAfter = entry.snapshotAfter;
    }
    this.reviewHistory.push(fullEntry);
    this.updatedAt = now;
    this.snapshotBefore = null;
  }

  markForHistory() {
    this.snapshotBefore = this.snapshot();
  }

  toJSON() {
    return {
      id: this.id,
      studentId: this.studentId,
      answerId: this.answerId,
      status: this.status,
      geometryAnalysis: this.geometryAnalysis,
      manualExample: this.manualExample,
      questionnaire: this.questionnaire,
      errorAnalysis: this.errorAnalysis,
      nextStep: this.nextStep,
      nextStepDetail: this.nextStepDetail,
      assignedTo: this.assignedTo,
      hasMultipleVersions: this.hasMultipleVersions,
      versions: this.versions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      reviewHistory: this.reviewHistory
    };
  }
}

export class DataStore {
  constructor() {
    this.studentAnswers = [];
    this.manualExamples = [];
    this.questionnaires = [];
    this.reviewRecords = [];
  }

  loadFromFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      return;
    }

    const answersPath = path.join(DATA_DIR, 'student-answers.json');
    const manualPath = path.join(DATA_DIR, 'manual-examples.json');
    const questionnairePath = path.join(DATA_DIR, 'questionnaires.json');
    const recordsPath = path.join(DATA_DIR, 'review-records.json');

    if (fs.existsSync(answersPath)) {
      const data = JSON.parse(fs.readFileSync(answersPath, 'utf-8'));
      this.studentAnswers = data.map(d => new StudentAnswer(d));
    }

    if (fs.existsSync(manualPath)) {
      const data = JSON.parse(fs.readFileSync(manualPath, 'utf-8'));
      this.manualExamples = data.map(d => new ManualCounterExample(d));
    }

    if (fs.existsSync(questionnairePath)) {
      const data = JSON.parse(fs.readFileSync(questionnairePath, 'utf-8'));
      this.questionnaires = data.map(d => new QuestionnaireRow(d));
    }

    if (fs.existsSync(recordsPath)) {
      const data = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
      this.reviewRecords = data.map(d => new ReviewRecord(d));
    }
  }

  saveToFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(
      path.join(DATA_DIR, 'student-answers.json'),
      JSON.stringify(this.studentAnswers.map(a => a.toJSON()),
      null, 2)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'manual-examples.json'),
      JSON.stringify(this.manualExamples.map(e => e.toJSON()),
      null, 2)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'questionnaires.json'),
      JSON.stringify(this.questionnaires.map(q => q.toJSON()),
      null, 2)
    );
    fs.writeFileSync(
      path.join(DATA_DIR, 'review-records.json'),
      JSON.stringify(this.reviewRecords.map(r => r.toJSON()),
      null, 2)
    );
  }

  addStudentAnswer(answer) {
    const existing = this.studentAnswers.find(
      a => a.studentId === answer.studentId &&
           a.answerId === answer.answerId &&
           a.version === answer.version
    );
    if (!existing) {
      this.studentAnswers.push(new StudentAnswer(answer));
      return true;
    }
    return false;
  }

  addManualExample(example) {
    this.manualExamples.push(new ManualCounterExample(example));
  }

  addQuestionnaire(questionnaire) {
    this.questionnaires.push(new QuestionnaireRow(questionnaire));
  }

  addReviewRecord(record) {
    this.reviewRecords.push(new ReviewRecord(record));
  }

  getStudentAnswersByStudent(studentId) {
    return this.studentAnswers.filter(a => a.studentId === studentId);
  }

  getAnswersByStudentAndAnswer(studentId, answerId) {
    return this.studentAnswers.filter(
      a => a.studentId === studentId && a.answerId === answerId
    );
  }

  getManualExample(studentId, answerId) {
    return this.manualExamples.find(
      e => e.studentId === studentId && e.answerId === answerId
    );
  }

  getQuestionnaire(studentId, answerId) {
    return this.questionnaires.find(
      q => q.studentId === studentId && q.answerId === answerId
    );
  }

  getReviewRecord(id) {
    return this.reviewRecords.find(r => r.id === id);
  }

  getAllReviewRecords() {
    return this.reviewRecords;
  }

  updateReviewRecord(id, updates) {
    const record = this.reviewRecords.find(r => r.id === id);
    if (record) {
      Object.assign(record, updates);
      record.updatedAt = new Date().toISOString();
      return record;
    }
    return null;
  }
}

export const dataStore = new DataStore();
