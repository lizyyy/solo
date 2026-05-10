const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    student_id TEXT,
    class_name TEXT NOT NULL,
    gender TEXT,
    phone TEXT,
    parent_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    signed_at DATETIME,
    signed_by TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS health_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    tag_type TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    severity TEXT DEFAULT 'normal',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 45,
    driver_name TEXT,
    driver_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    date DATE,
    meeting_point TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    seat_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS risk_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    risk_type TEXT NOT NULL,
    override INTEGER DEFAULT 0,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, activity_id, risk_type)
  );

  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
  CREATE INDEX IF NOT EXISTS idx_consents_student ON consents(student_id);
  CREATE INDEX IF NOT EXISTS idx_health_student ON health_tags(student_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_student ON activity_assignments(student_id);
  CREATE INDEX IF NOT EXISTS idx_assignments_vehicle ON activity_assignments(vehicle_id);
`);

function addStudent(data) {
  const stmt = db.prepare(`
    INSERT INTO students (name, student_id, class_name, gender, phone, parent_phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.name, data.student_id, data.class_name,
    data.gender, data.phone, data.parent_phone
  );
  return result.lastInsertRowid;
}

function getStudents(class_name, activity_id) {
  let sql = `SELECT s.*, 
    GROUP_CONCAT(DISTINCT h.tag_value) as health_tags,
    CASE WHEN c.id IS NOT NULL THEN c.status ELSE 'pending' END as consent_status,
    a.vehicle_id, a.seat_number
    FROM students s
    LEFT JOIN health_tags h ON s.id = h.student_id
    LEFT JOIN activity_assignments a ON s.id = a.student_id AND a.activity_id = ?
    LEFT JOIN consents c ON s.id = c.student_id AND c.activity_id = ?
  `;
  const params = [activity_id || 0, activity_id || 0];
  
  if (class_name && class_name !== 'all') {
    sql += ' WHERE s.class_name = ?';
    params.push(class_name);
  }
  
  sql += ' GROUP BY s.id ORDER BY s.class_name, s.name';
  
  return db.prepare(sql).all(...params);
}

function updateStudent(id, data) {
  const stmt = db.prepare(`
    UPDATE students SET name=?, student_id=?, class_name=?, gender=?, phone=?, parent_phone=?
    WHERE id = ?
  `);
  const result = stmt.run(
    data.name, data.student_id, data.class_name,
    data.gender, data.phone, data.parent_phone, id
  );
  return result.changes > 0;
}

function deleteStudent(id) {
  db.prepare('DELETE FROM health_tags WHERE student_id = ?').run(id);
  db.prepare('DELETE FROM consents WHERE student_id = ?').run(id);
  db.prepare('DELETE FROM activity_assignments WHERE student_id = ?').run(id);
  db.prepare('DELETE FROM risk_overrides WHERE student_id = ?').run(id);
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
  return result.changes > 0;
}

function addConsent(data) {
  const stmt = db.prepare(`
    INSERT INTO consents (student_id, activity_id, status, signed_at, signed_by, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.student_id, data.activity_id, data.status || 'pending',
    data.signed_at, data.signed_by, data.note
  );
  return result.lastInsertRowid;
}

function getConsents() {
  return db.prepare('SELECT * FROM consents').all();
}

function addHealthTag(data) {
  const stmt = db.prepare(`
    INSERT INTO health_tags (student_id, tag_type, tag_value, severity, note)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.student_id, data.tag_type, data.tag_value,
    data.severity || 'normal', data.note
  );
  return result.lastInsertRowid;
}

function getHealthTags() {
  return db.prepare('SELECT * FROM health_tags').all();
}

function addTeacher(data) {
  const stmt = db.prepare(`
    INSERT INTO teachers (name, phone, role)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(data.name, data.phone, data.role);
  return result.lastInsertRowid;
}

function getTeachers() {
  return db.prepare('SELECT * FROM teachers ORDER BY name').all();
}

function addVehicle(data) {
  const stmt = db.prepare(`
    INSERT INTO vehicles (plate_number, capacity, driver_name, driver_phone)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.plate_number, data.capacity || 45,
    data.driver_name, data.driver_phone
  );
  return result.lastInsertRowid;
}

function getVehicles() {
  return db.prepare('SELECT * FROM vehicles ORDER BY plate_number').all();
}

