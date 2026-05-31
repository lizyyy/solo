const { QuestionBank } = require('../models/QuestionBank');
const { MistakeCollection } = require('../models/MistakeCollection');
const { ReviewScript } = require('../models/ReviewScript');
const { History } = require('../models/History');
const storage = require('./storage');

class Project {
  constructor(name) {
    this.name = name;
    this.questionBank = new QuestionBank();
    this.mistakeCollection = new MistakeCollection();
    this.reviewScript = new ReviewScript();
    this.history = new History();
    this.isLoaded = false;
  }

  async load() {
    const files = storage.getProjectFiles(this.name);

    if (storage.fileExists(files.questionBank)) {
      const qbData = storage.readJson(files.questionBank);
      this.questionBank.load(qbData);
    }

    if (storage.fileExists(files.mistakes)) {
      const mcData = storage.readJson(files.mistakes);
      this.mistakeCollection.load(mcData);
    }

    if (storage.fileExists(files.reviewScript)) {
      const rsData = storage.readJson(files.reviewScript);
      this.reviewScript.load(rsData);
    }

    if (storage.fileExists(files.history)) {
      const hData = storage.readJson(files.history);
      this.history.load(hData);
    }

    this.isLoaded = true;
    return this;
  }

  async save() {
    const files = storage.getProjectFiles(this.name);
    storage.writeJson(files.questionBank, this.questionBank.toJSON());
    storage.writeJson(files.mistakes, this.mistakeCollection.toJSON());
    storage.writeJson(files.reviewScript, this.reviewScript.toJSON());
    storage.writeJson(files.history, this.history.toJSON());
    return this;
  }

  recordHistory(operation, targetType, targetId, beforeState, afterState, operator = 'teacher', reason = '') {
    return this.history.record(
      operation,
      targetType,
      targetId,
      beforeState,
      afterState,
      operator,
      reason
    );
  }

  getStatus() {
    const stats = this.mistakeCollection.getStatistics();
    const anomalies = this.mistakeCollection.getAnomalies();
    const knowledgePoints = this.questionBank.getAllKnowledgePoints();

    return {
      name: this.name,
      questionCount: this.questionBank.questions.length,
      mistakeCount: this.mistakeCollection.records.length,
      knowledgePoints,
      statistics: stats,
      anomalyCount: anomalies.length,
      sectionCount: this.reviewScript.sections.length,
      historyCount: this.history.entries.length,
      lastReviewedAt: this.reviewScript.metadata.lastReviewedAt,
      lastExportedAt: this.reviewScript.metadata.lastExportedAt,
      version: this.reviewScript.metadata.version
    };
  }

  validateConsistency() {
    const issues = [];

    const questionNos = new Set(this.questionBank.questions.map(q => q.questionNo));
    const mistakeQuestionNos = new Set(this.mistakeCollection.records.map(r => r.questionNo));

    for (const qNo of mistakeQuestionNos) {
      if (!questionNos.has(qNo)) {
        issues.push({
          type: 'missing_question',
          severity: 'warning',
          message: `错题记录中引用了不存在的题目: 第${qNo}题`
        });
      }
    }

    const sectionQuestionNos = new Set();
    this.reviewScript.sections.forEach(section => {
      section.questionNos.forEach(qNo => sectionQuestionNos.add(qNo));
    });

    for (const qNo of sectionQuestionNos) {
      if (!questionNos.has(qNo)) {
        issues.push({
          type: 'missing_question_in_script',
          severity: 'warning',
          message: `讲评稿中引用了不存在的题目: 第${qNo}题`
        });
      }
    }

    for (const qNo of questionNos) {
      const mistakes = this.mistakeCollection.findByQuestionNo(qNo);
      if (mistakes.length > 0) {
        const hasReview = mistakes.some(m => m.reviewStatus === 'reviewed');
        if (!hasReview) {
          issues.push({
            type: 'unreviewed_mistakes',
            severity: 'info',
            message: `第${qNo}题有${mistakes.length}条错题记录尚未复核`
          });
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      summary: {
        warnings: issues.filter(i => i.severity === 'warning').length,
        infos: issues.filter(i => i.severity === 'info').length
      }
    };
  }
}

module.exports = { Project };
