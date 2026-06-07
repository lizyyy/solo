const store = require('../models/store');

class SelfCheckService {
  constructor() {
    this.checkTypes = {
      DUPLICATE_IMPORT: 'duplicate_import',
      MISSING_FEATURE_DEFAULT: 'missing_feature_default',
      RECOMPUTE_AFTER_FILL: 'recompute_after_fill',
      EXPORT_CONSISTENCY: 'export_consistency'
    };
  }

  runAllChecks(runId) {
    const results = [];
    results.push(this.checkDuplicateImport(runId));
    results.push(this.checkMissingFeatureDefault(runId));
    results.push(this.checkRecomputeAfterFill(runId));
    results.push(this.checkExportConsistency(runId));
    
    const saved = results.map(r => store.saveSelfCheckResult(r));
    return {
      runId,
      total: saved.length,
      passed: saved.filter(r => r.passed).length,
      failed: saved.filter(r => !r.passed).length,
      results: saved
    };
  }

  checkDuplicateImport(runId) {
    const samples = store.getNegativeSamples(runId);
    const seen = new Map();
    const duplicates = [];

    samples.forEach((sample, idx) => {
      const key = `${sample.userId}_${sample.itemId}`;
      if (seen.has(key)) {
        duplicates.push({
          sampleId: sample.id,
          rowNumber: sample.originalRowNumber,
          userId: sample.userId,
          itemId: sample.itemId,
          previousRow: seen.get(key).rowNumber,
          previousSampleId: seen.get(key).sampleId
        });
      } else {
        seen.set(key, { rowNumber: sample.originalRowNumber, sampleId: sample.id });
      }
    });

    return {
      runId,
      checkType: this.checkTypes.DUPLICATE_IMPORT,
      passed: duplicates.length === 0,
      details: {
        totalSamples: samples.length,
        duplicateCount: duplicates.length
      },
      issues: duplicates
    };
  }

  checkMissingFeatureDefault(runId) {
    const samples = store.getNegativeSamples(runId);
    const issues = [];

    samples.forEach(sample => {
      if (sample.usedDefaultScore || sample.hasMissingFeatures) {
        issues.push({
          sampleId: sample.id,
          rowNumber: sample.originalRowNumber,
          userId: sample.userId,
          itemId: sample.itemId,
          featureStatus: sample.featureStatus,
          hasMissingFeatures: sample.hasMissingFeatures,
          missingFeatureList: sample.missingFeatureList || [],
          usedDefaultScore: sample.usedDefaultScore,
          predictedProb: sample.predictedProb,
          calibratedProb: sample.calibratedProb,
          status: sample.status,
          needsReview: sample.status !== 'pending_review'
        });
      }
    });

    return {
      runId,
      checkType: this.checkTypes.MISSING_FEATURE_DEFAULT,
      passed: issues.every(i => !i.needsReview),
      details: {
        totalSamples: samples.length,
        missingFeatureCount: issues.length,
        pendingReviewCount: issues.filter(i => i.status === 'pending_review').length
      },
      issues
    };
  }

  checkRecomputeAfterFill(runId) {
    const samples = store.getNegativeSamples(runId);
    const issues = [];

    samples.forEach(sample => {
      if (sample.manualEdits && sample.manualEdits.length > 0) {
        const hasProbEdit = sample.manualEdits.some(e => 
          e.field === 'predictedProb' || e.field === 'calibratedProb' || e.field === 'features'
        );
        if (hasProbEdit && sample.status !== 'recomputed') {
          issues.push({
            sampleId: sample.id,
            rowNumber: sample.originalRowNumber,
            userId: sample.userId,
            itemId: sample.itemId,
            manualEditCount: sample.manualEdits.length,
            lastEditAt: sample.manualEdits[sample.manualEdits.length - 1].timestamp,
            currentStatus: sample.status
          });
        }
      }
    });

    return {
      runId,
      checkType: this.checkTypes.RECOMPUTE_AFTER_FILL,
      passed: issues.length === 0,
      details: {
        totalSamples: samples.length,
        withManualEdits: samples.filter(s => s.manualEdits && s.manualEdits.length > 0).length,
        needRecompute: issues.length
      },
      issues
    };
  }

