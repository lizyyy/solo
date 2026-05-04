const { v4: uuidv4 } = require('uuid');
const { query, run, transaction } = require('../database/db');

class Floor {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.floor_number = data.floor_number || data.level;
    this.width = data.width;
    this.height = data.height;
    this.layout = data.layout ? JSON.stringify(data.layout) : null;
    this.description = data.description;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static create(data) {
    const floor = new Floor(data);
    run(
      `INSERT INTO floors (id, name, floor_number, width, height, layout, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [floor.id, floor.name, floor.floor_number, floor.width, floor.height, floor.layout, floor.description, floor.created_at, floor.updated_at]
    );
    return floor;
  }

  static findById(id) {
    const results = query('SELECT * FROM floors WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new Floor(results[0]);
  }

  static findAll() {
    const results = query('SELECT * FROM floors ORDER BY floor_number ASC');
    return results.map(row => new Floor(row));
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.floor_number !== undefined) {
      updateFields.push('floor_number = ?');
      values.push(data.floor_number);
    }
    if (data.width !== undefined) {
      updateFields.push('width = ?');
      values.push(data.width);
    }
    if (data.height !== undefined) {
      updateFields.push('height = ?');
      values.push(data.height);
    }
    if (data.layout !== undefined) {
      updateFields.push('layout = ?');
      values.push(data.layout ? JSON.stringify(data.layout) : null);
    }
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      values.push(data.description);
    }
    
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    run(
      `UPDATE floors SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    return Floor.findById(id);
  }

  static delete(id) {
    run('DELETE FROM floors WHERE id = ?', [id]);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      floor_number: this.floor_number,
      level: this.floor_number,
      width: this.width,
      height: this.height,
      layout: this.layout ? JSON.parse(this.layout) : null,
      description: this.description,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Floor;
