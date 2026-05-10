const { getDatabase } = require('./database');

function insertStudent(student) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO students (id, student_id, name, grade, class, is_active, created_at, updated_at)
    VALUES (@id, @studentId, @name, @grade, @class, @isActive, @createdAt, @updatedAt)
  `);
  const data = {
    ...student,
    isActive: student.isActive ? 1 : 0
  };
  stmt.run(data);
  return student;
}

function findStudentByStudentId(studentId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM students WHERE student_id = ?').get(studentId);
  return row ? mapToStudent(row) : null;
}

function findStudentById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  return row ? mapToStudent(row) : null;
}

function getAllStudents(activeOnly = true) {
  const db = getDatabase();
  let query = 'SELECT * FROM students';
  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY grade, class, name';
  const rows = db.prepare(query).all();
  return rows.map(mapToStudent);
}

function updateStudent(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = {};

  if (updates.name !== undefined) {
    fields.push('name = @name');
    values.name = updates.name;
  }
  if (updates.grade !== undefined) {
    fields.push('grade = @grade');
    values.grade = updates.grade;
  }
  if (updates.class !== undefined) {
    fields.push('class = @class');
    values.class = updates.class;
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = @isActive');
    values.isActive = updates.isActive ? 1 : 0;
  }

  if (fields.length === 0) return null;

  fields.push('updated_at = @updatedAt');
  values.updatedAt = new Date().toISOString();
  values.id = id;

  const stmt = db.prepare(`UPDATE students SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);
  return findStudentById(id);
}

function insertStudentLine(studentLine) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO student_lines (id, student_id, line_id, stop_id, default_stop_id, created_at)
    VALUES (@id, @studentId, @lineId, @stopId, @defaultStopId, @createdAt)
  `);
  stmt.run(studentLine);
  return studentLine;
}

function getStudentLines(studentId) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT sl.*, s.name as student_name, l.code as line_code, l.name as line_name,
           st.code as stop_code, st.name as stop_name,
           dst.code as default_stop_code, dst.name as default_stop_name
    FROM student_lines sl
    JOIN students s ON sl.student_id = s.id
    JOIN lines l ON sl.line_id = l.id
    JOIN stops st ON sl.stop_id = st.id
    JOIN stops dst ON sl.default_stop_id = dst.id
    WHERE sl.student_id = ?
  `).all(studentId);
  return rows.map(row => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    stopId: row.stop_id,
    stopCode: row.stop_code,
    stopName: row.stop_name,
    defaultStopId: row.default_stop_id,
    defaultStopCode: row.default_stop_code,
    defaultStopName: row.default_stop_name,
    createdAt: row.created_at
  }));
}

function findStudentLine(studentId, lineId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT sl.*, s.name as student_name, l.code as line_code, l.name as line_name,
           st.code as stop_code, st.name as stop_name,
           dst.code as default_stop_code, dst.name as default_stop_name
    FROM student_lines sl
    JOIN students s ON sl.student_id = s.id
    JOIN lines l ON sl.line_id = l.id
    JOIN stops st ON sl.stop_id = st.id
    JOIN stops dst ON sl.default_stop_id = dst.id
    WHERE sl.student_id = ? AND sl.line_id = ?
  `).get(studentId, lineId);
  return row ? {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    stopId: row.stop_id,
    stopCode: row.stop_code,
    stopName: row.stop_name,
    defaultStopId: row.default_stop_id,
    defaultStopCode: row.default_stop_code,
    defaultStopName: row.default_stop_name,
    createdAt: row.created_at
  } : null;
}

function updateStudentLine(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = {};

  if (updates.stopId !== undefined) {
    fields.push('stop_id = @stopId');
    values.stopId = updates.stopId;
  }
  if (updates.defaultStopId !== undefined) {
    fields.push('default_stop_id = @defaultStopId');
    values.defaultStopId = updates.defaultStopId;
  }

  if (fields.length === 0) return null;

  values.id = id;

  const stmt = db.prepare(`UPDATE student_lines SET ${fields.join(', ')} WHERE id = @id`);
  stmt.run(values);

  const row = db.prepare(`
    SELECT sl.*, s.name as student_name, l.code as line_code, l.name as line_name,
           st.code as stop_code, st.name as stop_name,
           dst.code as default_stop_code, dst.name as default_stop_name
    FROM student_lines sl
    JOIN students s ON sl.student_id = s.id
    JOIN lines l ON sl.line_id = l.id
    JOIN stops st ON sl.stop_id = st.id
    JOIN stops dst ON sl.default_stop_id = dst.id
    WHERE sl.id = ?
  `).get(id);

  return row ? {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    stopId: row.stop_id,
    stopCode: row.stop_code,
    stopName: row.stop_name,
    defaultStopId: row.default_stop_id,
    defaultStopCode: row.default_stop_code,
    defaultStopName: row.default_stop_name,
    createdAt: row.created_at
  } : null;
}

function insertParent(parent) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO parents (id, name, phone, relationship, student_id, created_at, updated_at)
    VALUES (@id, @name, @phone, @relationship, @studentId, @createdAt, @updatedAt)
  `);
  stmt.run(parent);
  return parent;
}

function getParentsByStudentId(studentId) {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM parents WHERE student_id = ? ORDER BY created_at').all(studentId);
  return rows.map(mapToParent);
}

function mapToStudent(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    grade: row.grade,
    class: row.class,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapToParent(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    relationship: row.relationship,
    studentId: row.student_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  insertStudent,
  findStudentByStudentId,
  findStudentById,
  getAllStudents,
  updateStudent,
  insertStudentLine,
  getStudentLines,
  findStudentLine,
  updateStudentLine,
  insertParent,
  getParentsByStudentId
};
