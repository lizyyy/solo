const store = require('../models/store');
const selfCheck = require('./selfCheck');

class WorkflowService {
  constructor() {
    this.STATUS = {
      IMPORTED: 'imported',
      PENDING_REVIEW: 'pending_review',
      REVIEWED: 'reviewed',
      RECOMPUTED: 'recomputed',
      NORMAL: 'normal',
      ABNORMAL: 'abnormal'
    };
  }

  async createRun(name) {
    const run = store.createCalibrationRun(name);
    return run;
  }

  async importNegativeSamples(runId, rawSamples) {
    const run = store.getCalibrationRun(runId);
    if (!run) throw new Error('校准任务不存在');

    const processed = rawSamples.map((s, idx) => {
      const hasMissing = this._detectMissingFeatures(s);
      const usedDefault = this._detectDefaultScore(s);
      
      return {
        ...s,
        originalRowNumber: s.originalRowNumber || (idx + 1),
        hasMissingFeatures: hasMissing.has,
        missingFeatureList: hasMissing.features,
        usedDefaultScore: usedDefault,
        featureStatus: hasMissing.has ? 'missing' : 'ok',
        status: (hasMissing.has || usedDefault) ? this.STATUS.PENDING_REVIEW : this.STATUS.IMPORTED
      };
    });

    const samples = store.addNegativeSamples(processed, runId);
    
    const missingCount = samples.filter(s => s.hasMissingFeatures || s.usedDefaultScore).length;
    store.updateSummary({
      totalNegativeSamples: samples.length,
      totalMissingFeatures: missingCount,
      totalManualEdits: 0
    });

    store.updateCalibrationRun(runId, { status: 'step1_done', step: 1 });

    selfCheck.checkDuplicateImport(runId);
    selfCheck.checkMissingFeatureDefault(runId);

    return {
      runId,
      imported: samples.length,
      needReview: missingCount,
      samples
    };
  }

  _detectMissingFeatures(sample) {
    const requiredFeatures = ['user_age', 'user_gender', 'item_category', 'item_price', 'user_hist_click_cnt'];
    const features = sample.features || sample;
    const missing = [];
    
    requiredFeatures.forEach(f => {
      const val = features[f];
      if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
        missing.push(f);
      }
    });

