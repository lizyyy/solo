const { v4: uuidv4 } = require('uuid');
const { runQuery } = require('../config/database');

class Task {
  constructor({ id, name, description, status, created_at, updated_at }) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description || '';
    this.status = status || 'pending';
    this.createdAt = created_at;
    this.updatedAt = updated_at;
  }

  static create({ name, description }) {
    const task = new Task({ name, description });
    
    runQuery(
      'INSERT INTO tasks (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [task.id, task.name, task.description, task.status]
    );
    
    return task;
  }

  static findById(id) {
    const results = runQuery('SELECT * FROM tasks WHERE id = ?', [id]);
    if (results.length === 0) return null;
    return new Task(results[0]);
  }

  static findAll(limit = 50, offset = 0) {
    const results = runQuery(
      'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return results.map(row => new Task(row));
  }

  static count() {
    const result = runQuery('SELECT COUNT(*) as count FROM tasks');
    return result[0]?.count || 0;
  }

  update({ name, description, status }) {
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
      this.name = name;
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
      this.description = description;
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
      this.status = status;
    }
    
    if (updates.length === 0) return this;
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(this.id);
    
    runQuery(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return this;
  }

  delete() {
    runQuery('DELETE FROM tasks WHERE id = ?', [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Task;
