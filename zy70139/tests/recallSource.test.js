const {
  RECALL_SOURCE_STATES,
  REQUEST_STATUS,
  RecallSource
} = require('../src/core');

describe('RecallSource - 召回源核心功能', () => {
  
  test('初始化时状态为 HEALTHY', () => {
    const source = new RecallSource('test-source', '测试召回源');
    expect(source.currentState).toBe(RECALL_SOURCE_STATES.HEALTHY);
    expect(source.consecutiveFailures).toBe(0);
    expect(source.version).toBeGreaterThan(0);
  });

  test('记录请求成功时，连续失败计数归零', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    source.recordRequest(REQUEST_STATUS.FAILURE);
    expect(source.consecutiveFailures).toBe(1);
    
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    expect(source.consecutiveFailures).toBe(0);
  });

  test('连续失败请求时，连续失败计数递增', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    source.recordRequest(REQUEST_STATUS.FAILURE);
    source.recordRequest(REQUEST_STATUS.TIMEOUT);
    source.recordRequest(REQUEST_STATUS.FAILURE);
    
    expect(source.consecutiveFailures).toBe(3);
  });

  test('请求样本不足时不触发降级', () => {
    const source = new RecallSource('test-source', '测试召回源', {
      failureRateThreshold: 0.3,
      consecutiveFailuresThreshold: 5
    });
    
    for (let i = 0; i < 5; i++) {
      source.recordRequest(REQUEST_STATUS.FAILURE);
    }
    
    const check = source.checkDegradationCondition();
    expect(check.shouldDegrade).toBe(false);
    expect(check.reason).toContain('样本不足');
  });

  test('失败率超过阈值时触发降级', () => {
    const source = new RecallSource('test-source', '测试召回源', {
      failureRateThreshold: 0.3,
      consecutiveFailuresThreshold: 10
    });
    
    for (let i = 0; i < 7; i++) {
      source.recordRequest(REQUEST_STATUS.SUCCESS);
    }
    for (let i = 0; i < 4; i++) {
      source.recordRequest(REQUEST_STATUS.FAILURE);
    }
    
    const check = source.checkDegradationCondition();
    expect(check.shouldDegrade).toBe(true);
    expect(check.reason).toContain('失败率');
  });

  test('连续失败超过阈值时触发降级', () => {
    const source = new RecallSource('test-source', '测试召回源', {
      failureRateThreshold: 0.9,
      consecutiveFailuresThreshold: 3
    });
    
    for (let i = 0; i < 10; i++) {
      source.recordRequest(REQUEST_STATUS.SUCCESS);
    }
    for (let i = 0; i < 5; i++) {
      source.recordRequest(REQUEST_STATUS.FAILURE);
    }
    
    const check = source.checkDegradationCondition();
    expect(check.shouldDegrade).toBe(true);
    expect(check.reason).toContain('连续失败');
  });

  test('从 HEALTHY 可以流转到 DEGRADED', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    const result = source.transitionTo(
      RECALL_SOURCE_STATES.DEGRADED,
      'TEST',
      '测试降级'
    );
    
    expect(result.success).toBe(true);
    expect(source.currentState).toBe(RECALL_SOURCE_STATES.DEGRADED);
  });

  test('重复提交相同状态会被检测并返回错误', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    const result = source.transitionTo(
      RECALL_SOURCE_STATES.HEALTHY,
      'TEST',
      '重复提交'
    );
    
    expect(result.success).toBe(false);
    expect(result.isDuplicate).toBe(true);
    expect(result.error.message).toContain('重复状态提交');
  });

  test('非法状态流转会被阻止', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    const result = source.transitionTo(
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
      'TEST',
      '非法流转'
    );
    
    expect(result.success).toBe(false);
    expect(result.isDuplicate).toBe(false);
    expect(result.error.message).toContain('状态流转非法');
    expect(source.currentState).toBe(RECALL_SOURCE_STATES.HEALTHY);
  });

  test('降级状态权重降低', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    const healthyWeight = source.getWeight();
    expect(healthyWeight).toBe(1.0);
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '测试');
    const degradedWeight = source.getWeight();
    expect(degradedWeight).toBe(0.3);
    
    source.transitionTo(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, 'TEST', '测试');
    const cbWeight = source.getWeight();
    expect(cbWeight).toBe(0);
  });

  test('熔断超时后触发探测', () => {
    const source = new RecallSource('test-source', '测试召回源', {
      circuitBreakerTimeoutMs: 1000
    });
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '测试');
    source.transitionTo(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, 'TEST', '测试');
    
    const now = Date.now();
    const checkBefore = source.checkProbeCondition(now);
    expect(checkBefore.shouldProbe).toBe(false);
    
    const checkAfter = source.checkProbeCondition(now + 2000);
    expect(checkAfter.shouldProbe).toBe(true);
  });

  test('探测状态下连续3次成功恢复健康', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '测试');
    source.transitionTo(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, 'TEST', '测试');
    source.transitionTo(RECALL_SOURCE_STATES.PROBING, 'TEST', '测试');
    
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    
    const checkBefore = source.checkRecoveryCondition();
    expect(checkBefore.shouldRecover).toBe(false);
    
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    
    const checkAfter = source.checkRecoveryCondition();
    expect(checkAfter.shouldRecover).toBe(true);
  });

  test('探测状态下有失败则继续熔断', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '测试');
    source.transitionTo(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, 'TEST', '测试');
    source.transitionTo(RECALL_SOURCE_STATES.PROBING, 'TEST', '测试');
    
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    source.recordRequest(REQUEST_STATUS.FAILURE);
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    
    const check = source.checkRecoveryCondition();
    expect(check.shouldRecover).toBe(false);
    expect(check.reason).toContain('失败');
  });

  test('状态历史会被记录', () => {
    const source = new RecallSource('test-source', '测试召回源');
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '第一次');
    source.transitionTo(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, 'TEST', '第二次');
    
    const json = source.toJSON();
    expect(json.stateHistory.length).toBeGreaterThanOrEqual(3);
  });

  test('version 在状态变化和请求记录时递增', () => {
    const source = new RecallSource('test-source', '测试召回源');
    const version1 = source.version;
    
    source.recordRequest(REQUEST_STATUS.SUCCESS);
    const version2 = source.version;
    expect(version2).toBeGreaterThan(version1);
    
    source.transitionTo(RECALL_SOURCE_STATES.DEGRADED, 'TEST', '测试');
    const version3 = source.version;
    expect(version3).toBeGreaterThan(version2);
  });
});