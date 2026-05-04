const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../database/db');

class Person {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.floor_id = data.floor_id;
    this.name = data.name;
    this.x = data.x;
    this.y = data.y;
    this.status = data.status || 'idle';
    this.speed = data.speed || 1.0;
    this.mobility = data.mobility || 'normal';
    this.nearest_exit_id = data.nearest_exit_id;
    this.evacuation_time = data.evacuation_time;
    this.created_at = data.created_at || new Date().toISOString();
    this.updated_at = data.updated_at || new Date().toISOString();
  }

  static create(data) {
    const person = new Person(data);
    run(
      `INSERT INTO persons (id, floor_id, name, x, y, status, speed, mobility, nearest_exit_id, evacuation_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [person.id, person.floor_id, person.name, person.x, person.y, person.status, person.speed, person.mobility, person.nearest_exit_id, person.evacuation_time, person.created_at, person.updated_at]
    );
    return person;
  }

  static bulkCreate(personsData) {
    const createdPersons = [];
    for (const data of personsData) {
      const person = Person.create(data);
      createdPersons.push(person);
    }
    return createdPersons;
  }

  static findById(id) {
    const results = query('SELECT * FROM persons WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new Person(results[0]);
  }

  static findByFloorId(floorId) {
    const results = query('SELECT * FROM persons WHERE floor_id = ?', [floorId]);
    return results.map(row => new Person(row));
  }

  static findByStatus(status) {
    const results = query('SELECT * FROM persons WHERE status = ?', [status]);
    return results.map(row => new Person(row));
  }

  static findAll() {
    const results = query('SELECT * FROM persons ORDER BY floor_id, id ASC');
    return results.map(row => new Person(row));
  }

  static getSummary() {
    const results = query(`
      SELECT status, COUNT(*) as count 
      FROM persons 
      GROUP BY status
    `);
    const summary = { idle: 0, evacuating: 0, evacuated: 0, trapped: 0, injured: 0, total: 0 };
    for (const row of results) {
      if (summary[row.status] !== undefined) {
        summary[row.status] = row.count;
      }
      summary.total += row.count;
    }
    return summary;
  }

  static getStatusSummary() {
    const summary = this.getSummary();
    return {
      idle: summary.idle,
      evacuating: summary.evacuating,
      evacuated: summary.evacuated,
      trapped: summary.trapped,
      injured: summary.injured
    };
  }

  static update(id, data) {
    const updateFields = [];
    const values = [];
    
    if (data.floor_id !== undefined) {
      updateFields.push('floor_id = ?');
      values.push(data.floor_id);
    }
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.x !== undefined) {
      updateFields.push('x = ?');
      values.push(data.x);
    }
    if (data.y !== undefined) {
      updateFields.push('y = ?');
      values.push(data.y);
    }
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      values.push(data.status);
    }
    if (data.speed !== undefined) {
      updateFields.push('speed = ?');
      values.push(data.speed);
    }
    if (data.mobility !== undefined) {
      updateFields.push('mobility = ?');
      values.push(data.mobility);
    }
    if (data.nearest_exit_id !== undefined) {
      updateFields.push('nearest_exit_id = ?');
      values.push(data.nearest_exit_id);
    }
    if (data.evacuation_time !== undefined) {
      updateFields.push('evacuation_time = ?');
      values.push(data.evacuation_time);
    }
    
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    if (updateFields.length > 1) {
      run(
        `UPDATE persons SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    }
    
    return Person.findById(id);
  }

  static delete(id) {
    run('DELETE FROM persons WHERE id = ?', [id]);
  }

  static deleteByFloorId(floorId) {
    run('DELETE FROM persons WHERE floor_id = ?', [floorId]);
  }

  static deleteAll() {
    run('DELETE FROM persons');
  }

  toJSON() {
    return {
      id: this.id,
      floor_id: this.floor_id,
      name: this.name,
      x: this.x,
      y: this.y,
      status: this.status,
      speed: this.speed,
      mobility: this.mobility,
      nearest_exit_id: this.nearest_exit_id,
      evacuation_time: this.evacuation_time,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Person;
