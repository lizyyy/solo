const Experiment = require('./Experiment');

class ExperimentManager {
  constructor() {
    this.experiments = new Map();
  }

  createExperiment(config) {
    const experiment = new Experiment(config);
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  getExperiment(id) {
    return this.experiments.get(id);
  }

  getAllExperiments() {
    return Array.from(this.experiments.values()).map(exp => exp.getSummary());
  }

  updateExperiment(id, updates) {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      return null;
    }
    
    if (updates.name !== undefined) {
      experiment.name = updates.name;
    }
    if (updates.description !== undefined) {
      experiment.description = updates.description;
    }
    if (updates.config !== undefined) {
      experiment.config = { ...experiment.config, ...updates.config };
    }
    if (updates.trafficPlan !== undefined) {
      experiment.setTrafficPlan(updates.trafficPlan);
    }
    
    experiment.updatedAt = new Date();
    return experiment.getSummary();
  }

  deleteExperiment(id) {
    return this.experiments.delete(id);
  }

  resetExperiment(id) {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      return null;
    }
    
    experiment.reset();
    return experiment.getSummary();
  }

  async runExperiment(id) {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      return null;
    }
    
    return await experiment.simulate();
  }
}

module.exports = new ExperimentManager();
