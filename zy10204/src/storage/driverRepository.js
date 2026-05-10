const { getDatabase } = require('./database');

function insertDriver(driver) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO drivers (id, driver_id, name, phone, license_plate, is_active, created_at, updated_at)
    VALUES (@id, @driverId, @name, @phone, @licensePlate, @isActive, @createdAt, @updatedAt)
  `);
  const data = {
    ...driver,
    isActive: driver.isActive ? 1 : 0
  };
  stmt.run(data);
  return driver;
}

function findDriverByDriverId(driverId) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM drivers WHERE driver_id = ?').get(driverId);
  return row ? mapToDriver(row) : null;
}

function findDriverById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  return row ? mapToDriver(row) : null;
}

function getAllDrivers(activeOnly = true) {
  const db = getDatabase();
  let query = 'SELECT * FROM drivers';
  if (activeOnly) {
    query += ' WHERE is_active = 1';
  }
  query += ' ORDER BY name';
  const rows = db.prepare(query).all();
  return rows.map(mapToDriver);
}

function insertShift(shift) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO shifts (id, code, name, start_time, end_time, is_active, created_at, updated_at)
    VALUES (@id, @code, @name, @startTime, @endTime, @isActive, @createdAt, @updatedAt)
  `);
  const data = {
    ...shift,
    isActive: shift.isActive ? 1 : 0
  };
  stmt.run(data);
  return shift;
}

function findShiftByCode(code) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM shifts WHERE code = ?').get(code);
  return row ? mapToShift(row) : null;
}

function insertDriverAssignment(assignment) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO driver_assignments (id, driver_id, line_id, shift_id, effective_date, is_active, created_at)
    VALUES (@id, @driverId, @lineId, @shiftId, @effectiveDate, @isActive, @createdAt)
  `);
  const data = {
    ...assignment,
    isActive: assignment.isActive ? 1 : 0
  };
  stmt.run(data);
  return assignment;
}

function getDriverAssignments(date) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT da.*, d.name as driver_name, d.phone as driver_phone, d.license_plate,
           l.code as line_code, l.name as line_name,
           s.code as shift_code, s.name as shift_name, s.start_time, s.end_time
    FROM driver_assignments da
    JOIN drivers d ON da.driver_id = d.id
    JOIN lines l ON da.line_id = l.id
    JOIN shifts s ON da.shift_id = s.id
    WHERE da.effective_date <= ? AND da.is_active = 1
    ORDER BY l.code, s.code
  `).all(date);
  return rows.map(row => ({
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    licensePlate: row.license_plate,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    shiftId: row.shift_id,
    shiftCode: row.shift_code,
    shiftName: row.shift_name,
    startTime: row.start_time,
    endTime: row.end_time,
    effectiveDate: row.effective_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  }));
}

function getAssignmentsByLine(lineId, date) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT da.*, d.name as driver_name, d.phone as driver_phone, d.license_plate,
           l.code as line_code, l.name as line_name,
           s.code as shift_code, s.name as shift_name, s.start_time, s.end_time
    FROM driver_assignments da
    JOIN drivers d ON da.driver_id = d.id
    JOIN lines l ON da.line_id = l.id
    JOIN shifts s ON da.shift_id = s.id
    WHERE da.line_id = ? AND da.effective_date <= ? AND da.is_active = 1
    ORDER BY s.code
  `).all(lineId, date);
  return rows.map(row => ({
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    driverPhone: row.driver_phone,
    licensePlate: row.license_plate,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    shiftId: row.shift_id,
    shiftCode: row.shift_code,
    shiftName: row.shift_name,
    startTime: row.start_time,
    endTime: row.end_time,
    effectiveDate: row.effective_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at
  }));
}

function mapToDriver(row) {
  return {
    id: row.id,
    driverId: row.driver_id,
    name: row.name,
    phone: row.phone,
    licensePlate: row.license_plate,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapToShift(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  insertDriver,
  findDriverByDriverId,
  findDriverById,
  getAllDrivers,
  insertShift,
  findShiftByCode,
  insertDriverAssignment,
  getDriverAssignments,
  getAssignmentsByLine
};
