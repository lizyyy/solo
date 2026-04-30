const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'events.db');
let db = null;
let SQL = null;

async function initDatabase() {
  if (db) return;
  
  SQL = await initSqlJs();
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date_time TEXT NOT NULL,
      total_slots INTEGER NOT NULL,
      checkin_code TEXT NOT NULL,
      sessions TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone_last4 TEXT NOT NULL,
      session TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      checkin_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone_last4 TEXT NOT NULL,
      session TEXT,
      position INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events (id)
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getEventById(id) {
  const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
  stmt.bind([id]);
  if (stmt.step()) {
    const event = stmt.getAsObject();
    stmt.free();
    return event;
  }
  stmt.free();
  return null;
}

function getAllEvents() {
  const results = db.exec('SELECT * FROM events ORDER BY created_at DESC');
  if (results.length === 0) return [];
  return results[0].values.map(row => {
    const obj = {};
    results[0].columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function createEvent(event) {
  const stmt = db.prepare(`
    INSERT INTO events (title, date_time, total_slots, checkin_code, sessions)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run([
    event.title,
    event.date_time,
    event.total_slots,
    event.checkin_code,
    event.sessions ? JSON.stringify(event.sessions) : null
  ]);
  
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDatabase();
  return lastId;
}

function getEventRegistrations(eventId, session = null) {
  let query = 'SELECT * FROM registrations WHERE event_id = ?';
  const params = [eventId];
  
  if (session) {
    query += ' AND session = ?';
    params.push(session);
  }
  
  query += ' ORDER BY created_at ASC';
  
  const results = db.exec(query, params);
  if (results.length === 0) return [];
  
  return results[0].values.map(row => {
    const obj = {};
    results[0].columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function getEventWaitlist(eventId, session = null) {
  let query = 'SELECT * FROM waitlist WHERE event_id = ?';
  const params = [eventId];
  
  if (session) {
    query += ' AND session = ?';
    params.push(session);
  }
  
  query += ' ORDER BY position ASC';
  
  const results = db.exec(query, params);
  if (results.length === 0) return [];
  
  return results[0].values.map(row => {
    const obj = {};
    results[0].columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function getRegistrationCount(eventId, session = null) {
  let query = 'SELECT COUNT(*) as count FROM registrations WHERE event_id = ? AND status IN (?, ?)';
  const params = [eventId, 'registered', 'checked_in'];
  
  if (session) {
    query += ' AND session = ?';
    params.push(session);
  }
  
  const results = db.exec(query, params);
  if (results.length === 0 || results[0].values.length === 0) return 0;
  return results[0].values[0][0];
}

function registerForEvent(eventId, name, phoneLast4, session = null) {
  const event = getEventById(eventId);
  if (!event) throw new Error('活动不存在');

  const existing = db.exec(
    'SELECT * FROM registrations WHERE event_id = ? AND name = ? AND phone_last4 = ?',
    [eventId, name, phoneLast4]
  );
  
  if (existing.length > 0 && existing[0].values.length > 0) {
    throw new Error('您已报名此活动');
  }

  const existingWaitlist = db.exec(
    'SELECT * FROM waitlist WHERE event_id = ? AND name = ? AND phone_last4 = ?',
    [eventId, name, phoneLast4]
  );
  
  if (existingWaitlist.length > 0 && existingWaitlist[0].values.length > 0) {
    throw new Error('您已在候补中');
  }

  const currentCount = getRegistrationCount(eventId, session);
  
  if (currentCount < event.total_slots) {
    const stmt = db.prepare(`
      INSERT INTO registrations (event_id, name, phone_last4, session, status, created_at)
      VALUES (?, ?, ?, ?, 'registered', datetime('now'))
    `);
    stmt.run([eventId, name, phoneLast4, session]);
    
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    saveDatabase();
    return { status: 'registered', registrationId: lastId };
  } else {
    let waitlistQuery = 'SELECT COUNT(*) as count FROM waitlist WHERE event_id = ?';
    const waitlistParams = [eventId];
    
    if (session) {
      waitlistQuery += ' AND session = ?';
      waitlistParams.push(session);
    }
    
    const waitlistCountResult = db.exec(waitlistQuery, waitlistParams);
    const waitlistCount = waitlistCountResult.length > 0 ? waitlistCountResult[0].values[0][0] : 0;
    
    const stmt = db.prepare(`
      INSERT INTO waitlist (event_id, name, phone_last4, session, position, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run([eventId, name, phoneLast4, session, waitlistCount + 1]);
    
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    saveDatabase();
    return { status: 'waitlist', waitlistId: lastId, position: waitlistCount + 1 };
  }
}

function promoteFromWaitlist(eventId, session = null) {
  let query = 'SELECT * FROM waitlist WHERE event_id = ? ';
  const params = [eventId];
  
  if (session) {
    query += 'AND session = ? ';
    params.push(session);
  }
  
  query += 'ORDER BY position ASC LIMIT 1';
  
  const results = db.exec(query, params);
  if (results.length === 0 || results[0].values.length === 0) return null;
  
  const waitlistItem = {};
  results[0].columns.forEach((col, i) => {
    waitlistItem[col] = results[0].values[0][i];
  });

  const insertStmt = db.prepare(`
    INSERT INTO registrations (event_id, name, phone_last4, session, status, created_at)
    VALUES (?, ?, ?, ?, 'registered', datetime('now'))
  `);
  insertStmt.run([waitlistItem.event_id, waitlistItem.name, waitlistItem.phone_last4, waitlistItem.session]);

  const resultId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

  db.run('DELETE FROM waitlist WHERE id = ?', [waitlistItem.id]);

  let remainingQuery = 'SELECT * FROM waitlist WHERE event_id = ? ';
  const remainingParams = [eventId];
  
  if (session) {
    remainingQuery += 'AND session = ? ';
    remainingParams.push(session);
  }
  
  remainingQuery += 'ORDER BY position ASC';
  
  const remainingResults = db.exec(remainingQuery, remainingParams);
  if (remainingResults.length > 0) {
    remainingResults[0].values.forEach((row, index) => {
      const idIndex = remainingResults[0].columns.indexOf('id');
      const id = row[idIndex];
      db.run('UPDATE waitlist SET position = ? WHERE id = ?', [index + 1, id]);
    });
  }

  saveDatabase();
  return resultId;
}

function cancelRegistration(registrationId) {
  const regResults = db.exec('SELECT * FROM registrations WHERE id = ?', [registrationId]);
  if (regResults.length === 0 || regResults[0].values.length === 0) {
    throw new Error('报名记录不存在');
  }

  const registration = {};
  regResults[0].columns.forEach((col, i) => {
    registration[col] = regResults[0].values[0][i];
  });

  db.run('DELETE FROM registrations WHERE id = ?', [registrationId]);

  promoteFromWaitlist(registration.event_id, registration.session);

  saveDatabase();
  return true;
}

function checkinUser(registrationId, checkinCode) {
  const regResults = db.exec('SELECT * FROM registrations WHERE id = ?', [registrationId]);
  if (regResults.length === 0 || regResults[0].values.length === 0) {
    throw new Error('报名记录不存在');
  }

  const registration = {};
  regResults[0].columns.forEach((col, i) => {
    registration[col] = regResults[0].values[0][i];
  });

  const event = getEventById(registration.event_id);
  if (event.checkin_code !== checkinCode) {
    throw new Error('签到码错误');
  }

  if (registration.status === 'checked_in') {
    throw new Error('用户已签到');
  }

  db.run(`
    UPDATE registrations 
    SET status = 'checked_in', checkin_time = datetime('now') 
    WHERE id = ?
  `, [registrationId]);

  saveDatabase();
  return true;
}

function getEventStats(eventId, session = null) {
  const event = getEventById(eventId);
  if (!event) return null;

  const registrations = getEventRegistrations(eventId, session);
  const waitlist = getEventWaitlist(eventId, session);

  const checkedIn = registrations.filter(r => r.status === 'checked_in').length;
  const registered = registrations.filter(r => r.status === 'registered').length;
  const notArrived = registered;

  return {
    event,
    total_slots: event.total_slots,
    registered_count: registrations.length,
    waitlist_count: waitlist.length,
    checked_in: checkedIn,
    not_arrived: notArrived,
    registrations,
    waitlist
  };
}

module.exports = {
  initDatabase,
  getEventById,
  getAllEvents,
  createEvent,
  getEventRegistrations,
  getEventWaitlist,
  registerForEvent,
  cancelRegistration,
  checkinUser,
  getEventStats,
  getRegistrationCount
};
