const db = require('../config/database');

class Pet {
  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO pets (name, species, breed, weight, weightUnit, age, gender, ownerName, ownerPhone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.species, data.breed, data.weight, data.weightUnit, data.age, data.gender, data.ownerName, data.ownerPhone],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM pets ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM pets WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = Pet;
