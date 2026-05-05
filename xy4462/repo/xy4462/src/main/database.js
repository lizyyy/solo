const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DBManager {
  constructor() {
    const dataPath = this.getDataPath();
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    const dbPath = path.join(dataPath, 'haircut_manager.db');
    this.db = new Database(dbPath);
  }

  getDataPath() {
    if (process.platform === 'darwin') {
      return path.join(process.env.HOME, 'Library', 'Application Support', 'CommunityHaircutManager');
    } else if (process.platform === 'win32') {
      return path.join(process.env.APPDATA, 'CommunityHaircutManager');
    } else {
      return path.join(process.env.HOME, '.community-haircut-manager');
    }
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS elders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        room_number TEXT,
        bed_number TEXT,
        allergies TEXT,
        mobility_issues TEXT,
        special_needs TEXT,
        avoid_perm_dye INTEGER DEFAULT 0,
        needs_home_visit INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS volunteers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        skills TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS volunteer_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        volunteer_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        role TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
      );

      CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        serial_number TEXT,
        status TEXT DEFAULT 'available',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tool_disinfection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_id INTEGER NOT NULL,
        disinfected_at TEXT NOT NULL,
        disinfected_by TEXT,
        method TEXT,
        next_due TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tool_id) REFERENCES tools(id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        elder_id INTEGER NOT NULL,
        room_id INTEGER,
        start_time TEXT NOT NULL,
        end_time TEXT,
        service_type TEXT,
        volunteer_id INTEGER,
        tool_ids TEXT,
        status TEXT DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id),
        FOREIGN KEY (elder_id) REFERENCES elders(id),
        FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT,
        capacity INTEGER DEFAULT 1,
        is_available INTEGER DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS manual_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER,
        conflict_id TEXT,
        override_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        overridden_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        related_type TEXT NOT NULL,
        related_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        author TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      CREATE INDEX IF NOT EXISTS idx_appointments_event ON appointments(event_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(start_time);
      CREATE INDEX IF NOT EXISTS idx_volunteer_schedules_event ON volunteer_schedules(event_id);
      CREATE INDEX IF NOT EXISTS idx_tool_disinfection_tool ON tool_disinfection(tool_id);
    `);

    this.insertDefaultRooms();
  }

  insertDefaultRooms() {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM rooms').get();
    if (count.count === 0) {
      const rooms = [
        { name: '理发室1', location: '一楼大厅', capacity: 2 },
        { name: '理发室2', location: '一楼大厅', capacity: 2 },
        { name: '上门服务', location: '老人房间', capacity: 1 }
      ];
      
      const insert = this.db.prepare(`
        INSERT INTO rooms (name, location, capacity) VALUES (?, ?, ?)
      `);
      
      for (const room of rooms) {
        insert.run(room.name, room.location, room.capacity);
      }
    }
  }

  getCurrentEvent() {
    return this.db.prepare(`
      SELECT * FROM events WHERE is_active = 1 ORDER BY date DESC LIMIT 1
    `).get();
  }

  createEvent(eventData) {
    const result = this.db.prepare(`
      INSERT INTO events (name, date, location, notes)
      VALUES (?, ?, ?, ?)
    `).run(eventData.name, eventData.date, eventData.location, eventData.notes);
    
    return { id: result.lastInsertRowid, ...eventData };
  }

  getEvents() {
    return this.db.prepare(`
      SELECT * FROM events ORDER BY date DESC
    `).all();
  }

  getElders() {
    return this.db.prepare('SELECT * FROM elders').all();
  }

  getElderById(id) {
    return this.db.prepare('SELECT * FROM elders WHERE id = ?').get(id);
  }

  insertElder(elder) {
    const result = this.db.prepare(`
      INSERT INTO elders (name, room_number, bed_number, allergies, mobility_issues, 
        special_needs, avoid_perm_dye, needs_home_visit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      elder.name, elder.room_number, elder.bed_number, elder.allergies,
      elder.mobility_issues, elder.special_needs, elder.avoid_perm_dye ? 1 : 0,
      elder.needs_home_visit ? 1 : 0, elder.notes
    );
    return result.lastInsertRowid;
  }

  updateElder(elder) {
    return this.db.prepare(`
      UPDATE elders SET 
        name = ?, room_number = ?, bed_number = ?, allergies = ?, 
        mobility_issues = ?, special_needs = ?, avoid_perm_dye = ?, 
        needs_home_visit = ?, notes = ?
      WHERE id = ?
    `).run(
      elder.name, elder.room_number, elder.bed_number, elder.allergies,
      elder.mobility_issues, elder.special_needs, elder.avoid_perm_dye ? 1 : 0,
      elder.needs_home_visit ? 1 : 0, elder.notes, elder.id
    );
  }

  getVolunteers() {
    return this.db.prepare('SELECT * FROM volunteers').all();
  }

  getVolunteerById(id) {
    return this.db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id);
  }

  insertVolunteer(volunteer) {
    const result = this.db.prepare(`
      INSERT INTO volunteers (name, phone, skills, notes)
      VALUES (?, ?, ?, ?)
    `).run(volunteer.name, volunteer.phone, volunteer.skills, volunteer.notes);
    return result.lastInsertRowid;
  }

  getTools() {
    return this.db.prepare('SELECT * FROM tools').all();
  }

  getToolById(id) {
    return this.db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
  }

  insertTool(tool) {
    const result = this.db.prepare(`
      INSERT INTO tools (name, type, serial_number, status, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(tool.name, tool.type, tool.serial_number, tool.status || 'available', tool.notes);
    return result.lastInsertRowid;
  }

  getToolDisinfectionRecords(toolId) {
    return this.db.prepare(`
      SELECT * FROM tool_disinfection WHERE tool_id = ? ORDER BY disinfected_at DESC
    `).all(toolId);
  }

  insertToolDisinfection(record) {
    const result = this.db.prepare(`
      INSERT INTO tool_disinfection (tool_id, disinfected_at, disinfected_by, method, next_due, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      record.tool_id, record.disinfected_at, record.disinfected_by,
      record.method, record.next_due, record.notes
    );
    return result.lastInsertRowid;
  }

  getAppointments(filters = {}) {
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];

    if (filters.event_id) {
      sql += ' AND event_id = ?';
      params.push(filters.event_id);
    }
    if (filters.date) {
      sql += ' AND date(start_time) = ?';
      params.push(filters.date);
    }
    if (filters.room_id) {
      sql += ' AND room_id = ?';
      params.push(filters.room_id);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY start_time';
    return this.db.prepare(sql).all(...params);
  }

  getAppointmentById(id) {
    return this.db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  }

  insertAppointment(appointment) {
    const result = this.db.prepare(`
      INSERT INTO appointments (
        event_id, elder_id, room_id, start_time, end_time,
        service_type, volunteer_id, tool_ids, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointment.event_id, appointment.elder_id, appointment.room_id,
      appointment.start_time, appointment.end_time, appointment.service_type,
      appointment.volunteer_id, appointment.tool_ids,
      appointment.status || 'scheduled', appointment.notes
    );
    return result.lastInsertRowid;
  }

  updateAppointment(appointment) {
    return this.db.prepare(`
      UPDATE appointments SET
        elder_id = ?, room_id = ?, start_time = ?, end_time = ?,
        service_type = ?, volunteer_id = ?, tool_ids = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
      appointment.elder_id, appointment.room_id, appointment.start_time,
      appointment.end_time, appointment.service_type, appointment.volunteer_id,
      appointment.tool_ids, appointment.status, appointment.notes, appointment.id
    );
  }

  getVolunteerSchedules(eventId) {
    return this.db.prepare(`
      SELECT vs.*, v.name as volunteer_name
      FROM volunteer_schedules vs
      JOIN volunteers v ON vs.volunteer_id = v.id
      WHERE vs.event_id = ?
      ORDER BY vs.start_time
    `).all(eventId);
  }

  insertVolunteerSchedule(schedule) {
    const result = this.db.prepare(`
      INSERT INTO volunteer_schedules (event_id, volunteer_id, start_time, end_time, role, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      schedule.event_id, schedule.volunteer_id, schedule.start_time,
      schedule.end_time, schedule.role, schedule.notes
    );
    return result.lastInsertRowid;
  }

  getRooms() {
    return this.db.prepare('SELECT * FROM rooms WHERE is_available = 1').all();
  }

  saveManualOverride(override) {
    const result = this.db.prepare(`
      INSERT INTO manual_overrides (appointment_id, conflict_id, override_type, reason, overridden_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      override.appointment_id, override.conflict_id, override.override_type,
      override.reason, override.overridden_by
    );
    return result.lastInsertRowid;
  }

  getManualOverrides(appointmentId) {
    return this.db.prepare(`
      SELECT * FROM manual_overrides WHERE appointment_id = ? ORDER BY created_at DESC
    `).all(appointmentId);
  }

  saveNote(note) {
    const result = this.db.prepare(`
      INSERT INTO notes (related_type, related_id, content, author)
      VALUES (?, ?, ?, ?)
    `).run(note.related_type, note.related_id, note.content, note.author);
    return result.lastInsertRowid;
  }

  getNotes(relatedType, relatedId) {
    return this.db.prepare(`
      SELECT * FROM notes WHERE related_type = ? AND related_id = ? ORDER BY created_at DESC
    `).all(relatedType, relatedId);
  }

  close() {
    this.db.close();
  }
}

module.exports = DBManager;
