class GameLogger {
  constructor() {
    this.logs = [];
  }

  log(action, details = {}) {
    this.logs.push({
      timestamp: Date.now(),
      action,
      details,
    });
  }

  getLogs() {
    return [...this.logs];
  }

  getScoreDetails() {
    return this.logs
      .filter(log => log.action === 'score_change')
      .map(log => ({
        time: log.details.time,
        score: log.details.score,
        reason: log.details.reason,
        amount: log.details.amount,
      }));
  }

  clear() {
    this.logs = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameLogger;
}
