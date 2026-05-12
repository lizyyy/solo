const dbManager = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = dbManager;
  }

  findById(id) {
    const result = this.db.get(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return result;
  }

  findAll(where = '1=1', params = [], orderBy = 'created_at DESC') {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${where} ORDER BY ${orderBy}`;
    return this.db.all(sql, params);
  }

  findOne(where = '1=1', params = []) {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${where} LIMIT 1`;
    return this.db.get(sql, params);
  }

  create(data, idField = 'id') {
    const dataWithId = { ...data };
    if (!dataWithId[idField]) {
      dataWithId[idField] = uuidv4();
    }

    const keys = Object.keys(dataWithId);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(key => dataWithId[key]);

    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    this.db.run(sql, values);

    return this.findById(dataWithId[idField]);
  }

  update(id, data) {
    const dataToUpdate = { ...data, updated_at: new Date().toISOString() };
    const keys = Object.keys(dataToUpdate);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => dataToUpdate[key]);

    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    this.db.run(sql, [...values, id]);

    return this.findById(id);
  }

  delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = this.db.run(sql, [id]);
    return result;
  }

  count(where = '1=1', params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${where}`;
    const result = this.db.get(sql, params);
    return result?.count || 0;
  }
}

module.exports = BaseModel;
