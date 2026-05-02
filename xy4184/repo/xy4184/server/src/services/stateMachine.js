const config = require('../config');

const WEBRTC_STATES = {
  NEW: 'new',
  CONNECTING: 'connecting',
  CHECKING: 'checking',
  CONNECTED: 'connected',
  COMPLETED: 'completed',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed',
  CLOSED: 'closed',
};

const EVENT_TYPES = {
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice_candidate',
  ICE_CONNECTION_STATE_CHANGE: 'ice_connection_state_change',
  SIGNALING_STATE_CHANGE: 'signaling_state_change',
  TRACK: 'track',
  DATA_CHANNEL: 'data_channel',
  RECONNECT_START: 'reconnect_start',
  RECONNECT_SUCCESS: 'reconnect_success',
  RECONNECT_FAILED: 'reconnect_failed',
  NETWORK_INJECTION: 'network_injection',
  RECORDING_START: 'recording_start',
  RECORDING_STOP: 'recording_stop',
  RECORDING_GAP: 'recording_gap',
  AUDIO_LEVEL: 'audio_level',
  STATS: 'stats',
  ERROR: 'error',
};

class StateMachine {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.sessionInfo = {
      name: options.name || `Session-${sessionId.slice(0, 8)}`,
      description: options.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.currentState = WEBRTC_STATES.NEW;
    this.previousState = null;
    this.events = [];
    this.offers = [];
    this.answers = [];
    this.iceCandidates = [];
    this.tracks = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.WEBRTC.RECONNECT_ATTEMPTS;
    
    this.negotiationSequence = [];
    this.recordingTimeline = [];
    this.networkInjections = [];
    
    this.stateTransitions = {
      [WEBRTC_STATES.NEW]: [WEBRTC_STATES.CONNECTING],
      [WEBRTC_STATES.CONNECTING]: [WEBRTC_STATES.CHECKING, WEBRTC_STATES.FAILED],
      [WEBRTC_STATES.CHECKING]: [WEBRTC_STATES.CONNECTED, WEBRTC_STATES.FAILED, WEBRTC_STATES.DISCONNECTED],
      [WEBRTC_STATES.CONNECTED]: [WEBRTC_STATES.COMPLETED, WEBRTC_STATES.DISCONNECTED, WEBRTC_STATES.FAILED],
      [WEBRTC_STATES.COMPLETED]: [WEBRTC_STATES.DISCONNECTED, WEBRTC_STATES.FAILED],
      [WEBRTC_STATES.DISCONNECTED]: [WEBRTC_STATES.CONNECTING, WEBRTC_STATES.FAILED, WEBRTC_STATES.CLOSED],
      [WEBRTC_STATES.FAILED]: [WEBRTC_STATES.CONNECTING, WEBRTC_STATES.CLOSED],
      [WEBRTC_STATES.CLOSED]: [],
    };
  }
  
  getSessionInfo() {
    return { ...this.sessionInfo, sessionId: this.sessionId };
  }
  
  getCurrentState() {
    return this.currentState;
  }
  
  getPreviousState() {
    return this.previousState;
  }
  
  getEvents() {
    return [...this.events];
  }
  
  getOffers() {
    return [...this.offers];
  }
  
  getAnswers() {
    return [...this.answers];
  }
  
  getIceCandidates() {
    return [...this.iceCandidates];
  }
  
  getTracks() {
    return [...this.tracks];
  }
  
  getReconnectAttempts() {
    return this.reconnectAttempts;
  }
  
  getNegotiationSequence() {
    return [...this.negotiationSequence];
  }
  
  getRecordingTimeline() {
    return [...this.recordingTimeline];
  }
  
  getNetworkInjections() {
    return [...this.networkInjections];
  }
  
  addEvent(event) {
    const enrichedEvent = {
      ...event,
      id: event.id || this.generateEventId(),
      timestamp: event.timestamp || Date.now(),
      relativeTimestamp: this.events.length === 0 
        ? 0 
        : event.timestamp - this.events[0].timestamp,
    };
    
    this.events.push(enrichedEvent);
    this.sessionInfo.updatedAt = new Date().toISOString();
    
    this.processEvent(enrichedEvent);
    
    return enrichedEvent;
  }
  
