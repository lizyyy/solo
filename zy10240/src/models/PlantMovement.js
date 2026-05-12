const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class PlantMovement {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plant_movements 
         (id, plant_id, from_location_id, to_location_id, move_date, reason, handled_by, notes, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.plant_id,
          data.from_location_id,
          data.to_location_id,
          data.move_date,
          data.reason,
          data.handled_by,
          data.notes,
          requestId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM plant_movements WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPlant(plantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM plant_movements WHERE plant_id = ? ORDER BY move_date DESC',
        [plantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM plant_movements ORDER BY move_date DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = PlantMovement;
