const db = require('../database/db');

class IdempotencyLog {
  static create({ idempotency_key, endpoint, response }) {
    const log = {
      idempotency_key,
      endpoint,
      response: JSON.stringify(response),
      created_at: db.now()
    };
    db.prepare('idempotency_logs').run(log);
  }

  static findByKey(idempotency_key) {
    const row = db.prepare('idempotency_logs').get(l => l.idempotency_key === idempotency_key);
    if (row && row.response) {
      return { ...row, response: JSON.parse(row.response) };
    }
    return row;
  }

  static cleanupOld(hours = 24) {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    db.prepare('idempotency_logs').delete(l => l.created_at < threshold);
  }
}

module.exports = IdempotencyLog;
