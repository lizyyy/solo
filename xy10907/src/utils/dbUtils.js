const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DBUtils {
  static runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  static getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async insert(table, data) {
    const id = uuidv4();
    const dataWithId = { id, ...data };
    const keys = Object.keys(dataWithId);
    const placeholders = keys.map(() => '?').join(',');
    const values = keys.map(key => dataWithId[key]);
    
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
    await this.runQuery(sql, values);
    return id;
  }

  static async update(table, data, id) {
    const keys = Object.keys(data).filter(key => key !== 'id');
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => data[key]);
    values.push(id);
    
    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return this.runQuery(sql, values);
  }

  static async delete(table, id) {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    return this.runQuery(sql, [id]);
  }
}

module.exports = DBUtils;
