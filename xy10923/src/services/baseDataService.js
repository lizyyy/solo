const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class BaseDataService {
  getRoutes() {
    return db.prepare('SELECT * FROM routes ORDER BY route_code').all();
  }

  getRouteById(id) {
    return db.prepare('SELECT * FROM routes WHERE id = ?').get(id);
  }

  getStops(includeTemporary = true) {
    let sql = 'SELECT * FROM stops';
    if (!includeTemporary) {
      sql += ' WHERE is_temporary = 0';
    }
    sql += ' ORDER BY stop_code';
    return db.prepare(sql).all();
  }

  getStopById(id) {
    return db.prepare('SELECT * FROM stops WHERE id = ?').get(id);
  }

  getStudents() {
    return db.prepare(`
      SELECT s.*, r.route_name 
      FROM students s 
      LEFT JOIN routes r ON s.route_id = r.id 
      ORDER BY s.student_no
    `).all();
  }

  getStudentById(id) {
    return db.prepare(`
      SELECT s.*, r.route_name 
      FROM students s 
      LEFT JOIN routes r ON s.route_id = r.id 
      WHERE s.id = ?
    `).get(id);
  }

  getDetourReasons() {
    return db.prepare('SELECT * FROM detour_reasons ORDER BY severity DESC').all();
  }

  getRouteStops(routeId) {
    return db.prepare(`
      SELECT rs.*, s.stop_name, s.address 
      FROM route_stops rs
      JOIN stops s ON rs.stop_id = s.id
      WHERE rs.route_id = ?
      ORDER BY rs.stop_order
    `).all(routeId);
  }

  addTemporaryStop(stopData) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO stops (id, stop_name, stop_code, address, is_temporary)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, stopData.stop_name, stopData.stop_code, stopData.address);
    return this.getStopById(id);
  }
}

module.exports = new BaseDataService();
