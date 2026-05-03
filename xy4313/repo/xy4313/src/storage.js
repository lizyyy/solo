export class StateStorage {
  constructor(storageKey = 'forklift-replay-session') {
    this.storageKey = storageKey;
    this.currentSession = null;
  }

  createSession(data) {
    const session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: data.name || `复盘会话 ${new Date().toLocaleDateString()}`,
      
      data: {
        shelves: data.shelves || null,
        forkliftTrajectory: data.forkliftTrajectory || null,
        nearMissEvents: data.nearMissEvents || null,
        cameraAnnotations: data.cameraAnnotations || null
      },
      
      derived: {
        detectedEvents: [],
        eventReviews: {},
        statistics: null
      },
      
      playbackState: {
        currentTime: 0,
        playbackSpeed: 1,
        isPlaying: false
      }
    };

    this.currentSession = session;
    this.save();
    return session;
  }

  loadSession(sessionId = null) {
    try {
      const sessions = this.getAllSessions();
      
      if (sessionId) {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          this.currentSession = session;
          return session;
        }
      } else if (sessions.length > 0) {
        this.currentSession = sessions[sessions.length - 1];
        return this.currentSession;
      }
      
      return null;
    } catch (e) {
      console.error('加载会话失败:', e);
      return null;
    }
  }

  save() {
    if (!this.currentSession) return;
    
    try {
      this.currentSession.updatedAt = new Date().toISOString();
      
      const sessions = this.getAllSessions();
      const index = sessions.findIndex(s => s.id === this.currentSession.id);
      
      if (index >= 0) {
        sessions[index] = this.currentSession;
      } else {
        sessions.push(this.currentSession);
      }
      
      const maxSessions = 20;
      if (sessions.length > maxSessions) {
        sessions.splice(0, sessions.length - maxSessions);
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('保存会话失败:', e);
    }
  }

  getAllSessions() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  deleteSession(sessionId) {
    try {
      let sessions = this.getAllSessions();
      sessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
      
      if (this.currentSession && this.currentSession.id === sessionId) {
        this.currentSession = null;
      }
    } catch (e) {
      console.error('删除会话失败:', e);
    }
  }

  updateData(type, data) {
    if (!this.currentSession) return;
    
    if (['shelves', 'forkliftTrajectory', 'nearMissEvents', 'cameraAnnotations'].includes(type)) {
      this.currentSession.data[type] = data;
      this.save();
    }
  }

  setDetectedEvents(events) {
    if (!this.currentSession) return;
    
    this.currentSession.derived.detectedEvents = events.map(event => ({
      ...event,
      reviewStatus: event.reviewStatus || 'unreviewed',
      reviewNotes: event.reviewNotes || ''
    }));
    
    this.currentSession.derived.eventReviews = {};
    this.currentSession.derived.detectedEvents.forEach((event, index) => {
      this.currentSession.derived.eventReviews[event.id] = {
        reviewStatus: event.reviewStatus || 'unreviewed',
        reviewNotes: event.reviewNotes || '',
        reviewer: null,
        reviewedAt: null
      };
    });
    
    this.updateStatistics();
    this.save();
  }

  updateEventReview(eventId, reviewData) {
    if (!this.currentSession) return false;
    
    const events = this.currentSession.derived.detectedEvents;
    const eventIndex = events.findIndex(e => e.id === eventId);
    
    if (eventIndex >= 0) {
      events[eventIndex] = {
        ...events[eventIndex],
        reviewStatus: reviewData.reviewStatus ?? events[eventIndex].reviewStatus,
        reviewNotes: reviewData.reviewNotes ?? events[eventIndex].reviewNotes
      };
      
      if (!this.currentSession.derived.eventReviews[eventId]) {
        this.currentSession.derived.eventReviews[eventId] = {};
      }
      
      this.currentSession.derived.eventReviews[eventId] = {
        ...this.currentSession.derived.eventReviews[eventId],
        reviewStatus: reviewData.reviewStatus,
        reviewNotes: reviewData.reviewNotes,
        reviewedAt: new Date().toISOString()
      };
      
      this.updateStatistics();
      this.save();
      return true;
    }
    
    return false;
  }

  getEventReview(eventId) {
    if (!this.currentSession) return null;
    return this.currentSession.derived.eventReviews[eventId] || null;
  }

  updateStatistics() {
    if (!this.currentSession) return;
    
    const events = this.currentSession.derived.detectedEvents;
    
    this.currentSession.derived.statistics = {
      total: events.length,
      byType: {},
      bySeverity: { high: 0, medium: 0, low: 0 },
      byReviewStatus: { unreviewed: 0, reviewed: 0, dismissed: 0, confirmed: 0 }
    };
    
    events.forEach(event => {
      this.currentSession.derived.statistics.byType[event.type] = 
        (this.currentSession.derived.statistics.byType[event.type] || 0) + 1;
      
      this.currentSession.derived.statistics.bySeverity[event.severity] = 
        (this.currentSession.derived.statistics.bySeverity[event.severity] || 0) + 1;
      
      this.currentSession.derived.statistics.byReviewStatus[event.reviewStatus] = 
        (this.currentSession.derived.statistics.byReviewStatus[event.reviewStatus] || 0) + 1;
    });
  }

  getStatistics() {
    if (!this.currentSession) return null;
    return this.currentSession.derived.statistics;
  }

  updatePlaybackState(state) {
    if (!this.currentSession) return;
    
    this.currentSession.playbackState = {
      ...this.currentSession.playbackState,
      ...state
    };
    
    this.save();
  }

  getPlaybackState() {
    if (!this.currentSession) return null;
    return this.currentSession.playbackState;
  }

  getDetectedEvents() {
    if (!this.currentSession) return [];
    return this.currentSession.derived.detectedEvents || [];
  }

  getData() {
    if (!this.currentSession) return null;
    return this.currentSession.data;
  }

  hasCompleteData() {
    if (!this.currentSession) return false;
    return !!(
      this.currentSession.data.shelves &&
      this.currentSession.data.forkliftTrajectory
    );
  }

  exportSession() {
    if (!this.currentSession) return null;
    
    return {
      ...this.currentSession,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  importSession(sessionData) {
    try {
      const session = {
        ...sessionData,
        id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        importedFrom: sessionData.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.currentSession = session;
      this.save();
      return session;
    } catch (e) {
      console.error('导入会话失败:', e);
      return null;
    }
  }

  clearAll() {
    localStorage.removeItem(this.storageKey);
    this.currentSession = null;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  setSessionName(name) {
    if (!this.currentSession) return;
    this.currentSession.name = name;
    this.save();
  }
}

export default StateStorage;
