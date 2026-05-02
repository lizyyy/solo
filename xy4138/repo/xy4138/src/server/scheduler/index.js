const { ReplayScheduler, PlaybackState } = require('./replay-scheduler');
const { RealtimeReceiver, ReceiverState } = require('./realtime-receiver');

const Mode = {
  REPLAY: 'replay',
  REALTIME: 'realtime'
};

class TelemetryManager {
  constructor(options = {}) {
    this.options = options;
    this.mode = Mode.REPLAY;
    
    this.replayScheduler = new ReplayScheduler(options.replay || {});
    this.realtimeReceiver = new RealtimeReceiver(options.realtime || {});
    
    this.tags = [];
    this.currentSession = null;
  }

  setMode(mode) {
    if (mode !== Mode.REPLAY && mode !== Mode.REALTIME) {
      throw new Error(`Invalid mode: ${mode}. Must be 'replay' or 'realtime'`);
    }
    
    if (this.mode === Mode.REPLAY && mode === Mode.REALTIME) {
      this.replayScheduler.stop();
    }
    
    this.mode = mode;
    return mode;
  }

  getMode() {
    return this.mode;
  }

  initRealtime(httpServer) {
    return this.realtimeReceiver.startServer(httpServer);
  }

  loadTelemetryData(frames) {
    return this.replayScheduler.loadFrames(frames);
  }

  getReplayScheduler() {
    return this.replayScheduler;
  }

  getRealtimeReceiver() {
    return this.realtimeReceiver;
  }

  addTag(tag) {
    const newTag = {
      id: tag.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: tag.timestamp || Date.now(),
      name: tag.name || 'Untagged',
      description: tag.description || '',
      color: tag.color || '#3498db',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.tags.push(newTag);
    this.tags.sort((a, b) => a.timestamp - b.timestamp);
    
    return newTag;
  }

  updateTag(tagId, updates) {
    const index = this.tags.findIndex(t => t.id === tagId);
    if (index === -1) {
      return null;
    }
    
    this.tags[index] = {
      ...this.tags[index],
      ...updates,
      updatedAt: Date.now()
    };
    
    return this.tags[index];
  }

  removeTag(tagId) {
    const index = this.tags.findIndex(t => t.id === tagId);
    if (index === -1) {
      return false;
    }
    
    this.tags.splice(index, 1);
    return true;
  }

  getTags() {
    return [...this.tags];
  }

  getTagsInRange(startTimestamp, endTimestamp) {
    return this.tags.filter(t => 
      t.timestamp >= startTimestamp && t.timestamp <= endTimestamp
    );
  }

  clearTags() {
    this.tags = [];
  }

  createSession(name = 'Untitled Session') {
    this.currentSession = {
      id: `session_${Date.now()}`,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mode: this.mode,
      tags: [...this.tags],
      replayStats: this.replayScheduler.getStats(),
      realtimeStats: this.realtimeReceiver.getStats(),
      notes: ''
    };
    
    return this.currentSession;
  }

  loadSession(sessionData) {
    this.currentSession = {
      ...sessionData,
      updatedAt: Date.now()
    };
    
    if (sessionData.tags) {
      this.tags = [...sessionData.tags];
    }
    
    if (sessionData.mode) {
      this.mode = sessionData.mode;
    }
    
    return this.currentSession;
  }

  getCurrentSession() {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  updateSession(updates) {
    if (!this.currentSession) {
      return null;
    }
    
    this.currentSession = {
      ...this.currentSession,
      ...updates,
      updatedAt: Date.now(),
      tags: [...this.tags],
      replayStats: this.replayScheduler.getStats(),
      realtimeStats: this.realtimeReceiver.getStats()
    };
    
    return this.currentSession;
  }

  clearSession() {
    this.currentSession = null;
    this.tags = [];
  }

  getState() {
    return {
      mode: this.mode,
      tags: this.tags,
      currentSession: this.currentSession,
      replay: this.replayScheduler.getStats(),
      realtime: this.realtimeReceiver.getStats()
    };
  }
}

module.exports = {
  TelemetryManager,
  Mode,
  ReplayScheduler,
  PlaybackState,
  RealtimeReceiver,
  ReceiverState
};
