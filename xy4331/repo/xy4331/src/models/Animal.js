const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class Animal {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.animal_id = data.animal_id;
    this.species = data.species;
    this.strain = data.strain;
    this.gender = data.gender;
    this.birth_date = data.birth_date;
    this.arrival_date = data.arrival_date;
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(data) {
    const animal = new Animal(data);
    const existing = await getAsync(
      'SELECT * FROM animals WHERE animal_id = ?',
      [animal.animal_id]
    );
    
    if (existing) {
      await Animal.update(animal.animal_id, data);
      return await Animal.findByAnimalId(animal.animal_id);
    }

    await runAsync(
      `INSERT INTO animals (id, animal_id, species, strain, gender, birth_date, arrival_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [animal.id, animal.animal_id, animal.species, animal.strain, animal.gender, 
       animal.birth_date, animal.arrival_date, animal.status]
    );

    return animal;
  }

  static async update(animalId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = ['species', 'strain', 'gender', 'birth_date', 'arrival_date', 'status'];
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(animalId);

    await runAsync(
      `UPDATE animals SET ${updates.join(', ')} WHERE animal_id = ?`,
      values
    );
  }

  static async findByAnimalId(animalId) {
    const row = await getAsync(
      'SELECT * FROM animals WHERE animal_id = ?',
      [animalId]
    );
    return row ? new Animal(row) : null;
  }

  static async findAll(options = {}) {
    const { status, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM animals WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new Animal(row));
  }

  static async getTimeline(animalId) {
    const rows = await allAsync(
      `SELECT * FROM animal_timelines 
       WHERE animal_id = ? 
       ORDER BY event_time ASC`,
      [animalId]
    );
    return rows;
  }

  static async addTimelineEvent(animalId, eventData) {
    const event = {
      id: uuidv4(),
      animal_id: animalId,
      event_type: eventData.event_type,
      event_id: eventData.event_id,
      event_time: eventData.event_time,
      description: eventData.description,
      metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : null
    };

    await runAsync(
      `INSERT INTO animal_timelines (id, animal_id, event_type, event_id, event_time, description, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.animal_id, event.event_type, event.event_id, 
       event.event_time, event.description, event.metadata]
    );

    return event;
  }
}

module.exports = Animal;