  processEvent(event) {
    switch (event.type) {
      case EVENT_TYPES.OFFER:
        this.offers.push(event);
        this.negotiationSequence.push({
          type: 'offer',
          eventId: event.id,
          timestamp: event.timestamp,
        });
        this.transitionState(WEBRTC_STATES.CONNECTING);
        break;
        
      case EVENT_TYPES.ANSWER:
        this.answers.push(event);
        this.negotiationSequence.push({
          type: 'answer',
          eventId: event.id,
          timestamp: event.timestamp,
        });
        break;
        
      case EVENT_TYPES.ICE_CANDIDATE:
        this.iceCandidates.push(event);
        if (this.currentState === WEBRTC_STATES.CONNECTING) {
          this.transitionState(WEBRTC_STATES.CHECKING);
        }
        break;
        
      case EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE:
        this.transitionState(event.state);
        break;
        
      case EVENT_TYPES.TRACK:
        this.tracks.push({
          eventId: event.id,
          kind: event.kind,
          id: event.trackId,
          label: event.label,
          timestamp: event.timestamp,
        });
        break;
        
      case EVENT_TYPES.RECONNECT_START:
        this.reconnectAttempts++;
        this.transitionState(WEBRTC_STATES.CONNECTING);
        break;
        
      case EVENT_TYPES.RECONNECT_SUCCESS:
        this.transitionState(WEBRTC_STATES.CONNECTED);
        break;
        
      case EVENT_TYPES.RECONNECT_FAILED:
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.transitionState(WEBRTC_STATES.FAILED);
        }
        break;
        
      case EVENT_TYPES.NETWORK_INJECTION:
        this.networkInjections.push({
          eventId: event.id,
          type: event.injectionType,
          latency: event.latency,
          packetLoss: event.packetLoss,
          duration: event.duration,
          timestamp: event.timestamp,
        });
        break;
        
      case EVENT_TYPES.RECORDING_START:
        this.recordingTimeline.push({
          type: 'start',
          eventId: event.id,
          timestamp: event.timestamp,
          recordingId: event.recordingId,
        });
        break;
        
      case EVENT_TYPES.RECORDING_STOP:
        this.recordingTimeline.push({
          type: 'stop',
          eventId: event.id,
          timestamp: event.timestamp,
          recordingId: event.recordingId,
        });
        break;
        
      case EVENT_TYPES.RECORDING_GAP:
        this.recordingTimeline.push({
          type: 'gap',
          eventId: event.id,
          timestamp: event.timestamp,
          gapDuration: event.gapDuration,
          recordingId: event.recordingId,
        });
        break;
        
      case EVENT_TYPES.AUDIO_LEVEL:
        if (event.level !== undefined) {
          const lastTrack = this.tracks[this.tracks.length - 1];
          if (lastTrack && lastTrack.kind === 'audio') {
            if (!lastTrack.audioLevels) lastTrack.audioLevels = [];
            lastTrack.audioLevels.push({
              level: event.level,
              timestamp: event.timestamp,
            });
          }
        }
        break;
    }
  }
  
  transitionState(newState) {
    if (newState === this.currentState) return;
    
    if (!this.stateTransitions[this.currentState]?.includes(newState)) {
      console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
    }
    
    this.previousState = this.currentState;
    this.currentState = newState;
    
    this.addEvent({
      type: EVENT_TYPES.SIGNALING_STATE_CHANGE,
      previousState: this.previousState,
      newState: this.currentState,
    });
  }
  
  injectNetworkEvent(event) {
    return this.addEvent({
      type: EVENT_TYPES.NETWORK_INJECTION,
      injectionType: event.type,
      latency: event.latency,
      packetLoss: event.packetLoss,
      duration: event.duration,
      timestamp: event.timestamp || Date.now(),
    });
  }
  
  getConnectionDuration() {
    if (this.events.length < 2) return 0;
    const firstEvent = this.events[0];
    const lastEvent = this.events[this.events.length - 1];
    return lastEvent.timestamp - firstEvent.timestamp;
  }
  
  getStats() {
    const connectedEvents = this.events.filter(e => 
      e.type === EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE && 
      e.state === WEBRTC_STATES.CONNECTED
    );
    
    const disconnectedEvents = this.events.filter(e => 
      e.type === EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE && 
      e.state === WEBRTC_STATES.DISCONNECTED
    );
    
    const failedEvents = this.events.filter(e => 
      e.type === EVENT_TYPES.ICE_CONNECTION_STATE_CHANGE && 
      e.state === WEBRTC_STATES.FAILED
    );
    
    const audioTracks = this.tracks.filter(t => t.kind === 'audio');
    const videoTracks = this.tracks.filter(t => t.kind === 'video');
    
    const recordingGaps = this.recordingTimeline.filter(t => t.type === 'gap');
    
    return {
      sessionId: this.sessionId,
      currentState: this.currentState,
      totalEvents: this.events.length,
      offers: this.offers.length,
      answers: this.answers.length,
      iceCandidates: this.iceCandidates.length,
      connectedCount: connectedEvents.length,
      disconnectedCount: disconnectedEvents.length,
      failedCount: failedEvents.length,
      reconnectAttempts: this.reconnectAttempts,
      audioTracks: audioTracks.length,
      videoTracks: videoTracks.length,
      recordingGaps: recordingGaps.length,
      networkInjections: this.networkInjections.length,
      connectionDurationMs: this.getConnectionDuration(),
    };
  }
  
  toJSON() {
    return {
      sessionId: this.sessionId,
      sessionInfo: this.sessionInfo,
      currentState: this.currentState,
      previousState: this.previousState,
      events: this.events,
      offers: this.offers,
      answers: this.answers,
      iceCandidates: this.iceCandidates,
      tracks: this.tracks,
      reconnectAttempts: this.reconnectAttempts,
      negotiationSequence: this.negotiationSequence,
      recordingTimeline: this.recordingTimeline,
      networkInjections: this.networkInjections,
      stats: this.getStats(),
    };
  }
  
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = {
  StateMachine,
  WEBRTC_STATES,
  EVENT_TYPES,
};
