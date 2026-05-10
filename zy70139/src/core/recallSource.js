const { v4: uuidv4 } = require('uuid');
const {
  RECALL_SOURCE_STATES,
  DEFAULT_CONFIG,
  REQUEST_STATUS
} = require('./constants');
const {
  checkTransition
} = require('./stateMachine');

class RecallSource {
  constructor(id, name, config = {}) {
    this.id = id || uuidv4();
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentState = RECALL_SOURCE_STATES.HEALTHY;
    this.stateHistory = [];
    this.requestMetrics = [];
    this.consecutiveFailures = 0;
    this.circuitBreakerOpenAt = null;
    this.lastProbeAt = null;
    this.version = 0;
    
    this._recordStateChange(RECALL_SOURCE_STATES.HEALTHY, 'INITIALIZED', '召回源初始化');
  }
  
  _recordStateChange(newState, trigger, reason) {
    const historyEntry = {
      timestamp: Date.now(),
      fromState: this.currentState,
      toState: newState,
      trigger,
      reason,
      consecutiveFailures: this.consecutiveFailures,
      metricsSnapshot: this._getMetricsSnapshot()
    };
    this.stateHistory.push(historyEntry);
    this.version++;
  }
  
  _getMetricsSnapshot() {
    const windowed = this._getWindowedMetrics();
    return {
      totalRequests: this.requestMetrics.length,
      windowSize: windowed.length,
      successCount: windowed.filter(r => r.status === REQUEST_STATUS.SUCCESS).length,
      failureCount: windowed.filter(r => 
        [REQUEST_STATUS.FAILURE, REQUEST_STATUS.TIMEOUT].includes(r.status)
      ).length,
      failureRate: this._calculateFailureRate(windowed)
    };
  }
  
  _getWindowedMetrics() {
    const windowSize = this.config.windowSize;
    return this.requestMetrics.slice(-windowSize);
  }
  
  _calculateFailureRate(metrics) {
    if (metrics.length === 0) return 0;
    const failures = metrics.filter(r => 
      [REQUEST_STATUS.FAILURE, REQUEST_STATUS.TIMEOUT].includes(r.status)
    ).length;
    return failures / metrics.length;
  }
  
  _canTransitionTo(targetState) {
    return checkTransition(this.id, this.currentState, targetState);
  }
  
  recordRequest(status, latencyMs = 0) {
    if (!Object.values(REQUEST_STATUS).includes(status)) {
      throw new Error(`无效的请求状态: ${status}`);
    }
    
    const requestRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      status,
      latencyMs,
      stateAtTime: this.currentState
    };
    
    this.requestMetrics.push(requestRecord);
    
    if (status === REQUEST_STATUS.SUCCESS) {
      this.consecutiveFailures = 0;
    } else if ([REQUEST_STATUS.FAILURE, REQUEST_STATUS.TIMEOUT].includes(status)) {
      this.consecutiveFailures++;
    }
    
