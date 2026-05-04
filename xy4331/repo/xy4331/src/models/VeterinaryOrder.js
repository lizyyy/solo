const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const Animal = require('./Animal');

class VeterinaryOrder {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.order_id = data.order_id;
    this.animal_id = data.animal_id;
    this.examination_date = data.examination_date;
    this.symptoms = data.symptoms;
    this.diagnosis = data.diagnosis;
    this.treatment_plan = data.treatment_plan;
    this.medications = data.medications;
    this.observation_period_days = data.observation_period_days || 7;
    this.start_observation_date = data.start_observation_date;
    this.veterinarian_signature = data.veterinarian_signature;
    this.signature_date = data.signature_date;
    this.status = data.status || 'draft';
    this.notes = data.notes;
    this.created_at = data.created_at;
  }

  static async create(data) {
    const order = new VeterinaryOrder(data);
    
    if (!order.order_id) {
      order.order_id = `VET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const existing = await getAsync(
      'SELECT * FROM veterinary_orders WHERE order_id = ?',
      [order.order_id]
    );
    
    if (existing) {
      await VeterinaryOrder.update(order.order_id, data);
      return await VeterinaryOrder.findByOrderId(order.order_id);
    }

    await runAsync(
      `INSERT INTO veterinary_orders 
       (id, order_id, animal_id, examination_date, symptoms, diagnosis,
        treatment_plan, medications, observation_period_days, 
        start_observation_date, veterinarian_signature, signature_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.order_id, order.animal_id, order.examination_date,
       order.symptoms, order.diagnosis, order.treatment_plan, order.medications,
       order.observation_period_days, order.start_observation_date,
       order.veterinarian_signature, order.signature_date, order.status, order.notes]
    );

    return order;
  }

  static async update(orderId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'animal_id', 'examination_date', 'symptoms', 'diagnosis',
      'treatment_plan', 'medications', 'observation_period_days',
      'start_observation_date', 'veterinarian_signature', 'signature_date',
      'status', 'notes'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    values.push(orderId);

    await runAsync(
      `UPDATE veterinary_orders SET ${updates.join(', ')} WHERE order_id = ?`,
      values
    );
  }

  static async findByOrderId(orderId) {
    const row = await getAsync(
      'SELECT * FROM veterinary_orders WHERE order_id = ?',
      [orderId]
    );
    return row ? new VeterinaryOrder(row) : null;
  }

  static async findAll(options = {}) {
    const { status, animal_id, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM veterinary_orders WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (animal_id) {
      sql += ' AND animal_id = ?';
      params.push(animal_id);
    }

    sql += ' ORDER BY examination_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new VeterinaryOrder(row));
  }

  static async signOrder(orderId, veterinarianSignature, signatureDate) {
    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      throw new Error(`处置单不存在: ${orderId}`);
    }

    await VeterinaryOrder.update(orderId, {
      veterinarian_signature: veterinarianSignature,
      signature_date: signatureDate || new Date().toISOString(),
      status: 'signed'
    });

    await Animal.addTimelineEvent(order.animal_id, {
      event_type: 'veterinary_sign',
      event_id: order.order_id,
      event_time: new Date().toISOString(),
      description: `处置单已由 ${veterinarianSignature} 签署`,
      metadata: {
        order_id: order.order_id,
        diagnosis: order.diagnosis,
        veterinarian: veterinarianSignature
      }
    });

    return await VeterinaryOrder.findByOrderId(orderId);
  }

  static async startObservation(orderId) {
    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      throw new Error(`处置单不存在: ${orderId}`);
    }

    const startDate = new Date().toISOString();
    
    await VeterinaryOrder.update(orderId, {
      start_observation_date: startDate,
      status: 'observing'
    });

    await Animal.addTimelineEvent(order.animal_id, {
      event_type: 'observation_start',
      event_id: order.order_id,
      event_time: startDate,
      description: `开始 ${order.observation_period_days} 天观察期`,
      metadata: {
        order_id: order.order_id,
        observation_days: order.observation_period_days,
        start_date: startDate
      }
    });

    return await VeterinaryOrder.findByOrderId(orderId);
  }

  static async getObservingOrders() {
    const rows = await allAsync(
      `SELECT vo.*, a.species, a.strain, a.gender
       FROM veterinary_orders vo
       JOIN animals a ON vo.animal_id = a.animal_id
       WHERE vo.status = 'observing'
       ORDER BY vo.start_observation_date ASC`
    );
    return rows.map(row => new VeterinaryOrder(row));
  }

  static async checkObservationTimeout(orderId) {
    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order || order.status !== 'observing' || !order.start_observation_date) {
      return false;
    }

    const startDate = new Date(order.start_observation_date);
    const now = new Date();
    const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    return daysDiff > order.observation_period_days;
  }

  static async completeObservation(orderId, outcomeNotes, completedBy) {
    const order = await VeterinaryOrder.findByOrderId(orderId);
    
    if (!order) {
      throw new Error(`处置单不存在: ${orderId}`);
    }

    await VeterinaryOrder.update(orderId, {
      status: 'completed',
      notes: order.notes ? `${order.notes}\n观察结果: ${outcomeNotes}` : `观察结果: ${outcomeNotes}`
    });

    await Animal.addTimelineEvent(order.animal_id, {
      event_type: 'observation_complete',
      event_id: order.order_id,
      event_time: new Date().toISOString(),
      description: `观察期结束，结果: ${outcomeNotes.substring(0, 50)}...`,
      metadata: {
        order_id: order.order_id,
        outcome: outcomeNotes,
        completed_by: completedBy
      }
    });

    return await VeterinaryOrder.findByOrderId(orderId);
  }

  static async getUnsignedOrders() {
    const rows = await allAsync(
      `SELECT vo.*, a.species, a.strain
       FROM veterinary_orders vo
       JOIN animals a ON vo.animal_id = a.animal_id
       WHERE vo.status = 'draft' OR vo.veterinarian_signature IS NULL
       ORDER BY vo.examination_date ASC`
    );
    return rows.map(row => new VeterinaryOrder(row));
  }

  static async getAnimalOrders(animalId) {
    const rows = await allAsync(
      `SELECT * FROM veterinary_orders 
       WHERE animal_id = ?
       ORDER BY examination_date DESC`,
      [animalId]
    );
    return rows.map(row => new VeterinaryOrder(row));
  }
}

module.exports = VeterinaryOrder;
