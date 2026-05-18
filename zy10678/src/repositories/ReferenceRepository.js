const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');

class ReferenceRepository {
  async createRoute(data) {
    const id = uuidv4();
    const sql = `
      INSERT INTO routes (id, name, code, start_point, end_point, waypoints, distance, altitude, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [
        id,
        data.name,
        data.code,
        data.start_point,
        data.end_point,
        data.waypoints ? JSON.stringify(data.waypoints) : null,
        data.distance,
        data.altitude,
        data.status || 'active'
      ], function(err) {
        if (err) reject(err);
        else resolve({ id, ...data });
      });
    });
  }

  async getRouteById(id) {
    const sql = 'SELECT * FROM routes WHERE id = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getRouteByCode(code) {
    const sql = 'SELECT * FROM routes WHERE code = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllRoutes() {
    const sql = 'SELECT * FROM routes ORDER BY created_at DESC';
    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async createDrone(data) {
    const id = uuidv4();
    const sql = `
      INSERT INTO drones (id, name, code, model, serial_number, max_flight_time, max_altitude, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [
        id,
        data.name,
        data.code,
        data.model,
        data.serial_number,
        data.max_flight_time,
        data.max_altitude,
        data.status || 'idle'
      ], function(err) {
        if (err) reject(err);
        else resolve({ id, ...data });
      });
    });
  }

  async getDroneById(id) {
    const sql = 'SELECT * FROM drones WHERE id = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getDroneByCode(code) {
    const sql = 'SELECT * FROM drones WHERE code = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [code], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllDrones() {
    const sql = 'SELECT * FROM drones ORDER BY created_at DESC';
    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async createApplicant(data) {
    const id = uuidv4();
    const sql = `
      INSERT INTO applicants (id, name, department, phone, email)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [
        id,
        data.name,
        data.department,
        data.phone,
        data.email
      ], function(err) {
        if (err) reject(err);
        else resolve({ id, ...data });
      });
    });
  }

  async getApplicantById(id) {
    const sql = 'SELECT * FROM applicants WHERE id = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getApplicantByName(name) {
    const sql = 'SELECT * FROM applicants WHERE name = ?';
    return new Promise((resolve, reject) => {
      db.get(sql, [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllApplicants() {
    const sql = 'SELECT * FROM applicants ORDER BY name ASC';
    return new Promise((resolve, reject) => {
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new ReferenceRepository();