function addActivity(data) {
  const stmt = db.prepare(`
    INSERT INTO activities (name, type, date, meeting_point)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(data.name, data.type, data.date, data.meeting_point);
  return result.lastInsertRowid;
}

function getActivities() {
  return db.prepare('SELECT * FROM activities ORDER BY date DESC').all();
}

function getActivity(id) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(id);
  if (!activity) return null;
  
  const vehicles = db.prepare(`
    SELECT v.*, av.teacher_id, t.name as teacher_name, t.phone as teacher_phone
    FROM activity_vehicles av
    JOIN vehicles v ON av.vehicle_id = v.id
    LEFT JOIN teachers t ON av.teacher_id = t.id
    WHERE av.activity_id = ?
  `).all(id);
  
  const assignments = db.prepare(`
    SELECT aa.*, s.name as student_name, s.class_name
    FROM activity_assignments aa
    JOIN students s ON aa.student_id = s.id
    WHERE aa.activity_id = ?
  `).all(id);
  
  return { ...activity, vehicles, assignments };
}

function updateActivity(id, data) {
  db.prepare('DELETE FROM activity_vehicles WHERE activity_id = ?').run(id);
  db.prepare('DELETE FROM activity_assignments WHERE activity_id = ?').run(id);
  
  if (data.vehicles) {
    const vehStmt = db.prepare(`
      INSERT INTO activity_vehicles (activity_id, vehicle_id, teacher_id)
      VALUES (?, ?, ?)
    `);
    data.vehicles.forEach(v => vehStmt.run(id, v.vehicle_id, v.teacher_id));
  }
  
  if (data.assignments) {
    const assignStmt = db.prepare(`
      INSERT INTO activity_assignments (activity_id, student_id, vehicle_id, seat_number)
      VALUES (?, ?, ?, ?)
    `);
    data.assignments.forEach(a => assignStmt.run(id, a.student_id, a.vehicle_id, a.seat_number));
  }
  
  const result = db.prepare(`
    UPDATE activities SET name=?, type=?, date=?, meeting_point=? WHERE id = ?
  `).run(data.name, data.type, data.date, data.meeting_point, id);
  
  return result.changes > 0;
}

function getClasses() {
  return db.prepare('SELECT DISTINCT class_name FROM students ORDER BY class_name').all();
}

function setRiskOverride(student_id, activity_id, risk_type, override, note) {
  const stmt = db.prepare(`
    INSERT INTO risk_overrides (student_id, activity_id, risk_type, override, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id, activity_id, risk_type) 
    DO UPDATE SET override=excluded.override, note=excluded.note
  `);
  stmt.run(student_id, activity_id, risk_type, override ? 1 : 0, note);
}

function getRisks(activity_id) {
  const overrides = db.prepare('SELECT * FROM risk_overrides WHERE activity_id = ?').all(activity_id);
  const overrideMap = {};
  overrides.forEach(o => {
    const key = `${o.student_id}-${o.risk_type}`;
    overrideMap[key] = { override: o.override === 1, note: o.note };
  });
  
  const students = db.prepare(`
    SELECT s.*, 
      GROUP_CONCAT(DISTINCT h.tag_value) as health_tags,
      GROUP_CONCAT(DISTINCT h.tag_type) as health_types,
      CASE WHEN c.status = 'approved' THEN 1 ELSE 0 END as consent_approved,
      a.vehicle_id
    FROM students s
    LEFT JOIN health_tags h ON s.id = h.student_id
    LEFT JOIN consents c ON s.id = c.student_id AND c.activity_id = ?
    LEFT JOIN activity_assignments a ON s.id = a.student_id AND a.activity_id = ?
    GROUP BY s.id
  `).all(activity_id, activity_id);
  
  const risks = [];
  
  students.forEach(s => {
    if (!s.consent_approved) {
      const key = `${s.id}-no_consent`;
      const ov = overrideMap[key] || { override: false };
      if (!ov.override) {
        risks.push({
          student_id: s.id,
          student_name: s.name,
          class_name: s.class_name,
          risk_type: 'no_consent',
          risk_level: 'high',
          message: '未提交家长同意书',
          override: ov.override,
          override_note: ov.note
        });
      }
    }
    
    if (s.health_tags) {
      const key = `${s.id}-health_risk`;
      const ov = overrideMap[key] || { override: false };
      if (!ov.override) {
        risks.push({
          student_id: s.id,
          student_name: s.name,
          class_name: s.class_name,
          risk_type: 'health_risk',
          risk_level: 'medium',
          message: `健康标签: ${s.health_tags}`,
          override: ov.override,
          override_note: ov.note
        });
      }
    }
    
    if (!s.vehicle_id) {
      const key = `${s.id}-no_assignment`;
      const ov = overrideMap[key] || { override: false };
      if (!ov.override) {
        risks.push({
          student_id: s.id,
          student_name: s.name,
          class_name: s.class_name,
          risk_type: 'no_assignment',
          risk_level: 'medium',
          message: '未分配车辆座位',
          override: ov.override,
          override_note: ov.note
        });
      }
    }
  });
  
  return risks.sort((a, b) => {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    return levelOrder[a.risk_level] - levelOrder[b.risk_level];
  });
}

function getDepartureList(activity_id) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
  if (!activity) return null;
  
  const vehicles = db.prepare(`
    SELECT v.*, av.teacher_id, t.name as teacher_name, t.phone as teacher_phone,
      COUNT(aa.student_id) as student_count
    FROM activity_vehicles av
    JOIN vehicles v ON av.vehicle_id = v.id
    LEFT JOIN teachers t ON av.teacher_id = t.id
    LEFT JOIN activity_assignments aa ON av.activity_id = aa.activity_id AND av.vehicle_id = aa.vehicle_id
    WHERE av.activity_id = ?
    GROUP BY av.id
    ORDER BY v.plate_number
  `).all(activity_id);
  
  const vehicleDetailList = vehicles.map(v => {
    const students = db.prepare(`
      SELECT s.*, aa.seat_number
      FROM activity_assignments aa
      JOIN students s ON aa.student_id = s.id
      WHERE aa.activity_id = ? AND aa.vehicle_id = ?
      ORDER BY aa.seat_number, s.class_name, s.name
    `).all(activity_id, v.vehicle_id);
    return { ...v, students };
  });
  
  return {
    activity,
    vehicles: vehicleDetailList,
    total_students: vehicleDetailList.reduce((sum, v) => sum + v.student_count, 0)
  };
}

function getRiskExport(activity_id) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
  if (!activity) return null;
  
  const risks = getRisks(activity_id);
  return { activity, risks };
}

function getParentConfirmList(activity_id) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activity_id);
  if (!activity) return null;
  
  const students = db.prepare(`
    SELECT s.*,
      CASE WHEN c.status = 'approved' THEN '已确认' ELSE '未确认' END as consent_status,
      c.signed_at, c.signed_by,
      v.plate_number, aa.seat_number, t.name as teacher_name
    FROM students s
    LEFT JOIN consents c ON s.id = c.student_id AND c.activity_id = ?
    LEFT JOIN activity_assignments aa ON s.id = aa.student_id AND aa.activity_id = ?
    LEFT JOIN vehicles v ON aa.vehicle_id = v.id
    LEFT JOIN activity_vehicles av ON v.id = av.vehicle_id AND av.activity_id = ?
    LEFT JOIN teachers t ON av.teacher_id = t.id
    ORDER BY s.class_name, s.name
  `).all(activity_id, activity_id, activity_id);
  
  return { activity, students };
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], data: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => row[h] = values[idx]);
    data.push(row);
  }
  
  return { headers, data };
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function importCSV(filePath, type) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data } = parseCSV(content);
  let count = 0;
  
  if (type === 'students') {
    const stmt = db.prepare(`
      INSERT INTO students (name, student_id, class_name, gender, phone, parent_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    data.forEach(row => {
      if (row.name && row.class_name) {
        stmt.run(
          row.name, row.student_id || row['学号'] || null,
          row.class_name || row['班级'] || row.class,
          row.gender || row['性别'] || null,
          row.phone || row['电话'] || null,
          row.parent_phone || row['家长电话'] || null
        );
        count++;
      }
    });
  } else if (type === 'teachers') {
    const stmt = db.prepare(`
      INSERT INTO teachers (name, phone, role)
      VALUES (?, ?, ?)
    `);
    data.forEach(row => {
      if (row.name) {
        stmt.run(row.name, row.phone || row['电话'], row.role || row['角色']);
        count++;
      }
    });
  } else if (type === 'vehicles') {
    const stmt = db.prepare(`
      INSERT INTO vehicles (plate_number, capacity, driver_name, driver_phone)
      VALUES (?, ?, ?, ?)
    `);
    data.forEach(row => {
      if (row.plate_number || row['车牌号']) {
        stmt.run(
          row.plate_number || row['车牌号'],
          parseInt(row.capacity || row['容量'] || 45),
          row.driver_name || row['司机姓名'] || null,
          row.driver_phone || row['司机电话'] || null
        );
        count++;
      }
    });
  } else if (type === 'consents') {
    const stmt = db.prepare(`
      INSERT INTO consents (student_id, activity_id, status, signed_by)
      VALUES (?, ?, ?, ?)
    `);
    data.forEach(row => {
      if (row.student_id || row['学生ID']) {
        stmt.run(
          parseInt(row.student_id || row['学生ID']),
          parseInt(row.activity_id || row['活动ID'] || 0),
          row.status || row['状态'] || 'approved',
          row.signed_by || row['签署人'] || null
        );
        count++;
      }
    });
  } else if (type === 'health') {
    const stmt = db.prepare(`
      INSERT INTO health_tags (student_id, tag_type, tag_value, severity)
      VALUES (?, ?, ?, ?)
    `);
    data.forEach(row => {
      if (row.student_id || row['学生ID']) {
        stmt.run(
          parseInt(row.student_id || row['学生ID']),
          row.tag_type || row['类型'] || 'allergy',
          row.tag_value || row['内容'] || row.value,
          row.severity || row['严重程度'] || 'normal'
        );
        count++;
      }
    });
  }
  
  fs.unlinkSync(filePath);
  return { imported: count, type };
}

function importJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  let count = 0;
  
  if (data.students) {
    const stmt = db.prepare(`
      INSERT INTO students (name, student_id, class_name, gender, phone, parent_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    data.students.forEach(s => {
      if (s.name && s.class_name) {
        stmt.run(s.name, s.student_id, s.class_name, s.gender, s.phone, s.parent_phone);
        count++;
      }
    });
  }
  
  if (data.teachers) {
    const stmt = db.prepare('INSERT INTO teachers (name, phone, role) VALUES (?, ?, ?)');
    data.teachers.forEach(t => {
      if (t.name) { stmt.run(t.name, t.phone, t.role); count++; }
    });
  }
  
  if (data.vehicles) {
    const stmt = db.prepare(`
      INSERT INTO vehicles (plate_number, capacity, driver_name, driver_phone)
      VALUES (?, ?, ?, ?)
    `);
    data.vehicles.forEach(v => {
      if (v.plate_number) {
        stmt.run(v.plate_number, v.capacity || 45, v.driver_name, v.driver_phone);
        count++;
      }
    });
  }
  
  if (data.activities) {
    const stmt = db.prepare(`
      INSERT INTO activities (name, type, date, meeting_point)
      VALUES (?, ?, ?, ?)
    `);
    data.activities.forEach(a => {
      if (a.name) {
        stmt.run(a.name, a.type, a.date, a.meeting_point);
        count++;
      }
    });
  }
  
  if (data.health_tags) {
    const stmt = db.prepare(`
      INSERT INTO health_tags (student_id, tag_type, tag_value, severity, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    data.health_tags.forEach(h => {
      if (h.student_id) {
        stmt.run(h.student_id, h.tag_type, h.tag_value, h.severity, h.note);
        count++;
      }
    });
  }
  
  if (data.consents) {
    const stmt = db.prepare(`
      INSERT INTO consents (student_id, activity_id, status, signed_by, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    data.consents.forEach(c => {
      if (c.student_id) {
        stmt.run(c.student_id, c.activity_id, c.status, c.signed_by, c.note);
        count++;
      }
    });
  }
  
  fs.unlinkSync(filePath);
  return { imported: count, type: 'json' };
}

module.exports = {
  addStudent, getStudents, updateStudent, deleteStudent,
  addConsent, getConsents,
  addHealthTag, getHealthTags,
  addTeacher, getTeachers,
  addVehicle, getVehicles,
  addActivity, getActivities, getActivity, updateActivity,
  getClasses,
  setRiskOverride, getRisks,
  getDepartureList, getRiskExport, getParentConfirmList,
  importCSV, importJSON
};
