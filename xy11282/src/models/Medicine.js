const db = require('../config/database');

class Medicine {
  static create(data) {
    return new Promise((resolve, reject) => {
      const contraindications = JSON.stringify(data.contraindications || []);
      db.run(
        `INSERT INTO medicines (name, specification, manufacturer, dosageMin, dosageMax, dosageUnit, frequency, contraindications)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.specification, data.manufacturer, data.dosageMin, data.dosageMax, data.dosageUnit, data.frequency, contraindications],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM medicines ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          contraindications: JSON.parse(row.contraindications || '[]')
        })));
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM medicines WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve({
          ...row,
          contraindications: JSON.parse(row.contraindications || '[]')
        });
      });
    });
  }

  static findByIds(ids) {
    return new Promise((resolve, reject) => {
      const placeholders = ids.map(() => '?').join(',');
      db.all(`SELECT * FROM medicines WHERE id IN (${placeholders})`, ids, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          contraindications: JSON.parse(row.contraindications || '[]')
        })));
      });
    });
  }
}

module.exports = Medicine;
