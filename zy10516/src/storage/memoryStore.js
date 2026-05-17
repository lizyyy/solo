const { TrialTask } = require('../models/TrialTask');

class MemoryStore {
  constructor() {
    this.trials = new Map();
    this.errorContexts = new Map();
  }

  createTrial(data) {
    const trial = new TrialTask(data);
    this.trials.set(trial.id, trial);
    return trial;
  }

  getTrial(id) {
    return this.trials.get(id);
  }

  getAllTrials(filters = {}) {
    let results = Array.from(this.trials.values());
    
    if (filters.status) {
      results = results.filter(t => t.status === filters.status);
    }
    if (filters.metricName) {
      results = results.filter(t => t.metricName.includes(filters.metricName));
    }
    
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateTrial(id, updater) {
    const trial = this.trials.get(id);
    if (!trial) return null;
    updater(trial);
    trial.updatedAt = new Date().toISOString();
    return trial;
  }

  deleteTrial(id) {
    return this.trials.delete(id);
  }

  saveErrorContext(errorId, context) {
    this.errorContexts.set(errorId, {
      ...context,
      savedAt: new Date().toISOString()
    });
  }

  getErrorContext(errorId) {
    return this.errorContexts.get(errorId);
  }

  getAllErrorContexts() {
    return Array.from(this.errorContexts.values());
  }
}

module.exports = new MemoryStore();