const test = require('node:test');
const assert = require('node:assert');
const { RulesEngine, VALIDATION_SEVERITY, VALIDATION_RULES } = require('../src/services/rulesEngine');
const { StateMachine, EVENT_TYPES, WEBRTC_STATES } = require('../src/services/stateMachine');

test('RulesEngine - 初始化', () => {
  const rulesEngine = new RulesEngine();
  assert.ok(rulesEngine);
});

test('RulesEngine - 正常协商序列校验', () => {
  const stateMachine = new StateMachine('test-validation-001');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 2000 });
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 5000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 6000 });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateNegotiationOrder(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.NEGOTIATION_ORDER);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.INFO);
});

test('RulesEngine - 错误的协商序列（Answer 在前）', () => {
  const stateMachine = new StateMachine('test-validation-002');
  
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 2000 });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateNegotiationOrder(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.NEGOTIATION_ORDER);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.ERROR);
});

test('RulesEngine - 音频轨道存在校验', () => {
  const stateMachine = new StateMachine('test-validation-003');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'audio', 
    trackId: 'audio-0', 
    timestamp: 1000 
  });
  
  const rulesEngine = new RulesEngine({ audioTrackExpected: true });
  const result = rulesEngine.validateAudioTrack(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.AUDIO_TRACK_PRESENT);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.details.audioTracks, 1);
});

test('RulesEngine - 缺少音频轨道校验', () => {
  const stateMachine = new StateMachine('test-validation-004');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'video', 
    trackId: 'video-0', 
    timestamp: 1000 
  });
  
  const rulesEngine = new RulesEngine({ audioTrackExpected: true });
  const result = rulesEngine.validateAudioTrack(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.AUDIO_TRACK_PRESENT);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.ERROR);
  assert.strictEqual(result.message, '缺少音频轨道');
});

test('RulesEngine - 重连超时校验', () => {
  const stateMachine = new StateMachine('test-validation-005');
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_START, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_SUCCESS, timestamp: 45000 });
  
  const rulesEngine = new RulesEngine({ reconnectTimeout: 30000 });
  const result = rulesEngine.validateReconnectTimeout(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.RECONNECT_TIMEOUT);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.ERROR);
  assert.ok(result.details.timeoutAttempts);
  assert.strictEqual(result.details.timeoutAttempts.length, 1);
});

test('RulesEngine - 正常重连校验', () => {
  const stateMachine = new StateMachine('test-validation-006');
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_START, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_SUCCESS, timestamp: 10000 });
  
  const rulesEngine = new RulesEngine({ reconnectTimeout: 30000 });
  const result = rulesEngine.validateReconnectTimeout(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.RECONNECT_TIMEOUT);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.details.attempts, 1);
  assert.strictEqual(result.details.successful, 1);
});

test('RulesEngine - 录制缺口校验', () => {
  const stateMachine = new StateMachine('test-validation-007');
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_START, recordingId: 'rec-001', timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_STOP, recordingId: 'rec-001', timestamp: 10000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_START, recordingId: 'rec-001', timestamp: 20000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_STOP, recordingId: 'rec-001', timestamp: 30000 });
  
  const rulesEngine = new RulesEngine({ recordingGapThreshold: 5000 });
  const result = rulesEngine.validateRecordingGaps(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.RECORDING_GAP);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.ERROR);
  assert.ok(result.details.computedGaps);
  assert.strictEqual(result.details.computedGaps.length, 1);
  assert.strictEqual(result.details.computedGaps[0].durationMs, 10000);
});

test('RulesEngine - 无录制缺口校验', () => {
  const stateMachine = new StateMachine('test-validation-008');
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_START, recordingId: 'rec-001', timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_STOP, recordingId: 'rec-001', timestamp: 10000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_START, recordingId: 'rec-001', timestamp: 12000 });
  stateMachine.addEvent({ type: EVENT_TYPES.RECORDING_STOP, recordingId: 'rec-001', timestamp: 20000 });
  
  const rulesEngine = new RulesEngine({ recordingGapThreshold: 5000 });
  const result = rulesEngine.validateRecordingGaps(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.RECORDING_GAP);
  assert.strictEqual(result.passed, true);
});