  checkExportConsistency(runId) {
    const samples = store.getNegativeSamples(runId);
    const exportData = this._buildExportData(samples);
    const pageData = this._buildPageData(samples);
    const apiData = this._buildApiData(samples);

    const issues = [];

    if (exportData.length !== pageData.length || pageData.length !== apiData.length) {
      issues.push({
        type: 'count_mismatch',
        exportCount: exportData.length,
        pageCount: pageData.length,
        apiCount: apiData.length
      });
    }

    const sampleIds = samples.map(s => s.id);
    for (const id of sampleIds) {
      const exportRow = exportData.find(r => r.id === id);
      const pageRow = pageData.find(r => r.id === id);
      const apiRow = apiData.find(r => r.id === id);

      if (!exportRow || !pageRow || !apiRow) {
        issues.push({ type: 'missing_record', sampleId: id });
        continue;
      }

      const fields = ['hasMissingFeatures', 'usedDefaultScore', 'predictedProb', 'calibratedProb', 'status', 'featureStatus'];
      for (const field of fields) {
        const eVal = JSON.stringify(exportRow[field]);
        const pVal = JSON.stringify(pageRow[field]);
        const aVal = JSON.stringify(apiRow[field]);
        if (eVal !== pVal || pVal !== aVal) {
          issues.push({
            type: 'field_mismatch',
            sampleId: id,
            field,
            exportValue: exportRow[field],
            pageValue: pageRow[field],
            apiValue: apiRow[field]
          });
        }
      }
    }

    return {
      runId,
      checkType: this.checkTypes.EXPORT_CONSISTENCY,
      passed: issues.length === 0,
      details: {
        recordCount: samples.length,
        checkedFields: ['hasMissingFeatures', 'usedDefaultScore', 'predictedProb', 'calibratedProb', 'status', 'featureStatus']
      },
      issues
    };
  }

  _buildExportData(samples) {
    return samples.map(s => ({
      id: s.id,
      originalRowNumber: s.originalRowNumber,
      userId: s.userId,
      itemId: s.itemId,
      predictedProb: s.predictedProb,
      calibratedProb: s.calibratedProb,
      label: s.label,
      hasMissingFeatures: s.hasMissingFeatures,
      missingFeatureList: (s.missingFeatureList || []).join(';'),
      usedDefaultScore: s.usedDefaultScore,
      featureStatus: s.featureStatus,
      status: s.status,
      manualEditCount: (s.manualEdits || []).length,
      recallCandidatesReviewed: s.recallCandidatesReviewed,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
  }

  _buildPageData(samples) {
    return samples.map(s => ({
      id: s.id,
      originalRowNumber: s.originalRowNumber,
      userId: s.userId,
      itemId: s.itemId,
      predictedProb: s.predictedProb,
      calibratedProb: s.calibratedProb,
      label: s.label,
      hasMissingFeatures: s.hasMissingFeatures,
      missingFeatureList: s.missingFeatureList || [],
      usedDefaultScore: s.usedDefaultScore,
      featureStatus: s.featureStatus,
      status: s.status,
      manualEditCount: (s.manualEdits || []).length,
      recallCandidatesReviewed: s.recallCandidatesReviewed
    }));
  }

  _buildApiData(samples) {
    return samples.map(s => ({
      id: s.id,
      originalRowNumber: s.originalRowNumber,
      userId: s.userId,
      itemId: s.itemId,
      predictedProb: s.predictedProb,
      calibratedProb: s.calibratedProb,
      label: s.label,
      hasMissingFeatures: s.hasMissingFeatures,
      missingFeatureList: s.missingFeatureList || [],
      usedDefaultScore: s.usedDefaultScore,
      featureStatus: s.featureStatus,
      status: s.status,
      manualEdits: s.manualEdits || [],
      recallCandidatesReviewed: s.recallCandidatesReviewed,
      explainableSummary: s.explainableSummary,
      rawData: s.rawData
    }));
  }

  getLatestResults(runId) {
    const results = store.getSelfCheckResults(runId);
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.checkType] || new Date(r.timestamp) > new Date(grouped[r.checkType].timestamp)) {
        grouped[r.checkType] = r;
      }
    });
    return Object.values(grouped);
  }
}

module.exports = new SelfCheckService();
