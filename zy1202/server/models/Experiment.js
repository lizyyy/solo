const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const CacheSystem = require('./CacheSystem');

class Experiment {
  constructor(config = {}) {
    this.id = uuidv4();
    this.name = config.name || 'Unnamed Experiment';
    this.description = config.description || '';
    this.createdAt = moment();
    this.updatedAt = moment();
    this.status = 'created';
    this.config = {
      l1Capacity: config.l1Capacity || 50,
      l1Ttl: config.l1Ttl || 60,
      l1TtlJitter: config.l1TtlJitter || 0,
      l2Capacity: config.l2Capacity || 200,
      l2Ttl: config.l2Ttl || 300,
      l2TtlJitter: config.l2TtlJitter || 0,
      dbQueryLatencyMs: config.dbQueryLatencyMs || 100,
      strategy: config.strategy || 'cache-aside',
      writeStrategy: config.writeStrategy || 'write-through',
      delayDoubleDelete: config.delayDoubleDelete || false,
      delayDeleteMs: config.delayDeleteMs || 1000,
      useMutex: config.useMutex || false,
      mutexTimeoutMs: config.mutexTimeoutMs || 5000,
      useBloomFilter: config.useBloomFilter || false,
      enablePreheating: config.enablePreheating || false,
      preheatKeys: config.preheatKeys || [],
      preheatValues: config.preheatValues || []
    };
    
    this.cacheSystem = new CacheSystem(this.config);
    this.trafficPlan = config.trafficPlan || [];
    this.simulationResults = null;
  }

  async runStep(step) {
    const { type, key, value, delayMs } = step;
    let result = null;
    
    if (delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    switch (type) {
      case 'read':
        result = await this.cacheSystem.get(key);
        break;
      case 'write':
        result = await this.cacheSystem.set(key, value);
        break;
      case 'delete':
        result = await this.cacheSystem.delete(key);
        break;
      default:
        result = { error: `Unknown step type: ${type}` };
    }
    
    return {
      step,
      result,
      timestamp: moment().toISOString()
    };
  }

  async runAllSteps() {
    const results = [];
    
    for (const step of this.trafficPlan) {
      const result = await this.runStep(step);
      results.push(result);
    }
    
    return results;
  }

  async simulate() {
    this.status = 'running';
    this.updatedAt = moment();
    
    if (this.config.enablePreheating && this.config.preheatKeys.length > 0) {
      this.cacheSystem.preheat(this.config.preheatKeys, this.config.preheatValues);
    }
    
    const stepResults = await this.runAllSteps();
    
    const finalStats = this.cacheSystem.getStats();
    const consistencyRisk = this.cacheSystem.getConsistencyRisk();
    const penetrationRisk = this.cacheSystem.getPenetrationRisk();
    const breakdownRisk = this.cacheSystem.getBreakdownRisk();
    const avalancheRisk = this.cacheSystem.getAvalancheRisk();
    
    const events = this.cacheSystem.getEvents();
    
    this.simulationResults = {
      stepResults,
      finalStats,
      risks: {
        consistency: consistencyRisk,
        penetration: penetrationRisk,
        breakdown: breakdownRisk,
        avalanche: avalancheRisk
      },
      events,
      completedAt: moment().toISOString()
    };
    
    this.status = 'completed';
    this.updatedAt = moment();
    
    return this.simulationResults;
  }

  setTrafficPlan(plan) {
    this.trafficPlan = plan;
    this.updatedAt = moment();
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      status: this.status,
      config: this.config,
      trafficPlanCount: this.trafficPlan.length,
      hasResults: !!this.simulationResults
    };
  }

  getFullDetails() {
    return {
      ...this.getSummary(),
      trafficPlan: this.trafficPlan,
      simulationResults: this.simulationResults
    };
  }

  reset() {
    this.cacheSystem.clear();
    this.simulationResults = null;
    this.status = 'created';
    this.updatedAt = moment();
  }
}

module.exports = Experiment;
