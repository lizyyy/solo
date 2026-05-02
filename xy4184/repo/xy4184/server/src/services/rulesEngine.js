const config = require('../config');
const { EVENT_TYPES, WEBRTC_STATES } = require('./stateMachine');

const VALIDATION_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

const VALIDATION_RULES = {
  NEGOTIATION_ORDER: 'negotiation_order',
  AUDIO_TRACK_PRESENT: 'audio_track_present',
  RECONNECT_TIMEOUT: 'reconnect_timeout',
  RECORDING_GAP: 'recording_gap',
  ICE_CANDIDATE_COUNT: 'ice_candidate_count',
  STATE_TRANSITION_VALID: 'state_transition_valid',
  AUDIO_LEVEL_SILENCE: 'audio_level_silence',
};

class RulesEngine {
  constructor(options = {}) {
    this.options = {
      negotiationTimeout: config.VALIDATION_RULES.NEGOTIATION_TIMEOUT,
      reconnectTimeout: config.VALIDATION_RULES.RECONNECT_TIMEOUT,
      recordingGapThreshold: config.VALIDATION_RULES.RECORDING_GAP_THRESHOLD,
      audioTrackExpected: config.VALIDATION_RULES.AUDIO_TRACK_EXPECTED,
      videoTrackExpected: config.VALIDATION_RULES.VIDEO_TRACK_EXPECTED,
      ...options,
    };
  }
  
  validateAll(stateMachine) {
    const results = {
      sessionId: stateMachine.sessionId,
      validatedAt: new Date().toISOString(),
      rules: [],
      summary: {
        errors: 0,
        warnings: 0,
        infos: 0,
      },
    };
    
    const validators = [
      this.validateNegotiationOrder,
      this.validateAudioTrack,
      this.validateReconnectTimeout,
      this.validateRecordingGaps,
      this.validateIceCandidates,
      this.validateStateTransitions,
      this.validateAudioSilence,
    ];
    
    for (const validator of validators) {
      const result = validator.call(this, stateMachine);
      results.rules.push(result);
      
      if (result.severity === VALIDATION_SEVERITY.ERROR) {
        results.summary.errors++;
      } else if (result.severity === VALIDATION_SEVERITY.WARNING) {
        results.summary.warnings++;
      } else {
        results.summary.infos++;
      }
    }
    
    return results;
  }
  
  validateNegotiationOrder(stateMachine) {
    const negotiationSequence = stateMachine.getNegotiationSequence();
    const events = stateMachine.getEvents();
    
    const result = {
      rule: VALIDATION_RULES.NEGOTIATION_ORDER,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '协商顺序正常',
      details: [],
    };
    
    if (negotiationSequence.length === 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '没有协商事件记录';
      return result;
    }
    
    let expectOffer = true;
    for (let i = 0; i < negotiationSequence.length; i++) {
      const step = negotiationSequence[i];
      
      if (expectOffer) {
        if (step.type !== 'offer') {
          result.passed = false;
          result.severity = VALIDATION_SEVERITY.ERROR;
          result.message = `协商顺序错误：期望 offer，实际收到 ${step.type}`;
          result.details.push({
            position: i,
            expected: 'offer',
            actual: step.type,
            timestamp: step.timestamp,
          });
        }
        expectOffer = false;
      } else {
        if (step.type !== 'answer') {
          result.passed = false;
          result.severity = VALIDATION_SEVERITY.ERROR;
          result.message = `协商顺序错误：期望 answer，实际收到 ${step.type}`;
          result.details.push({
            position: i,
            expected: 'answer',
            actual: step.type,
            timestamp: step.timestamp,
          });
        }
        expectOffer = true;
      }
      
      if (i > 0) {
        const prevStep = negotiationSequence[i - 1];
        const timeDiff = step.timestamp - prevStep.timestamp;
        
        if (timeDiff > this.options.negotiationTimeout) {
          result.passed = false;
          result.severity = VALIDATION_SEVERITY.WARNING;
          result.message = `协商超时：步骤 ${i} 耗时 ${timeDiff}ms`;
          result.details.push({
            position: i,
            durationMs: timeDiff,
            thresholdMs: this.options.negotiationTimeout,
          });
        }
      }
    }
    
    if (result.passed) {
      result.details = [{ sequence: negotiationSequence.map(s => s.type).join(' -> ') }];
    }
    
    return result;
  }
  
  validateAudioTrack(stateMachine) {
    const tracks = stateMachine.getTracks();
    const audioTracks = tracks.filter(t => t.kind === 'audio');
    
    const result = {
      rule: VALIDATION_RULES.AUDIO_TRACK_PRESENT,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '音频轨道正常',
      details: [],
    };
    
    if (this.options.audioTrackExpected && audioTracks.length === 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.ERROR;
      result.message = '缺少音频轨道';
      return result;
    }
    
    result.details = {
      audioTracks: audioTracks.length,
      videoTracks: tracks.filter(t => t.kind === 'video').length,
    };
    
    if (audioTracks.length > 0) {
      for (const track of audioTracks) {
        if (track.audioLevels) {
          const silentPeriods = this.detectSilentPeriods(track.audioLevels);
          if (silentPeriods.length > 0) {
            result.details.silentPeriods = silentPeriods;
          }
        }
      }
    }
    
    return result;
  }
  
