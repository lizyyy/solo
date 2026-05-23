const db = require('../config/database');

const ChargerLog = {
  create: (log, callback) => {
    const sql = 'INSERT INTO charger_logs (log_id, charger_id, order_id, event_time, realtime_charge, status, event_type) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [log.log_id, log.charger_id, log.order_id, log.event_time, log.realtime_charge, log.status, log.event_type], callback);
  },
  findById: (logId, callback) => {
    db.get('SELECT * FROM charger_logs WHERE log_id = ?', [logId], callback);
  },
  findByOrderId: (orderId, callback) => {
    db.all('SELECT * FROM charger_logs WHERE order_id = ? ORDER BY event_time ASC', [orderId], callback);
  },
  findByChargerId: (chargerId, callback) => {
    db.all('SELECT * FROM charger_logs WHERE charger_id = ? ORDER BY event_time DESC', [chargerId], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM charger_logs ORDER BY event_time DESC', callback);
  },
  bulkInsert: (logs, callback) => {
    const ph = logs.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const vals = logs.flatMap(l => [l.log_id, l.charger_id, l.order_id, l.event_time, l.realtime_charge, l.status, l.event_type]);
    db.run('INSERT INTO charger_logs (log_id, charger_id, order_id, event_time, realtime_charge, status, event_type) VALUES ' + ph, vals, callback);
  }
};

module.exports = ChargerLog;
