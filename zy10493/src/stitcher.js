const { logger, formatDuration } = require('./utils');

class SessionStitcher {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.stats = {
      totalUsers: 0,
      totalSessions: 0,
      stitchedSessions: 0,
      totalGaps: 0,
      gapDetails: []
    };
  }

  processEvents(events) {
    logger.debug(`开始处理 ${events.length} 个事件...`);

    this.groupByUserSession(events);
    this.sortAndStitchSessions();

    return this.getStitchedSessions();
  }

  groupByUserSession(events) {
    const { userKey, sessionKey } = this.config;

    for (const event of events) {
      const userId = event[userKey];
      const sessionId = event[sessionKey];

      if (!this.sessions.has(userId)) {
        this.sessions.set(userId, new Map());
      }
      const userSessions = this.sessions.get(userId);

      if (!userSessions.has(sessionId)) {
        userSessions.set(sessionId, []);
      }
      userSessions.get(sessionId).push(event);
    }

    this.stats.totalUsers = this.sessions.size;
    let totalSessions = 0;
    for (const userSessions of this.sessions.values()) {
      totalSessions += userSessions.size;
    }
    this.stats.totalSessions = totalSessions;

    logger.debug(`分组完成: ${this.stats.totalUsers} 用户, ${this.stats.totalSessions} 会话`);
  }

  sortAndStitchSessions() {
    const { userKey, sessionKey, gapThreshold } = this.config;
    let stitchedCount = 0;

    for (const [userId, userSessions] of this.sessions) {
      const allUserEvents = [];
      
      for (const [sessionId, events] of userSessions) {
        allUserEvents.push(...events);
      }

      allUserEvents.sort((a, b) => a._parsedTime - b._parsedTime);

      const stitchedSessions = this.detectGapsAndSplit(allUserEvents, gapThreshold);

      const userSessionMap = new Map();
      for (let i = 0; i < stitchedSessions.length; i++) {
        const sessionEvents = stitchedSessions[i];
        const newSessionId = `${userId}_session_${i + 1}`;
        userSessionMap.set(newSessionId, sessionEvents);
      }

      if (stitchedSessions.length < userSessions.size) {
        stitchedCount += (userSessions.size - stitchedSessions.length);
      }

      this.sessions.set(userId, userSessionMap);
    }

    this.stats.stitchedSessions = stitchedCount;
    logger.debug(`会话缝合完成: ${stitchedCount} 个会话被合并`);
  }

  detectGapsAndSplit(events, gapThreshold) {
    if (events.length === 0) return [];

    const sessions = [];
    let currentSession = [events[0]];

    for (let i = 1; i < events.length; i++) {
      const prevTime = events[i - 1]._parsedTime;
      const currTime = events[i]._parsedTime;
      const gap = currTime - prevTime;

      if (gap > gapThreshold) {
        this.stats.totalGaps++;
        this.stats.gapDetails.push({
          gapDuration: gap,
          gapFormatted: formatDuration(gap),
          prevEvent: events[i - 1]._source,
          currEvent: events[i]._source,
          userId: events[i][this.config.userKey]
        });

        sessions.push(currentSession);
        currentSession = [events[i]];
      } else {
        currentSession.push(events[i]);
      }
    }

    sessions.push(currentSession);
    return sessions;
  }

  getStitchedSessions() {
    const result = [];

    for (const [userId, userSessions] of this.sessions) {
      for (const [sessionId, events] of userSessions) {
        const sessionStart = events[0]._parsedTime;
        const sessionEnd = events[events.length - 1]._parsedTime;
        
        result.push({
          userId,
          sessionId,
          startTime: sessionStart,
          endTime: sessionEnd,
          duration: sessionEnd - sessionStart,
          eventCount: events.length,
          events: events.map(e => {
            const { _source, _parsedTime, ...cleanEvent } = e;
            return cleanEvent;
          })
        });
      }
    }

    return result;
  }

  getStats() {
    return this.stats;
  }

  getGapDetails() {
    return this.stats.gapDetails;
  }
}

module.exports = { SessionStitcher };