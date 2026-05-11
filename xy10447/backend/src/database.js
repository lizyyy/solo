const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, 'cinema.db');

async function initDatabase() {
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } catch (e) {
      console.log('数据库文件损坏，将重新创建');
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS movies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        genre TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS halls (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'normal',
        rows INTEGER NOT NULL,
        cols INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS seats (
        id TEXT PRIMARY KEY,
        hall_id TEXT NOT NULL,
        row_no INTEGER NOT NULL,
        col_no INTEGER NOT NULL,
        seat_code TEXT NOT NULL,
        is_vip INTEGER DEFAULT 0,
        is_disabled INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        movie_id TEXT NOT NULL,
        hall_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        base_price DECIMAL(10,2) NOT NULL,
        vip_surcharge DECIMAL(10,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        seat_id TEXT NOT NULL,
        original_schedule_id TEXT,
        original_seat_id TEXT,
        price DECIMAL(10,2) NOT NULL,
        paid_price DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'sold',
        customer_name TEXT,
        customer_phone TEXT,
        order_no TEXT,
        sold_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS hall_exchange_requests (
        id TEXT PRIMARY KEY,
        original_schedule_id TEXT NOT NULL,
        target_hall_id TEXT NOT NULL,
        new_schedule_id TEXT,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        affected_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS hall_exchange_seat_mappings (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        ticket_id TEXT NOT NULL,
        original_seat_id TEXT NOT NULL,
        new_seat_id TEXT,
        mapping_type TEXT,
        price_diff DECIMAL(10,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        resolution TEXT,
        refund_amount DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target TEXT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS refunds (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        request_id TEXT,
        amount DECIMAL(10,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        processed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    saveDatabase();
  } catch (err) {
    console.error('初始化表失败:', err);
  }
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
}

function prepare(sql) {
  return {
    get: function(...params) {
      try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      } catch (err) {
        console.error('SQL get error:', sql, params, err.message);
        return undefined;
      }
    },
    all: function(...params) {
      try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } catch (err) {
        console.error('SQL all error:', sql, params, err.message);
        return [];
      }
    },
    run: function(...params) {
      try {
        db.run(sql, params);
        saveDatabase();
      } catch (err) {
        console.error('SQL run error:', sql, params, err.message);
        throw err;
      }
    }
  };
}

function exec(sql) {
  try {
    db.run(sql);
    saveDatabase();
  } catch (err) {
    console.error('SQL exec error:', sql, err.message);
  }
}

function transaction(fn) {
  return fn();
}

module.exports = { 
  db: {
    prepare,
    exec,
    transaction,
    pragma: () => {}
  }, 
  initDatabase 
};