  validateReconnectTimeout(stateMachine) {
    const events = stateMachine.getEvents();
    const reconnectAttempts = stateMachine.getReconnectAttempts();
    
    const result = {
      rule: VALIDATION_RULES.RECONNECT_TIMEOUT,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '重连机制正常',
      details: [],
    };
    
    if (reconnectAttempts === 0) {
      result.details = { message: '无重连事件' };
      return result;
    }
    
    const reconnectStarts = events.filter(e => e.type === EVENT_TYPES.RECONNECT_START);
    const reconnectSuccesses = events.filter(e => e.type === EVENT_TYPES.RECONNECT_SUCCESS);
    const reconnectFailures = events.filter(e => e.type === EVENT_TYPES.RECONNECT_FAILED);
    
    result.details = {
      attempts: reconnectAttempts,
      successful: reconnectSuccesses.length,
      failed: reconnectFailures.length,
    };
    
    for (let i = 0; i < reconnectStarts.length; i++) {
      const start = reconnectStarts[i];
      const nextSuccess = reconnectSuccesses.find(s => s.timestamp > start.timestamp);
      const nextFailure = reconnectFailures.find(f => f.timestamp > start.timestamp);
      
      const endEvent = nextSuccess || nextFailure;
      
      if (endEvent) {
        const duration = endEvent.timestamp - start.timestamp;
        
        if (duration > this.options.reconnectTimeout) {
          result.passed = false;
          result.severity = VALIDATION_SEVERITY.ERROR;
          result.message = `重连超时：第 ${i + 1} 次重连耗时 ${duration}ms`;
          result.details.timeoutAttempts = result.details.timeoutAttempts || [];
          result.details.timeoutAttempts.push({
            attempt: i + 1,
            durationMs: duration,
            thresholdMs: this.options.reconnectTimeout,
            result: nextSuccess ? 'success' : 'failed',
          });
        }
      } else {
        result.passed = false;
        result.severity = VALIDATION_SEVERITY.WARNING;
        result.message = `重连未完成：第 ${i + 1} 次重连没有结果`;
      }
    }
    
    return result;
  }
  
  validateRecordingGaps(stateMachine) {
    const recordingTimeline = stateMachine.getRecordingTimeline();
    
    const result = {
      rule: VALIDATION_RULES.RECORDING_GAP,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '录制时间线正常',
      details: [],
    };
    
    if (recordingTimeline.length === 0) {
      result.details = { message: '无录制事件' };
      return result;
    }
    
    const explicitGaps = recordingTimeline.filter(t => t.type === 'gap');
    const computedGaps = [];
    
    for (let i = 1; i < recordingTimeline.length; i++) {
      const prev = recordingTimeline[i - 1];
      const curr = recordingTimeline[i];
      
      if (prev.type === 'stop' && curr.type === 'start') {
        const gapDuration = curr.timestamp - prev.timestamp;
        if (gapDuration > this.options.recordingGapThreshold) {
          computedGaps.push({
            between: `${prev.type} -> ${curr.type}`,
            durationMs: gapDuration,
            thresholdMs: this.options.recordingGapThreshold,
            prevTimestamp: prev.timestamp,
            currTimestamp: curr.timestamp,
          });
        }
      }
    }
    
    if (explicitGaps.length > 0 || computedGaps.length > 0) {
      result.passed = explicitGaps.length === 0 && computedGaps.length === 0;
      result.severity = result.passed ? VALIDATION_SEVERITY.INFO : VALIDATION_SEVERITY.ERROR;
      result.message = `检测到 ${explicitGaps.length + computedGaps.length} 个录制缺口`;
      result.details = {
        explicitGaps: explicitGaps.map(g => ({
          durationMs: g.gapDuration,
          timestamp: g.timestamp,
        })),
        computedGaps,
      };
    } else {
      result.details = {
        totalEvents: recordingTimeline.length,
        message: '无录制缺口',
      };
    }
    
    return result;
  }
  
