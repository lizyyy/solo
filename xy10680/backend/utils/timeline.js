const db = require('../database');

const addTimelineEvent = (eventType, eventData, status, description) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO timeline (event_type, event_data, status, description) VALUES (?, ?, ?, ?)',
      [eventType, JSON.stringify(eventData), status, description],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
};

module.exports = { addTimelineEvent };