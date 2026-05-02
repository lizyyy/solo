class SessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  addSession(sessionId, stateMachine) {
    this.sessions.set(sessionId, stateMachine);
    console.log(`[SessionManager] Session added: ${sessionId}`);
    return true;
  }
  
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  
  removeSession(sessionId) {
    const existed = this.sessions.has(sessionId);
    this.sessions.delete(sessionId);
    if (existed) {
      console.log(`[SessionManager] Session removed: ${sessionId}`);
    }
    return existed;
  }
  
  listSessions() {
    const sessions = [];
    for (const [sessionId, stateMachine] of this.sessions) {
      const sessionInfo = stateMachine.getSessionInfo();
      const stats = stateMachine.getStats();
      sessions.push({
        sessionId,
        name: sessionInfo.name,
        description: sessionInfo.description,
        createdAt: sessionInfo.createdAt,
        updatedAt: sessionInfo.updatedAt,
        currentState: stateMachine.getCurrentState(),
        eventCount: stats.totalEvents,
      });
    }
    return sessions;
  }
  
  clearAll() {
    const count = this.sessions.size;
    this.sessions.clear();
    console.log(`[SessionManager] Cleared ${count} sessions`);
    return count;
  }
  
  getCount() {
    return this.sessions.size;
  }
}

module.exports = {
  SessionManager,
};