  validateIceCandidates(stateMachine) {
    const iceCandidates = stateMachine.getIceCandidates();
    
    const result = {
      rule: VALIDATION_RULES.ICE_CANDIDATE_COUNT,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: 'ICE candidates 正常',
      details: {},
    };
    
    if (iceCandidates.length === 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '没有收集到 ICE candidates';
      return result;
    }
    
    const candidateTypes = {
      host: 0,
      srflx: 0,
      prflx: 0,
      relay: 0,
      unknown: 0,
    };
    
    for (const candidate of iceCandidates) {
      let type = 'unknown';
      if (candidate.candidate) {
        if (candidate.candidate.includes('typ host')) type = 'host';
        else if (candidate.candidate.includes('typ srflx')) type = 'srflx';
        else if (candidate.candidate.includes('typ prflx')) type = 'prflx';
        else if (candidate.candidate.includes('typ relay')) type = 'relay';
      }
      candidateTypes[type]++;
    }
    
    result.details = {
      total: iceCandidates.length,
      byType: candidateTypes,
    };
    
    if (candidateTypes.host === 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '没有 host 类型的 ICE candidates';
    } else if (candidateTypes.srflx === 0 && candidateTypes.relay === 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '没有公网类型的 ICE candidates (srflx/relay)';
    }
    
    return result;
  }
  
  validateStateTransitions(stateMachine) {
    const events = stateMachine.getEvents();
    const stateChanges = events.filter(e => e.type === EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE);
    
    const result = {
      rule: VALIDATION_RULES.STATE_TRANSITION_VALID,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '状态转换正常',
      details: {},
    };
    
    if (stateChanges.length === 0) {
      result.details = { message: '无状态转换事件' };
      return result;
    }
    
    const transitions = [];
    for (let i = 0; i < stateChanges.length; i++) {
      transitions.push(stateChanges[i].state);
    }
    
    const finalState = transitions[transitions.length - 1];
    const hasConnected = transitions.includes(WEBRTC_STATES.CONNECTED) || 
                         transitions.includes(WEBRTC_STATES.COMPLETED);
    const hasFailed = transitions.includes(WEBRTC_STATES.FAILED);
    
    result.details = {
      transitionSequence: transitions.join(' -> '),
      finalState,
      everConnected: hasConnected,
      everFailed: hasFailed,
    };
    
    if (!hasConnected) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.ERROR;
      result.message = '连接从未达到 CONNECTED 或 COMPLETED 状态';
    } else if (hasFailed && finalState === WEBRTC_STATES.FAILED) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '连接最终以 FAILED 状态结束';
    }
    
    return result;
  }
  
  validateAudioSilence(stateMachine) {
    const tracks = stateMachine.getTracks();
    const audioTracks = tracks.filter(t => t.kind === 'audio');
    
    const result = {
      rule: VALIDATION_RULES.AUDIO_LEVEL_SILENCE,
      passed: true,
      severity: VALIDATION_SEVERITY.INFO,
      message: '音频音量正常',
      details: {},
    };
    
    let hasAudioLevels = false;
    const allSilentPeriods = [];
    
    for (const track of audioTracks) {
      if (track.audioLevels && track.audioLevels.length > 0) {
        hasAudioLevels = true;
        const silentPeriods = this.detectSilentPeriods(track.audioLevels);
        if (silentPeriods.length > 0) {
          allSilentPeriods.push({
            trackId: track.id,
            trackLabel: track.label,
            silentPeriods,
          });
        }
      }
    }
    
    if (!hasAudioLevels) {
      result.details = { message: '无音频音量数据' };
      return result;
    }
    
    if (allSilentPeriods.length > 0) {
      result.passed = false;
      result.severity = VALIDATION_SEVERITY.WARNING;
      result.message = '检测到音频静音时段';
      result.details = {
        tracksWithSilence: allSilentPeriods.length,
        silentPeriods: allSilentPeriods,
      };
    } else {
      result.details = { message: '无静音时段检测' };
    }
    
    return result;
  }
  
  detectSilentPeriods(audioLevels, silenceThreshold = 0.01, minSilenceDuration = 5000) {
    const silentPeriods = [];
    let currentSilence = null;
    
    for (let i = 0; i < audioLevels.length; i++) {
      const level = audioLevels[i].level;
      const timestamp = audioLevels[i].timestamp;
      
      if (level < silenceThreshold) {
        if (!currentSilence) {
          currentSilence = {
            startTimestamp: timestamp,
            startIndex: i,
          };
        }
      } else {
        if (currentSilence) {
          const duration = timestamp - currentSilence.startTimestamp;
          if (duration >= minSilenceDuration) {
            silentPeriods.push({
              startTimestamp: currentSilence.startTimestamp,
              endTimestamp: timestamp,
              durationMs: duration,
              sampleCount: i - currentSilence.startIndex,
            });
          }
          currentSilence = null;
        }
      }
    }
    
    if (currentSilence) {
      const lastLevel = audioLevels[audioLevels.length - 1];
      const duration = lastLevel.timestamp - currentSilence.startTimestamp;
      if (duration >= minSilenceDuration) {
        silentPeriods.push({
          startTimestamp: currentSilence.startTimestamp,
          endTimestamp: lastLevel.timestamp,
          durationMs: duration,
          sampleCount: audioLevels.length - currentSilence.startIndex,
          ongoing: true,
        });
      }
    }
    
    return silentPeriods;
  }
}

module.exports = {
  RulesEngine,
  VALIDATION_SEVERITY,
  VALIDATION_RULES,
};
