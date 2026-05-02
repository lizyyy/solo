const db = require('../database');
const Chemical = require('../../models/Chemical');

class ChemicalRepository {
  async create(chemical) {
    const sql = `
      INSERT INTO chemicals (
        id, name, english_name, cas_number, formula, danger_level,
        description, storage_requirements, unit, created_at, updated_at,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      chemical.id, chemical.name, chemical.english_name, chemical.cas_number,
      chemical.formula, chemical.danger_level, chemical.description,
      chemical.storage_requirements, chemical.unit, chemical.created_at,
      chemical.updated_at, chemical.created_by, chemical.updated_by
    ];
    
    await db.run(sql, params);
    return chemical;
  }

  async update(chemical) {
    const sql = `
      UPDATE chemicals SET
        name = ?, english_name = ?, cas_number = ?, formula = ?,
        danger_level = ?, description = ?, storage_requirements = ?,
        unit = ?, updated_at = ?, updated_by = ?
      WHERE id = ?
    `;
    
    const params = [
      chemical.name, chemical.english_name, chemical.cas_number,
      chemical.formula, chemical.danger_level, chemical.description,
      chemical.storage_requirements, chemical.unit, chemical.updated_at,
      chemical.updated_by, chemical.id
    ];
    
    await db.run(sql, params);
    return chemical;
  }

  async delete(id) {
    const sql = 'DELETE FROM chemicals WHERE id = ?';
    const result = await db.run(sql, [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const sql = 'SELECT * FROM chemicals WHERE id = ?';
    const row = await db.get(sql, [id]);
    if (row) {
      return new Chemical(row);
    }
    return null;
  }

  async findAll(options = {}) {
    let sql = 'SELECT * FROM chemicals WHERE 1=1';
    const params = [];
    
    if (options.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${options.name}%`);
    }
    
    if (options.danger_level) {
      sql += ' AND danger_level = ?';
      params.push(options.danger_level);
    }
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${options.sortBy} ${sortOrder}`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const rows = await db.all(sql, params);
    return rows.map(row => new Chemical(row));
  }

  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as total FROM chemicals WHERE 1=1';
    const params = [];
    
    if (options.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${options.name}%`);
    }
    
    if (options.danger_level) {
      sql += ' AND danger_level = ?';
      params.push(options.danger_level);
    }
    
    const result = await db.get(sql, params);
    return result.total;
  }

  async findByName(name) {
    const sql = 'SELECT * FROM chemicals WHERE name = ?';
    const row = await db.get(sql, [name]);
    if (row) {
      return new Chemical(row);
    }
    return null;
  }

  async findByCasNumber(casNumber) {
    const sql = 'SELECT * FROM chemicals WHERE cas_number = ?';
    const row = await db.get(sql, [casNumber]);
    if (row) {
      return new Chemical(row);
    }
    return null;
  }
}

module.exports = ChemicalRepository;
