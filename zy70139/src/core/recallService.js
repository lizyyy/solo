const { v4: uuidv4 } = require('uuid');
const { RecallSource } = require('./recallSource');
const { ExposureLog } = require('./exposureLog');
const { RECALL_SOURCE_STATES, REQUEST_STATUS } = require('./constants');

class RecallService {
  constructor() {
    this.sources = new Map();
    this.exposureLog = new ExposureLog();
  }
  
  registerSource(id, name, config = {}) {
    if (this.sources.has(id)) {
      return {
        success: false,
        error: `召回源 ${id} 已存在`,
        source: null
      };
    }
    
    const source = new RecallSource(id, name, config);
    this.sources.set(id, source);
    
    return {
      success: true,
      error: null,
      source
    };
  }
  
  getSource(id) {
    return this.sources.get(id) || null;
  }
  
  getAllSources() {
    return Array.from(this.sources.values());
  }
  
  getAvailableSources() {
    return this.getAllSources().filter(s => s.isAvailableForRequest());
  }
  
  getDegradationInfo() {
    const allSources = this.getAllSources();
    const skippedSources = allSources.filter(s => 
      s.currentState === RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    );
    
    const isDegraded = skippedSources.length > 0 || 
      allSources.some(s => s.currentState === RECALL_SOURCE_STATES.DEGRADED);
    
    let reason = '所有召回源正常';
    if (isDegraded) {
      const degraded = allSources.filter(s => s.currentState === RECALL_SOURCE_STATES.DEGRADED);
      const cbOpen = allSources.filter(s => s.currentState === RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN);
      
      const reasons = [];
      if (degraded.length > 0) {
        reasons.push(`${degraded.length}个召回源处于降级状态: ${degraded.map(s => s.name).join(', ')}`);
      }
      if (cbOpen.length > 0) {
        reasons.push(`${cbOpen.length}个召回源已熔断: ${cbOpen.map(s => s.name).join(', ')}`);
      }
      reason = reasons.join('; ');
    }
    
    return {
      isDegraded,
      reason,
      skippedSources: skippedSources.map(s => ({
        id: s.id,
        name: s.name,
        state: s.currentState
      }))
    };
  }
  
  selectSourcesForRequest() {
    const available = this.getAvailableSources();
    const degradationInfo = this.getDegradationInfo();
    
    available.sort((a, b) => b.getWeight() - a.getWeight());
    
    return {
      selectedSources: available,
      degradationInfo
    };
  }
  
  processRecallRequest(userId) {
    const requestId = uuidv4();
    const { selectedSources, degradationInfo } = this.selectSourcesForRequest();
    
    const results = selectedSources.map(source => {
      const simulatedSuccess = Math.random() > 0.1;
      const status = simulatedSuccess ? REQUEST_STATUS.SUCCESS : REQUEST_STATUS.FAILURE;
      const latencyMs = Math.floor(Math.random() * 100) + 10;
      
      const record = source.recordRequest(status, latencyMs);
      
      return {
        sourceId: source.id,
        sourceName: source.name,
        status,
        latencyMs,
        recordId: record.id
      };
    });
    
    const log = this.exposureLog.record(
      requestId,
      userId,
      selectedSources,
      degradationInfo,
      results
    );
    
    return {
      requestId,
      userId,
      selectedSources: selectedSources.map(s => ({
        id: s.id,
        name: s.name,
        state: s.currentState,
        weight: s.getWeight()
      })),
      degradationInfo,
      results,
      logId: log.id
    };
  }
  
  evaluateAndTransition(sourceId) {
    const source = this.getSource(sourceId);
    if (!source) {
      return {
        success: false,
        error: `召回源 ${sourceId} 不存在`,
        transition: null
      };
    }
    
    if (source.currentState === RECALL_SOURCE_STATES.HEALTHY) {
      const check = source.checkDegradationCondition();
      if (check.shouldDegrade) {
        const result = source.transitionTo(
          RECALL_SOURCE_STATES.DEGRADED,
          'AUTO_DEGRADATION',
          check.reason
        );
        return {
          success: true,
          transition: result,
          evaluation: check
        };
      }
      return {
        success: true,
        transition: null,
        evaluation: check
      };
    }
    
    if (source.currentState === RECALL_SOURCE_STATES.DEGRADED) {
      const check = source.checkCircuitBreakerCondition();
      if (check.shouldOpenCircuit) {
        const result = source.transitionTo(
          RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
          'AUTO_CIRCUIT_BREAKER',
          check.reason
        );
        return {
          success: true,
          transition: result,
          evaluation: check
        };
      }
      return {
        success: true,
        transition: null,
        evaluation: check
      };
    }
    
    if (source.currentState === RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN) {
      const check = source.checkProbeCondition();
      if (check.shouldProbe) {
        const result = source.transitionTo(
          RECALL_SOURCE_STATES.PROBING,
          'AUTO_PROBE',
          check.reason
        );
        return {
          success: true,
          transition: result,
          evaluation: check
        };
      }
      return {
        success: true,
        transition: null,
        evaluation: check
      };
    }
    
    if (source.currentState === RECALL_SOURCE_STATES.PROBING) {
      const check = source.checkRecoveryCondition();
      if (check.shouldRecover) {
        const result = source.transitionTo(
          RECALL_SOURCE_STATES.HEALTHY,
          'AUTO_RECOVERY',
          check.reason
        );
        return {
          success: true,
          transition: result,
          evaluation: check
        };
      }
      return {
        success: true,
        transition: null,
        evaluation: check
      };
    }
    
    return {
      success: true,
      transition: null,
      evaluation: { reason: `未知状态 ${source.currentState}` }
    };
  }
  
  evaluateAllSources() {
    const results = [];
    
    for (const [id, source] of this.sources) {
      const result = this.evaluateAndTransition(id);
      results.push({
        sourceId: id,
        sourceName: source.name,
        ...result
      });
    }
    
    return results;
  }
  
  manualTransition(sourceId, targetState, reason) {
    const source = this.getSource(sourceId);
    if (!source) {
      return {
        success: false,
        error: `召回源 ${sourceId} 不存在`,
        result: null
      };
    }
    
    const result = source.transitionTo(targetState, 'MANUAL', reason);
    return {
      success: result.success,
      error: result.error ? result.error.message : null,
      result
    };
  }
  
  recordSourceResult(sourceId, status, latencyMs = 0) {
    const source = this.getSource(sourceId);
    if (!source) {
      return {
        success: false,
        error: `召回源 ${sourceId} 不存在`,
        record: null
      };
    }
    
    try {
      const record = source.recordRequest(status, latencyMs);
      return {
        success: true,
        error: null,
        record
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        record: null
      };
    }
  }
  
  getReport(startTime, endTime) {
    const exposureReport = this.exposureLog.generateReport(startTime, endTime);
    
    const sourceStates = this.getAllSources().map(s => ({
      id: s.id,
      name: s.name,
      currentState: s.currentState,
      version: s.version,
      metrics: s._getMetricsSnapshot ? s._getMetricsSnapshot() : null,
      stateHistoryCount: s.stateHistory ? s.stateHistory.length : 0
    }));
    
    return {
      exposureReport,
      sourceStates,
      generatedAt: Date.now()
    };
  }
  
  getExposureLogs(filter = {}) {
    return this.exposureLog.getLogs(filter);
  }
}

module.exports = {
  RecallService
};