    return {
      has: missing.length > 0,
      features: missing
    };
  }

  _detectDefaultScore(sample) {
    if (sample.usedDefaultScore !== undefined) return !!sample.usedDefaultScore;
    const defaultProbs = [0.5, 0.0, -1.0];
    return defaultProbs.includes(Number(sample.predictedProb)) || defaultProbs.includes(Number(sample.calibratedProb));
  }

  async reviewRecallCandidates(runId, sampleId, reviewData) {
    const run = store.getCalibrationRun(runId);
    if (!run) throw new Error('校准任务不存在');

    const sample = store.getNegativeSampleById(sampleId);
    if (!sample) throw new Error('负样本不存在');

    if (reviewData.recallCandidates) {
      store.addRecallCandidates(reviewData.recallCandidates.map(c => ({
        ...c,
        negativeSampleId: sampleId
      })), runId);
    }

    const updated = store.markRecallReviewed(sampleId);

    selfCheck.checkMissingFeatureDefault(runId);

    return updated;
  }

  async updateExplainableSummary(runId, sampleId, summary) {
    const run = store.getCalibrationRun(runId);
    if (!run) throw new Error('校准任务不存在');

    const updated = store.updateNegativeSample(sampleId, {
      explainableSummary: summary,
      status: this.STATUS.REVIEWED
    });

    const samples = store.getNegativeSamples(runId);
    const allReviewed = samples.every(s => s.recallCandidatesReviewed && s.explainableSummary);
    if (allReviewed) {
      store.updateCalibrationRun(runId, { status: 'step3_done', step: 3 });
    }

    return updated;
  }

  async markForReview(runId, sampleId) {
    const sample = store.updateNegativeSample(sampleId, {
      status: this.STATUS.PENDING_REVIEW
    });
    selfCheck.checkMissingFeatureDefault(runId);
    return sample;
  }

  async markNormal(runId, sampleId, operator) {
    const sample = store.getNegativeSampleById(sampleId);
    if (sample.hasMissingFeatures || sample.usedDefaultScore) {
      throw new Error('存在特征缺失或使用默认分的样本需先复核，不能直接标记为正常');
    }
    return store.updateNegativeSample(sampleId, {
      status: this.STATUS.NORMAL
    });
  }

  async markAbnormal(runId, sampleId, reason, operator) {
    store.addManualEdit(sampleId, 'status', this.STATUS.PENDING_REVIEW, this.STATUS.ABNORMAL, operator);
    const updated = store.updateNegativeSample(sampleId, {
      status: this.STATUS.ABNORMAL,
      abnormalReason: reason
    });
    
    const summary = store.getSummary();
    store.updateSummary({ totalManualEdits: (summary.totalManualEdits || 0) + 1 });
    
    return updated;
  }

  async recomputeSample(runId, sampleId, newValues, operator) {
    const sample = store.getNegativeSampleById(sampleId);
    if (!sample) throw new Error('样本不存在');

    const edits = [];
    const updates = {};

    if (newValues.features !== undefined) {
      edits.push({ field: 'features', old: sample.features, new: newValues.features });
      updates.features = newValues.features;
      
      const missingCheck = this._detectMissingFeatures({ features: newValues.features });
      updates.hasMissingFeatures = missingCheck.has;
      updates.missingFeatureList = missingCheck.features;
      updates.featureStatus = missingCheck.has ? 'missing' : 'ok';
      updates.usedDefaultScore = false;
    }

    if (newValues.predictedProb !== undefined) {
      edits.push({ field: 'predictedProb', old: sample.predictedProb, new: newValues.predictedProb });
      updates.predictedProb = newValues.predictedProb;
    }

    if (newValues.calibratedProb !== undefined) {
      edits.push({ field: 'calibratedProb', old: sample.calibratedProb, new: newValues.calibratedProb });
      updates.calibratedProb = newValues.calibratedProb;
    }

    updates.status = this.STATUS.RECOMPUTED;

    edits.forEach(e => {
      store.addManualEdit(sampleId, e.field, e.old, e.new, operator);
    });

    const updated = store.updateNegativeSample(sampleId, updates);
    selfCheck.checkRecomputeAfterFill(runId);
    selfCheck.checkMissingFeatureDefault(runId);

    return updated;
  }

  async getWorkflowState(runId) {
    const run = store.getCalibrationRun(runId);
    if (!run) return null;

    const samples = store.getNegativeSamples(runId);
    const stats = {
      total: samples.length,
      imported: samples.filter(s => s.status === this.STATUS.IMPORTED).length,
      pendingReview: samples.filter(s => s.status === this.STATUS.PENDING_REVIEW).length,
      reviewed: samples.filter(s => s.status === this.STATUS.REVIEWED).length,
      recomputed: samples.filter(s => s.status === this.STATUS.RECOMPUTED).length,
      normal: samples.filter(s => s.status === this.STATUS.NORMAL).length,
      abnormal: samples.filter(s => s.status === this.STATUS.ABNORMAL).length,
      hasMissingFeatures: samples.filter(s => s.hasMissingFeatures).length,
      usedDefaultScore: samples.filter(s => s.usedDefaultScore).length,
      recallReviewed: samples.filter(s => s.recallCandidatesReviewed).length,
      withSummary: samples.filter(s => s.explainableSummary).length
    };

    return {
      run,
      stats,
      currentStep: run.step,
      stepNames: run.stepNames,
      canAdvance: this._canAdvanceStep(run.step, stats)
    };
  }

  _canAdvanceStep(currentStep, stats) {
    switch (currentStep) {
      case 0: return stats.total > 0;
      case 1: return stats.recallReviewed === stats.total && stats.total > 0;
      case 2: return stats.withSummary === stats.total && stats.total > 0;
      default: return false;
    }
  }

  async advanceStep(runId) {
    const state = await this.getWorkflowState(runId);
    if (!state) throw new Error('校准任务不存在');
    if (!state.canAdvance) throw new Error('当前步骤未完成，不能推进');
    
    return store.advanceStep(runId);
  }

  getUnifiedView(runId) {
    const samples = store.getNegativeSamples(runId);
    return samples.map(s => ({
      id: s.id,
      runId: s.runId,
      originalRowNumber: s.originalRowNumber,
      userId: s.userId,
      itemId: s.itemId,
      predictedProb: s.predictedProb,
      calibratedProb: s.calibratedProb,
      label: s.label,
      features: s.features,
      featureStatus: s.featureStatus,
      hasMissingFeatures: s.hasMissingFeatures,
      missingFeatureList: s.missingFeatureList,
      usedDefaultScore: s.usedDefaultScore,
      status: s.status,
      manualEdits: s.manualEdits || [],
      recallCandidatesReviewed: s.recallCandidatesReviewed,
      explainableSummary: s.explainableSummary,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
  }

  getExportData(runId) {
    return this.getUnifiedView(runId).map(s => ({
      ...s,
      missingFeatureList: (s.missingFeatureList || []).join(';'),
      manualEditCount: (s.manualEdits || []).length,
      manualEdits: JSON.stringify(s.manualEdits || [])
    }));
  }
}

module.exports = new WorkflowService();
