const test = require('node:test');
const assert = require('node:assert');
const { StateMachine, WEBRTC_STATES, EVENT_TYPES } = require('../src/services/stateMachine');

test('StateMachine - 初始化', () => {
  const stateMachine = new StateMachine('test-session-001', {
    name: 'Test Session',
    description: 'Test Description',
  });
  
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.NEW);
  assert.strictEqual(stateMachine.getSessionInfo().name, 'Test Session');
  assert.strictEqual(stateMachine.getEvents().length, 0);
});

test('StateMachine - 添加事件', () => {
  const stateMachine = new StateMachine('test-session-002');
  
  const event = {
    type: EVENT_TYPES.OFFER,
    sdp: 'test-sdp',
    timestamp: Date.now(),
  };
  
  const addedEvent = stateMachine.addEvent(event);
  
  assert.strictEqual(stateMachine.getEvents().length, 2);
  assert.strictEqual(addedEvent.type, EVENT_TYPES.OFFER);
  assert.ok(addedEvent.id);
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.CONNECTING);
});

test('StateMachine - 协商序列', () => {
  const stateMachine = new StateMachine('test-session-003');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 2000 });
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 3000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 4000 });
  
  const sequence = stateMachine.getNegotiationSequence();
  assert.strictEqual(sequence.length, 4);
  assert.strictEqual(sequence[0].type, 'offer');
  assert.strictEqual(sequence[1].type, 'answer');
  assert.strictEqual(sequence[2].type, 'offer');
  assert.strictEqual(sequence[3].type, 'answer');
});

test('StateMachine - 状态转换', () => {
  const stateMachine = new StateMachine('test-session-004');
  
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.NEW);
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.CONNECTING);
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTED,
    timestamp: 2000 
  });
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.CONNECTED);
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.COMPLETED,
    timestamp: 3000 
  });
  assert.strictEqual(stateMachine.getCurrentState(), WEBRTC_STATES.COMPLETED);
});

test('StateMachine - 重连计数', () => {
  const stateMachine = new StateMachine('test-session-005');
  
  assert.strictEqual(stateMachine.getReconnectAttempts(), 0);
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_START, timestamp: 1000 });
  assert.strictEqual(stateMachine.getReconnectAttempts(), 1);
  
  stateMachine.addEvent({ type: EVENT_TYPES.RECONNECT_START, timestamp: 2000 });
  assert.strictEqual(stateMachine.getReconnectAttempts(), 2);
});

test('StateMachine - 媒体轨道', () => {
  const stateMachine = new StateMachine('test-session-006');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'audio', 
    trackId: 'audio-0', 
    label: 'microphone',
    timestamp: 1000 
  });
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.TRACK, 
    kind: 'video', 
    trackId: 'video-0', 
    label: 'camera',
    timestamp: 2000 
  });
  
  const tracks = stateMachine.getTracks();
  assert.strictEqual(tracks.length, 2);
  assert.strictEqual(tracks[0].kind, 'audio');
  assert.strictEqual(tracks[1].kind, 'video');
});

test('StateMachine - 录制时间线', () => {
  const stateMachine = new StateMachine('test-session-007');
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.RECORDING_START, 
    recordingId: 'rec-001',
    timestamp: 1000 
  });
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.RECORDING_GAP, 
    recordingId: 'rec-001',
    gapDuration: 5000,
    timestamp: 20000 
  });
  
  stateMachine.addEvent({ 
    type: EVENT_TYPES.RECORDING_STOP, 
    recordingId: 'rec-001',
    timestamp: 60000 
  });
  
  const timeline = stateMachine.getRecordingTimeline();
  assert.strictEqual(timeline.length, 3);
  assert.strictEqual(timeline[0].type, 'start');
  assert.strictEqual(timeline[1].type, 'gap');
  assert.strictEqual(timeline[1].gapDuration, 5000);
  assert.strictEqual(timeline[2].type, 'stop');
});

test('StateMachine - 统计信息', () => {
  const stateMachine = new StateMachine('test-session-008');
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 0 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ICE_CANDIDATE, candidate: 'test', timestamp: 2000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ICE_CANDIDATE, candidate: 'test2', timestamp: 3000 });
  stateMachine.addEvent({ 
    type: EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE, 
    state: WEBRTC_STATES.CONNECTED,
    timestamp: 4000 
  });
  
  const stats = stateMachine.getStats();
  assert.strictEqual(stats.offers, 1);
  assert.strictEqual(stats.answers, 1);
  assert.strictEqual(stats.iceCandidates, 2);
  assert.strictEqual(stats.connectedCount, 1);
  assert.strictEqual(stats.totalEvents, 8);
});

test('StateMachine - 网络注入事件', () => {
  const stateMachine = new StateMachine('test-session-009');
  
  stateMachine.injectNetworkEvent({
    type: 'latency',
    latency: 500,
    duration: 10000,
    timestamp: Date.now(),
  });
  
  stateMachine.injectNetworkEvent({
    type: 'packet_loss',
    packetLoss: 0.1,
    duration: 5000,
    timestamp: Date.now() + 20000,
  });
  
  const injections = stateMachine.getNetworkInjections();
  assert.strictEqual(injections.length, 2);
  assert.strictEqual(injections[0].type, 'latency');
  assert.strictEqual(injections[0].latency, 500);
  assert.strictEqual(injections[1].type, 'packet_loss');
  assert.strictEqual(injections[1].packetLoss, 0.1);
});

test('StateMachine - toJSON 序列化', () => {
  const stateMachine = new StateMachine('test-session-010', {
    name: 'JSON Test',
    description: 'Test for JSON serialization',
  });
  
  stateMachine.addEvent({ type: EVENT_TYPES.OFFER, timestamp: 1000 });
  stateMachine.addEvent({ type: EVENT_TYPES.ANSWER, timestamp: 2000 });
  
  const json = stateMachine.toJSON();
  
  assert.strictEqual(json.sessionId, 'test-session-010');
  assert.strictEqual(json.sessionInfo.name, 'JSON Test');
  assert.strictEqual(json.currentState, WEBRTC_STATES.CONNECTING);
  assert.strictEqual(json.events.length, 3);
  assert.strictEqual(json.offers.length, 1);
  assert.strictEqual(json.answers.length, 1);
  assert.ok(json.stats);
});
