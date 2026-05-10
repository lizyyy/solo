const {
  RECALL_SOURCE_STATES,
  REQUEST_STATUS,
  RecallService
} = require('../src/core');

describe('RecallService - 服务层功能', () => {
  
  test('可以注册和获取召回源', () => {
    const service = new RecallService();
    
    const result = service.registerSource('source-1', '测试召回源');
    expect(result.success).toBe(true);
    expect(result.source.id).toBe('source-1');
    
    const source = service.getSource('source-1');
    expect(source).not.toBeNull();
    expect(source.name).toBe('测试召回源');
  });

  test('重复注册相同ID会失败', () => {
    const service = new RecallService();
    
    service.registerSource('source-1', '第一个');
    const result = service.registerSource('source-1', '第二个');
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('已存在');
  });

  test('获取所有召回源', () => {
    const service = new RecallService();
    
    service.registerSource('source-1', '源1');
    service.registerSource('source-2', '源2');
    
    const sources = service.getAllSources();
    expect(sources.length).toBe(2);
  });

  test('熔断状态的召回源不被视为可用', () => {
    const service = new RecallService();
    
    service.registerSource('source-1', '健康源');
    service.registerSource('source-2', '熔断源');
    
    service.manualTransition('source-2', RECALL_SOURCE_STATES.DEGRADED, '测试');
    service.manualTransition('source-2', RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, '测试');
    
    const available = service.getAvailableSources();
    expect(available.length).toBe(1);
    expect(available[0].id).toBe('source-1');
  });

  test('降级信息可以正确返回', () => {
    const service = new RecallService();
    
    service.registerSource('source-1', '健康源');
    service.registerSource('source-2', '降级源');
    
    const info1 = service.getDegradationInfo();
    expect(info1.isDegraded).toBe(false);
    expect(info1.reason).toContain('正常');
    
    service.manualTransition('source-2', RECALL_SOURCE_STATES.DEGRADED, '测试');
    
    const info2 = service.getDegradationInfo();
    expect(info2.isDegraded).toBe(true);
    expect(info2.reason).toContain('降级源');
  });

  test('可以手动切换召回源状态', () => {
    const service = new RecallService();
    service.registerSource('source-1', '测试源');
    
    const result = service.manualTransition(
      'source-1',
      RECALL_SOURCE_STATES.DEGRADED,
      '手动测试'
    );
    
    expect(result.success).toBe(true);
    expect(service.getSource('source-1').currentState).toBe(RECALL_SOURCE_STATES.DEGRADED);
  });

  test('手动切换非法状态会失败', () => {
    const service = new RecallService();
    service.registerSource('source-1', '测试源');
    
    const result = service.manualTransition(
      'source-1',
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
      '非法切换'
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('状态流转非法');
  });

  test('可以记录召回源请求结果', () => {
    const service = new RecallService();
    service.registerSource('source-1', '测试源');
    
    const result = service.recordSourceResult('source-1', REQUEST_STATUS.SUCCESS, 50);
    
    expect(result.success).toBe(true);
    expect(result.record.status).toBe(REQUEST_STATUS.SUCCESS);
    expect(result.record.latencyMs).toBe(50);
  });

  test('自动评估可以触发降级', () => {
    const service = new RecallService();
    service.registerSource('source-1', '测试源', {
      failureRateThreshold: 0.3,
      consecutiveFailuresThreshold: 3
    });
    
    const source = service.getSource('source-1');
    
    for (let i = 0; i < 10; i++) {
      source.recordRequest(REQUEST_STATUS.FAILURE);
    }
    
    const result = service.evaluateAndTransition('source-1');
    
    expect(result.success).toBe(true);
    expect(result.transition).not.toBeNull();
    expect(source.currentState).toBe(RECALL_SOURCE_STATES.DEGRADED);
  });

  test('评估所有召回源', () => {
    const service = new RecallService();
    
    service.registerSource('source-1', '源1');
    service.registerSource('source-2', '源2');
    
    const results = service.evaluateAllSources();
    
    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
  });

  test('处理召回请求并记录曝光', () => {
    const service = new RecallService();
    service.registerSource('source-1', '源1');
    service.registerSource('source-2', '源2');
    
    const result = service.processRecallRequest('user-123');
    
    expect(result.requestId).toBeDefined();
    expect(result.userId).toBe('user-123');
    expect(result.selectedSources.length).toBe(2);
    expect(result.logId).toBeDefined();
  });
});

describe('ExposureLog - 曝光记录和报表', () => {
  
  test('可以记录曝光日志', () => {
    const service = new RecallService();
    service.registerSource('source-1', '源1');
    
    for (let i = 0; i < 5; i++) {
      service.processRecallRequest(`user-${i}`);
    }
    
    const logs = service.getExposureLogs();
    expect(logs.length).toBe(5);
  });

  test('可以按用户ID筛选曝光日志', () => {
    const service = new RecallService();
    service.registerSource('source-1', '源1');
    
    service.processRecallRequest('user-1');
    service.processRecallRequest('user-1');
    service.processRecallRequest('user-2');
    
    const logs = service.getExposureLogs({ userId: 'user-1' });
    expect(logs.length).toBe(2);
    logs.forEach(log => expect(log.userId).toBe('user-1'));
  });

  test('可以按召回源ID筛选曝光日志', () => {
    const service = new RecallService();
    service.registerSource('source-1', '源1');
    service.registerSource('source-2', '源2');
    
    for (let i = 0; i < 3; i++) {
      service.processRecallRequest(`user-${i}`);
    }
    
    const logs = service.getExposureLogs({ sourceId: 'source-1' });
    expect(logs.length).toBe(3);
  });

  test('可以生成效果报表', () => {
    const service = new RecallService();
    service.registerSource('source-1', '源1');
    
    const now = Date.now();
    
    for (let i = 0; i < 10; i++) {
      service.processRecallRequest(`user-${i}`);
    }
    
    const report = service.getReport(now - 60000, now + 60000);
    
    expect(report.exposureReport.summary.totalRequests).toBe(10);
    expect(report.sourceStates.length).toBe(1);
  });

  test('降级状态会在曝光日志中体现', () => {
    const service = new RecallService();
    service.registerSource('source-1', '健康源');
    service.registerSource('source-2', '降级源');
    
    service.manualTransition('source-2', RECALL_SOURCE_STATES.DEGRADED, '测试');
    service.manualTransition('source-2', RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN, '测试');
    
    const result = service.processRecallRequest('user-1');
    
    expect(result.degradationInfo.isDegraded).toBe(true);
    expect(result.degradationInfo.skippedSources.length).toBe(1);
    expect(result.degradationInfo.skippedSources[0].id).toBe('source-2');
  });
});