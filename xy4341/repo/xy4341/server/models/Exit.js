const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class Exit {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.floor_id = data.floor_id;
    this.name = data.name;
    this.type = data.type || 'normal';
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.status = data.status || 'available';
    this.capacity = data.capacity || 1;
    this.capacity_per_minute = data.capacity_per_minute || 10;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static create(data) {
    const exit = new Exit(data);
    run(
      `INSERT INTO exits (id, floor_id, name, type, x, y, width, status, capacity, capacity_per_minute, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exit.id, exit.floor_id, exit.name, exit.type, exit.x, exit.y, exit.width, exit.status, exit.capacity, exit.capacity_per_minute, exit.created_at, exit.updated_at]
    );
    return exit;
  }

  static findById(id) {
    const results = query('SELECT * FROM exits WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new Exit(results[0]);
  }

  static findByFloorId(floorId) {
    const results = query('SELECT * FROM exits WHERE floor_id = ? ORDER BY name ASC', [floorId]);
    return results.map(row => new Exit(row));
  }

  static findAll() {
    const results = query('SELECT * FROM exits ORDER BY floor_id, name ASC');
    return results.map(row => new Exit(row));
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updateFields.push('type = ?');
      values.push(data.type);
    }
    if (data.x !== undefined) {
      updateFields.push('x = ?');
      values.push(data.x);
    }
    if (data.y !== undefined) {
      updateFields.push('y = ?');
      values.push(data.y);
    }
    if (data.width !== undefined) {
      updateFields.push('width = ?');
      values.push(data.width);
    }
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      values.push(data.status);
    }
    if (data.capacity !== undefined) {
      updateFields.push('capacity = ?');
      values.push(data.capacity);
    }
    if (data.capacity_per_minute !== undefined) {
      updateFields.push('capacity_per_minute = ?');
      values.push(data.capacity_per_minute);
    }
    
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    run(
      `UPDATE exits SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    return Exit.findById(id);
  }

  static delete(id) {
    run('DELETE FROM exits WHERE id = ?', [id]);
  }

  toJSON() {
    return {
      id: this.id,
      floor_id: this.floor_id,
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      status: this.status,
      capacity: this.capacity,
      capacity_per_minute: this.capacity_per_minute,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Exit;
