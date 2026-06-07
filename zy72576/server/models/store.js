const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '../data');
    this.files = {
      negativeSamples: path.join(this.baseDir, 'negative-samples.json'),
      recallCandidates: path.join(this.baseDir, 'recall-candidates.json'),
      calibrationRuns: path.join(this.baseDir, 'calibration-runs.json'),
      selfCheckResults: path.join(this.baseDir, 'self-check-results.json'),
      summary: path.join(this.baseDir, 'summary.json')
    };
    this._initFiles();
  }

  _initFiles() {
    for (const [key, filePath] of Object.entries(this.files)) {
      if (!fs.existsSync(filePath)) {
        const initial = key === 'summary' ? this._emptySummary() : [];
        fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf8');
      }
    }
  }

  _emptySummary() {
    return {
      currentRunId: null,
      status: 'idle',
      step: 0,
      totalNegativeSamples: 0,
      totalMissingFeatures: 0,
      totalManualEdits: 0,
      lastUpdated: null
    };
  }

  _read(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw ? JSON.parse(raw) : (filePath.includes('summary') ? this._emptySummary() : []);
  }

  _write(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  getNegativeSamples(runId = null) {
    const all = this._read(this.files.negativeSamples);
    return runId ? all.filter(s => s.runId === runId) : all;
  }

  getNegativeSampleById(id) {
    const all = this._read(this.files.negativeSamples);
    return all.find(s => s.id === id);
  }

  addNegativeSamples(samples, runId) {
    const all = this._read(this.files.negativeSamples);
    const now = new Date().toISOString();
    const enriched = samples.map((s, idx) => ({
      id: uuidv4(),
      runId,
      originalRowNumber: s.originalRowNumber || (idx + 1),
      itemId: s.itemId || '',
      userId: s.userId || '',
      predictedProb: s.predictedProb !== undefined ? Number(s.predictedProb) : null,
      calibratedProb: s.calibratedProb !== undefined ? Number(s.calibratedProb) : null,
      label: s.label !== undefined ? Number(s.label) : 0,
      features: s.features || {},
      featureStatus: s.featureStatus || 'ok',
      hasMissingFeatures: !!s.hasMissingFeatures,
      missingFeatureList: s.missingFeatureList || [],
      usedDefaultScore: !!s.usedDefaultScore,
      status: s.status || 'imported',
      manualEdits: [],
      recallCandidatesReviewed: false,
      explainableSummary: null,
      rawData: s.rawData || { ...s },
      createdAt: now,
      updatedAt: now
    }));
    const merged = [...all, ...enriched];
    this._write(this.files.negativeSamples, merged);
    return enriched;
  }

  updateNegativeSample(id, updates) {
    const all = this._read(this.files.negativeSamples);
    const idx = all.findIndex(s => s.id === id);
    if (idx === -1) return null;
    all[idx] = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._write(this.files.negativeSamples, all);
    return all[idx];
  }

  addManualEdit(sampleId, field, oldValue, newValue, operator) {
    const sample = this.getNegativeSampleById(sampleId);
    if (!sample) return null;
    const edit = {
      id: uuidv4(),
      field,
      oldValue,
      newValue,
      operator,
      timestamp: new Date().toISOString()
    };
    const edits = [...(sample.manualEdits || []), edit];
    return this.updateNegativeSample(sampleId, { manualEdits: edits });
  }

  getRecallCandidates(runId = null) {
    const all = this._read(this.files.recallCandidates);
    return runId ? all.filter(c => c.runId === runId) : all;
  }

  addRecallCandidates(candidates, runId) {
    const all = this._read(this.files.recallCandidates);
    const now = new Date().toISOString();
    const enriched = candidates.map(c => ({
      id: uuidv4(),
      runId,
      negativeSampleId: c.negativeSampleId || null,
      itemId: c.itemId || '',
      userId: c.userId || '',
      score: c.score !== undefined ? Number(c.score) : null,
      rank: c.rank !== undefined ? Number(c.rank) : null,
      reviewed: false,
      createdAt: now
    }));
    const merged = [...all, ...enriched];
    this._write(this.files.recallCandidates, merged);
    return enriched;
  }

  markRecallReviewed(sampleId) {
    const all = this._read(this.files.negativeSamples);
    const idx = all.findIndex(s => s.id === sampleId);
    if (idx === -1) return null;
    all[idx].recallCandidatesReviewed = true;
    all[idx].updatedAt = new Date().toISOString();
    this._write(this.files.negativeSamples, all);
    return all[idx];
  }

  createCalibrationRun(name) {
    const all = this._read(this.files.calibrationRuns);
    const run = {
      id: uuidv4(),
      name: name || `校准任务-${new Date().toLocaleDateString()}`,
      status: 'created',
      step: 0,
      stepNames: ['导入负样本', '补看召回候选表', '更新可解释摘要'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.push(run);
    this._write(this.files.calibrationRuns, all);
    this.setCurrentRun(run.id);
    return run;
  }

  getCalibrationRuns() {
    return this._read(this.files.calibrationRuns);
  }

  getCalibrationRun(id) {
    const all = this._read(this.files.calibrationRuns);
    return all.find(r => r.id === id);
  }

  updateCalibrationRun(id, updates) {
    const all = this._read(this.files.calibrationRuns);
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return null;
    all[idx] = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this._write(this.files.calibrationRuns, all);
    return all[idx];
  }

  advanceStep(runId) {
    const run = this.getCalibrationRun(runId);
    if (!run || run.step >= 2) return run;
    return this.updateCalibrationRun(runId, { step: run.step + 1 });
  }

  getSummary() {
    return this._read(this.files.summary);
  }

  setCurrentRun(runId) {
    const summary = this._read(this.files.summary);
    summary.currentRunId = runId;
    summary.lastUpdated = new Date().toISOString();
    this._write(this.files.summary, summary);
  }

  updateSummary(updates) {
    const summary = {
      ...this._read(this.files.summary),
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    this._write(this.files.summary, summary);
    return summary;
  }

  saveSelfCheckResult(result) {
    const all = this._read(this.files.selfCheckResults);
    const record = {
      id: uuidv4(),
      runId: result.runId || null,
      checkType: result.checkType,
      passed: result.passed,
      details: result.details || {},
      issues: result.issues || [],
      timestamp: new Date().toISOString()
    };
    all.push(record);
    this._write(this.files.selfCheckResults, all);
    return record;
  }

  getSelfCheckResults(runId = null) {
    const all = this._read(this.files.selfCheckResults);
    return runId ? all.filter(r => r.runId === runId) : all;
  }

  clearAll() {
    for (const [key, filePath] of Object.entries(this.files)) {
      const initial = key === 'summary' ? this._emptySummary() : [];
      this._write(filePath, initial);
    }
  }

  clearByRunId(runId) {
    ['negativeSamples', 'recallCandidates', 'selfCheckResults'].forEach(key => {
      const all = this._read(this.files[key]);
      const filtered = all.filter(item => item.runId !== runId);
      this._write(this.files[key], filtered);
    });
    const runs = this._read(this.files.calibrationRuns).filter(r => r.id !== runId);
    this._write(this.files.calibrationRuns, runs);
    const summary = this.getSummary();
    if (summary.currentRunId === runId) {
      this._write(this.files.summary, this._emptySummary());
    }
  }
}

module.exports = new DataStore();
module.exports.DataStore = DataStore;
