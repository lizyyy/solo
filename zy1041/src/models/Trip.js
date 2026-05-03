const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Trip {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const {
        traveler_id,
        start_location,
        waypoints = [],
        destination,
        departure_time,
        arrival_time,
        available_capacity_weight = 10,
        available_capacity_volume = 20,
        forbidden_items = []
      } = data;

      const sql = `INSERT INTO trips 
        (id, traveler_id, start_location, waypoints, destination, departure_time, 
         arrival_time, available_capacity_weight, available_capacity_volume, forbidden_items, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`;

      db.run(sql, [
        id, traveler_id, start_location, JSON.stringify(waypoints), destination,
        departure_time, arrival_time, available_capacity_weight, available_capacity_volume,
        JSON.stringify(forbidden_items)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...data });
        }
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM trips WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            row.waypoints = row.waypoints ? JSON.parse(row.waypoints) : [];
            row.forbidden_items = row.forbidden_items ? JSON.parse(row.forbidden_items) : [];
          }
          resolve(row);
        }
      });
    });
  }

  static findByTravelerId(traveler_id) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM trips WHERE traveler_id = ? ORDER BY created_at DESC', [traveler_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            waypoints: row.waypoints ? JSON.parse(row.waypoints) : [],
            forbidden_items: row.forbidden_items ? JSON.parse(row.forbidden_items) : []
          }));
          resolve(rows);
        }
      });
    });
  }

  static findAllActive() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM trips WHERE status = 'active' ORDER BY created_at ASC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            waypoints: row.waypoints ? JSON.parse(row.waypoints) : [],
            forbidden_items: row.forbidden_items ? JSON.parse(row.forbidden_items) : []
          }));
          resolve(rows);
        }
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE trips SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(sql, [status, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM trips ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows = rows.map(row => ({
            ...row,
            waypoints: row.waypoints ? JSON.parse(row.waypoints) : [],
            forbidden_items: row.forbidden_items ? JSON.parse(row.forbidden_items) : []
          }));
          resolve(rows);
        }
      });
    });
  }
}

module.exports = Trip;