test('RulesEngine - ICE Candidates 校验', () => {
  const stateMachine = new StateMachine('test-validation-009');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CANDIDATE, 
    candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 12345 typ host', 
    timestamp: 1000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CANDIDATE, 
    candidate: 'candidate:1 1 UDP 1686052607 203.0.113.45 54321 typ srflx raddr 192.168.1.100 rport 12345', 
    timestamp: 2000 
  });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateIceCandidates(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.ICE_CANDIDATE_COUNT);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.details.total, 2);
  assert.strictEqual(result.details.byType.host, 1);
  assert.strictEqual(result.details.byType.srflx, 1);
});

test('RulesEngine - 缺少公网 ICE Candidates', () => {
  const stateMachine = new StateMachine('test-validation-010');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CANDIDATE, 
    candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 12345 typ host', 
    timestamp: 1000 
  });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateIceCandidates(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.ICE_CANDIDATE_COUNT);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.WARNING);
  assert.strictEqual(result.message, '没有公网类型的 ICE candidates (srflx/relay)');
});

test('RulesEngine - 状态转换校验（成功连接）', () => {
  const stateMachine = new StateMachine('test-validation-011');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTING, 
    timestamp: 2000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CHECKING, 
    timestamp: 3000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTED, 
    timestamp: 5000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.COMPLETED, 
    timestamp: 6000 
  });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateStateTransitions(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.STATE_TRANSITION_VALID);
  assert.strictEqual(result.passed, true);
  assert.strictEqual(result.details.everConnected, true);
  assert.strictEqual(result.details.finalState, WEBRTC_STATES.COMPLETED);
});

test('RulesEngine - 状态转换校验（失败连接）', () => {
  const stateMachine = new StateMachine('test-validation-012');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTING, 
    timestamp: 2000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CHECKING, 
    timestamp: 3000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.FAILED, 
    timestamp: 10000 
  });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateStateTransitions(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.STATE_TRANSITION_VALID);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.ERROR);
  assert.strictEqual(result.details.everConnected, false);
});

test('RulesEngine - 音频静音检测', () => {
  const stateMachine = new StateMachine('test-validation-013');
  
  const baseTime = 1000;
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'audio', 
    trackId: 'audio-0', 
    timestamp: baseTime 
  });
  
  for (let i = 0; i < 20; i++) {
    stateMachine.addEvent({ 
      type: EVENT_TYPES.AUDIO_LEVEL, 
      level: 0.0, 
      timestamp: baseTime + 1000 + i * 500 
    });
  }
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateAudioSilence(stateMachine);
  
  assert.strictEqual(result.rule, VALIDATION_RULES.AUDIO_LEVEL_SILENCE);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.severity, VALIDATION_SEVERITY.WARNING);
});

test('RulesEngine - 完整校验', () => {
  const stateMachine = new StateMachine('test-validation-014');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 2000 });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CANDIDATE, 
    candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 12345 typ host', 
    timestamp: 3000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CANDIDATE, 
    candidate: 'candidate:1 1 UDP 1686052607 203.0.113.45 54321 typ srflx raddr 192.168.1.100 rport 12345', 
    timestamp: 4000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTED, 
    timestamp: 5000 
  });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'audio', 
    trackId: 'audio-0', 
    timestamp: 6000 
  });
  
  const rulesEngine = new RulesEngine();
  const result = rulesEngine.validateAll(stateMachine);
  
  assert.strictEqual(result.sessionId, 'test-validation-014');
  assert.ok(result.validatedAt);
  assert.ok(Array.isArray(result.rules));
  assert.ok(result.summary);
});
