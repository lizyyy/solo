const {
  RECALL_SOURCE_STATES,
  isValidStateTransition,
  checkTransition,
  getValidTransitions,
  StateTransitionError,
  DuplicateTransitionError
} = require('../src/core');

describe('状态机 - 状态流转验证', () => {
  
  test('HEALTHY 只能流转到 DEGRADED', () => {
    const valid = isValidStateTransition(
      RECALL_SOURCE_STATES.HEALTHY,
      RECALL_SOURCE_STATES.DEGRADED
    );
    expect(valid.valid).toBe(true);
    
    const invalidToCB = isValidStateTransition(
      RECALL_SOURCE_STATES.HEALTHY,
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    );
    expect(invalidToCB.valid).toBe(false);
    
    const invalidToProbe = isValidStateTransition(
      RECALL_SOURCE_STATES.HEALTHY,
      RECALL_SOURCE_STATES.PROBING
    );
    expect(invalidToProbe.valid).toBe(false);
  });

  test('DEGRADED 可以流转到 HEALTHY 或 CIRCUIT_BREAKER_OPEN', () => {
    const toHealthy = isValidStateTransition(
      RECALL_SOURCE_STATES.DEGRADED,
      RECALL_SOURCE_STATES.HEALTHY
    );
    expect(toHealthy.valid).toBe(true);
    
    const toCB = isValidStateTransition(
      RECALL_SOURCE_STATES.DEGRADED,
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    );
    expect(toCB.valid).toBe(true);
    
    const invalidToProbe = isValidStateTransition(
      RECALL_SOURCE_STATES.DEGRADED,
      RECALL_SOURCE_STATES.PROBING
    );
    expect(invalidToProbe.valid).toBe(false);
  });

  test('CIRCUIT_BREAKER_OPEN 只能流转到 PROBING', () => {
    const toProbe = isValidStateTransition(
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
      RECALL_SOURCE_STATES.PROBING
    );
    expect(toProbe.valid).toBe(true);
    
    const invalidToHealthy = isValidStateTransition(
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
      RECALL_SOURCE_STATES.HEALTHY
    );
    expect(invalidToHealthy.valid).toBe(false);
    
    const invalidToDegraded = isValidStateTransition(
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN,
      RECALL_SOURCE_STATES.DEGRADED
    );
    expect(invalidToDegraded.valid).toBe(false);
  });

  test('PROBING 可以流转到 HEALTHY 或 CIRCUIT_BREAKER_OPEN', () => {
    const toHealthy = isValidStateTransition(
      RECALL_SOURCE_STATES.PROBING,
      RECALL_SOURCE_STATES.HEALTHY
    );
    expect(toHealthy.valid).toBe(true);
    
    const toCB = isValidStateTransition(
      RECALL_SOURCE_STATES.PROBING,
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    );
    expect(toCB.valid).toBe(true);
    
    const invalidToDegraded = isValidStateTransition(
      RECALL_SOURCE_STATES.PROBING,
      RECALL_SOURCE_STATES.DEGRADED
    );
    expect(invalidToDegraded.valid).toBe(false);
  });

  test('checkTransition 应该正确检测重复提交', () => {
    const result = checkTransition('source-1', RECALL_SOURCE_STATES.HEALTHY, RECALL_SOURCE_STATES.HEALTHY);
    
    expect(result.valid).toBe(false);
    expect(result.isDuplicate).toBe(true);
    expect(result.error).toBeInstanceOf(DuplicateTransitionError);
    expect(result.error.message).toContain('重复状态提交');
    expect(result.error.message).toContain('source-1');
  });

  test('checkTransition 应该正确检测非法流转', () => {
    const result = checkTransition(
      'source-1',
      RECALL_SOURCE_STATES.HEALTHY,
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    );
    
    expect(result.valid).toBe(false);
    expect(result.isDuplicate).toBe(false);
    expect(result.error).toBeInstanceOf(StateTransitionError);
    expect(result.error.message).toContain('状态流转非法');
    expect(result.error.fromState).toBe(RECALL_SOURCE_STATES.HEALTHY);
    expect(result.error.toState).toBe(RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN);
  });

  test('getValidTransitions 应该返回正确的可流转状态', () => {
    const healthyTransitions = getValidTransitions(RECALL_SOURCE_STATES.HEALTHY);
    expect(healthyTransitions).toEqual([RECALL_SOURCE_STATES.DEGRADED]);
    
    const degradedTransitions = getValidTransitions(RECALL_SOURCE_STATES.DEGRADED);
    expect(degradedTransitions).toEqual([
      RECALL_SOURCE_STATES.HEALTHY,
      RECALL_SOURCE_STATES.CIRCUIT_BREAKER_OPEN
    ]);
  });
});