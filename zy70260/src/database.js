const fs = require('fs');
const path = require('path');

let database = {
  wind_speed_monitor: [],
  cable_car_schedule: [],
  ticket: [],
  history_record: []
};

let autoIncrementId = 1;

function getNextId() {
  return autoIncrementId++;
}

function getCurrentTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function initDatabase() {
  const dbPath = path.join(__dirname, '..', 'cable_car_data.json');
  
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf-8');
      database = JSON.parse(data);
      const maxId = Math.max(
        0,
        ...database.wind_speed_monitor.map(r => r.id || 0),
        ...database.history_record.map(r => r.id || 0)
      );
      autoIncrementId = maxId + 1;
      console.log('从文件加载数据成功');
    }
  } catch (error) {
    console.log('创建新数据库');
  }
  
  console.log('数据库初始化完成');
}

function saveDatabase() {
  const dbPath = path.join(__dirname, '..', 'cable_car_data.json');
  fs.writeFileSync(dbPath, JSON.stringify(database, null, 2));
}

function getDb() {
  return {
    prepare: (sql) => new Statement(sql)
  };
}

class Statement {
  constructor(sql) {
    this.sql = sql.trim();
  }

  run(...params) {
    const sql = this.sql;
    
    if (sql.includes('INSERT INTO wind_speed_monitor')) {
      const record = {
        id: getNextId(),
        location: params[0],
        wind_speed: params[1],
        status: params[2],
        threshold_warning: params[3],
        threshold_stop: params[4],
        recorded_at: getCurrentTime()
      };
      database.wind_speed_monitor.push(record);
      saveDatabase();
      return { lastInsertRowid: record.id };
    }

    if (sql.includes('INSERT INTO cable_car_schedule')) {
      const record = {
        id: params[0],
        route: params[1],
        departure_time: params[2],
        arrival_time: params[3],
        capacity: params[4],
        status: params[5],
        reason: null,
        created_at: getCurrentTime(),
        updated_at: getCurrentTime()
      };
      database.cable_car_schedule.push(record);
      saveDatabase();
      return { lastInsertRowid: record.id };
    }

    if (sql.includes('INSERT INTO ticket')) {
      const record = {
        id: params[0],
        schedule_id: params[1],
        passenger_name: params[2],
        passenger_phone: params[3],
        price: params[4],
        status: params[5],
        refund_amount: 0,
        created_at: getCurrentTime(),
        updated_at: getCurrentTime()
      };
      database.ticket.push(record);
      saveDatabase();
      return { lastInsertRowid: record.id };
    }

    if (sql.includes('INSERT INTO history_record')) {
      const record = {
        id: getNextId(),
        entity_type: params[0],
        entity_id: params[1],
        operation: params[2],
        before_value: params[3],
        after_value: params[4],
        operator: params[5],
        created_at: getCurrentTime()
      };
      database.history_record.push(record);
      saveDatabase();
      return { lastInsertRowid: record.id };
    }

    if (sql.includes('UPDATE cable_car_schedule')) {
      const id = params[params.length - 1];
      const schedule = database.cable_car_schedule.find(s => s.id === id);
      if (schedule) {
        schedule.status = params[0];
        schedule.reason = params[1];
        schedule.updated_at = getCurrentTime();
        saveDatabase();
      }
      return { changes: schedule ? 1 : 0 };
    }

    if (sql.includes('UPDATE ticket')) {
      const id = params[params.length - 1];
      const ticket = database.ticket.find(t => t.id === id);
      if (ticket) {
        ticket.status = params[0];
        ticket.refund_amount = params[1];
        ticket.updated_at = getCurrentTime();
        saveDatabase();
      }
      return { changes: ticket ? 1 : 0 };
    }

    return { changes: 0 };
  }

  get(...params) {
    const sql = this.sql;

    if (sql.includes('FROM wind_speed_monitor') && sql.includes('WHERE id = ?')) {
      return database.wind_speed_monitor.find(r => r.id === params[0]);
    }

    if (sql.includes('FROM wind_speed_monitor') && sql.includes('WHERE location = ?')) {
      const sorted = [...database.wind_speed_monitor]
        .filter(r => r.location === params[0])
        .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
      return sorted[0] || undefined;
    }

    if (sql.includes('FROM cable_car_schedule') && sql.includes('WHERE id = ?')) {
      return database.cable_car_schedule.find(s => s.id === params[0]);
    }

    if (sql.includes('FROM ticket') && sql.includes('WHERE id = ?')) {
      return database.ticket.find(t => t.id === params[0]);
    }

    return undefined;
  }

  all(...params) {
    const sql = this.sql;

    if (sql.includes('FROM wind_speed_monitor') && sql.includes('WHERE location = ?') && sql.includes('ORDER BY recorded_at DESC')) {
      return [...database.wind_speed_monitor]
        .filter(r => r.location === params[0])
        .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
        .slice(0, params[1]);
    }

    if (sql.includes('FROM cable_car_schedule') && sql.includes('WHERE status = ?')) {
      return [...database.cable_car_schedule]
        .filter(s => s.status === params[0])
        .sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    }

    if (sql.includes('FROM cable_car_schedule') && sql.includes('ORDER BY departure_time')) {
      return [...database.cable_car_schedule]
        .sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    }

    if (sql.includes('FROM ticket') && sql.includes('WHERE schedule_id = ?')) {
      return [...database.ticket]
        .filter(t => t.schedule_id === params[0])
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    if (sql.includes('FROM history_record') && sql.includes('WHERE entity_type = ?') && sql.includes('AND entity_id = ?')) {
      return [...database.history_record]
        .filter(r => r.entity_type === params[0] && r.entity_id === params[1])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, params[2]);
    }

    if (sql.includes('FROM history_record') && sql.includes('ORDER BY created_at DESC')) {
      const filtered = params.length > 1 && params[0] 
        ? database.history_record.filter(r => r.entity_type === params[0])
        : database.history_record;
      
      const limit = params[params.length - 1] || 100;
      
      return [...filtered]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    }

    return [];
  }
}

module.exports = {
  initDatabase,
  getDb
};