    this.version++;
    return requestRecord;
  }
  
  transitionTo(targetState, trigger, reason) {
    if (!Object.values(RECALL_SOURCE_STATES).includes(targetState)) {
      throw new Error(`未知的目标状态: ${targetState}`);
    }
    
    const check = this._canTransitionTo(targetState);
    
    if (check.isDuplicate) {
      return {
        success: false,
        isDuplicate: true,
        error: check.error,
        currentState: this.currentState
      };
    }
    
    if (!check.valid) {
      return {
        success: false,
        isDuplicate: false,
        error: check.error,
        currentState: this.currentState
      };
    }
    
    const oldState = this.currentState;
    this._recordStateChange(targetState, trigger, reason);
    this.currentState = targetState;
    
    if (targetState === RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN) {
      this.circuitBreakerOpenAt = Date.now();
    } else if (targetState === RECALL_SOURCE_STATES.PROBING) {
      this.lastProbeAt = Date.now();
    }
    
    return {
      success: true,
      isDuplicate: false,
      error: null,
      previousState: oldState,
      currentState: targetState
    };
  }
  
  checkDegradationCondition() {
    if (this.currentState !== RECALL_SOURCE_STATES.HEALTHY) {
      return { shouldDegrade: false, reason: `当前状态为 ${this.currentState}，不满足健康状态条件` };
    }
    
    const windowed = this._getWindowedMetrics();
    if (windowed.length < 10) {
      return { shouldDegrade: false, reason: `请求样本不足（${windowed.length}/10），暂不判断降级` };
    }
    
    const failureRate = this._calculateFailureRate(windowed);
    const consecutiveFailures = this.consecutiveFailures;
    
    if (failureRate >= this.config.failureRateThreshold) {
      return {
        shouldDegrade: true,
        reason: `失败率 ${(failureRate * 100).toFixed(1)}% 超过阈值 ${(this.config.failureRateThreshold * 100)}%`,
        details: { failureRate, threshold: this.config.failureRateThreshold }
      };
    }
    
    if (consecutiveFailures >= this.config.consecutiveFailuresThreshold) {
      return {
        shouldDegrade: true,
        reason: `连续失败 ${consecutiveFailures} 次 超过阈值 ${this.config.consecutiveFailuresThreshold} 次`,
        details: { consecutiveFailures, threshold: this.config.consecutiveFailuresThreshold }
      };
    }
    
    return { shouldDegrade: false, reason: '各项指标正常' };
  }
  
  checkCircuitBreakerCondition() {
    if (this.currentState !== RECALL_SOURCE_STATES.DEGRADED) {
      return { shouldOpenCircuit: false, reason: `当前状态为 ${this.currentState}，仅降级状态可触发熔断` };
    }
    
    const windowed = this._getWindowedMetrics();
    const failureRate = this._calculateFailureRate(windowed);
    const consecutiveFailures = this.consecutiveFailures;
    
    const circuitBreakerThreshold = this.config.failureRateThreshold * 1.5;
    
    if (failureRate >= circuitBreakerThreshold) {
      return {
        shouldOpenCircuit: true,
        reason: `失败率 ${(failureRate * 100).toFixed(1)}% 超过熔断阈值 ${(circuitBreakerThreshold * 100)}%`,
        details: { failureRate, threshold: circuitBreakerThreshold }
      };
    }
    
    const consecutiveCircuitThreshold = this.config.consecutiveFailuresThreshold * 2;
    if (consecutiveFailures >= consecutiveCircuitThreshold) {
      return {
        shouldOpenCircuit: true,
        reason: `连续失败 ${consecutiveFailures} 次 超过熔断阈值 ${consecutiveCircuitThreshold} 次`,
        details: { consecutiveFailures, threshold: consecutiveCircuitThreshold }
      };
    }
    
    return { shouldOpenCircuit: false, reason: '降级状态下指标尚未达到熔断阈值' };
  }
  
  checkProbeCondition(currentTime = Date.now()) {
    if (this.currentState !== RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN) {
      return { shouldProbe: false, reason: `当前状态为 ${this.currentState}，仅熔断状态可触发探测` };
    }
    
    if (!this.circuitBreakerOpenAt) {
      return { shouldProbe: false, reason: '熔断开始时间未记录' };
    }
    
    const elapsedMs = currentTime - this.circuitBreakerOpenAt;
    
    if (elapsedMs >= this.config.circuitBreakerTimeoutMs) {
      return {
        shouldProbe: true,
        reason: `熔断已持续 ${elapsedMs}ms 超过超时 ${this.config.circuitBreakerTimeoutMs}ms，进入恢复探测`,
        details: { elapsedMs, timeout: this.config.circuitBreakerTimeoutMs }
      };
    }
    
    return {
      shouldProbe: false,
      reason: `熔断持续时间 ${elapsedMs}ms 未达到超时 ${this.config.circuitBreakerTimeoutMs}ms`,
      details: { elapsedMs, timeout: this.config.circuitBreakerTimeoutMs }
    };
  }
  
  checkRecoveryCondition() {
    if (this.currentState !== RECALL_SOURCE_STATES.PROBING) {
      return { shouldRecover: false, reason: `当前状态为 ${this.currentState}，仅探测状态可恢复` };
    }
    
    const recentMetrics = this.requestMetrics.slice(-3);
    if (recentMetrics.length < 3) {
      return { shouldRecover: false, reason: `探测请求不足（${recentMetrics.length}/3）` };
    }
    
    const allSuccess = recentMetrics.every(r => r.status === REQUEST_STATUS.SUCCESS);
    
    if (allSuccess) {
      return {
        shouldRecover: true,
        reason: '连续3次探测请求成功，恢复健康状态',
        details: { probeSuccessCount: 3 }
      };
    }
    
    const failures = recentMetrics.filter(r => 
      [REQUEST_STATUS.FAILURE, REQUEST_STATUS.TIMEOUT].includes(r.status)
    );
    
    if (failures.length > 0) {
      return {
        shouldRecover: false,
        reason: `探测请求中有 ${failures.length} 次失败，继续熔断`,
        details: { failures: failures.length }
      };
    }
    
    return { shouldRecover: false, reason: '探测进行中，等待更多请求' };
  }
  
  isAvailableForRequest() {
    return this.currentState === RECALL_SOURCE_STATES.HEALTHY || 
           this.currentState === RECALL_SOURCE_STATES.DEGRADED ||
           this.currentState === RECALL_SOURCE_STATES.PROBING;
  }
  
  getWeight() {
    switch (this.currentState) {
      case RECALL_SOURCE_STATES.HEALTHY:
        return 1.0;
      case RECALL_SOURCE_STATES.DEGRADED:
        return 0.3;
      case RECALL_SOURCE_STATES.PROBING:
        return 0.1;
      case RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN:
        return 0;
      default:
        return 0;
    }
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      config: this.config,
      currentState: this.currentState,
      version: this.version,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpenAt: this.circuitBreakerOpenAt,
      lastProbeAt: this.lastProbeAt,
      metrics: this._getMetricsSnapshot(),
      stateHistory: this.stateHistory.slice(-20)
    };
  }
}

module.exports = {
  RecallSource
};