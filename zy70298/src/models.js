const db = require('./database');
const { v4: uuid } = require('uuid');
const { BusinessError } = require('./errors');

function recordIssue(type, severity, sourceType, sourceId, title, description, data) {
  const id = uuid();
  db.prepare(`
    INSERT INTO issues (id, type, severity, source_type, source_id, title, description, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, severity, sourceType, sourceId, title, description, JSON.stringify(data || {}));
  return id;
}

function recordError(error) {
  return recordIssue(
    error.issueType,
    error.severity,
    error.sourceType,
    error.sourceId,
    error.message,
    JSON.stringify(error.details),
    error.details
  );
}

const Elder = {
  create(data) {
    const id = data.id || uuid();
    db.prepare(`
      INSERT INTO elders (id, name, bed_number, status)
      VALUES (?, ?, ?, ?)
    `).run(id, data.name, data.bed_number, data.status || 'active');
    return this.get(id);
  },
  
  get(id) {
    const elder = db.prepare('SELECT * FROM elders WHERE id = ?').get(id);
    if (!elder) {
      const err = new BusinessError('ELDER_NOT_FOUND', { elderId: id }, 'elder', id);
      recordError(err);
      throw err;
    }
    return elder;
  },
  
  list(status = null) {
    if (status) {
      return db.prepare('SELECT * FROM elders WHERE status = ?').all(status);
    }
    return db.prepare('SELECT * FROM elders').all();
  },
  
  update(id, data) {
    this.get(id);
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.bed_number !== undefined) { fields.push('bed_number = ?'); values.push(data.bed_number); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    values.push(id);
    db.prepare(`UPDATE elders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }
};

const Prescription = {
  create(data) {
    Elder.get(data.elder_id);
    const id = data.id || uuid();
    const maxVersion = db.prepare(
      'SELECT MAX(version) as v FROM prescriptions WHERE elder_id = ?'
    ).get(data.elder_id);
    const version = (maxVersion?.v || 0) + 1;
    
    db.prepare(`
      INSERT INTO prescriptions (id, elder_id, version, doctor_name, effective_from, effective_to, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.elder_id, version, data.doctor_name, data.effective_from, data.effective_to || null, data.status || 'active', data.notes || null);
    
    if (data.items && data.items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO prescription_items (id, prescription_id, medicine_name, dosage, frequency, quantity, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of data.items) {
        itemStmt.run(uuid(), id, item.medicine_name, item.dosage, item.frequency, item.quantity, item.unit || '片');
      }
    }
    
    return this.get(id);
  },
  
  get(id) {
    const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(id);
    if (!prescription) {
      const err = new BusinessError('PRESCRIPTION_NOT_FOUND', { prescriptionId: id }, 'prescription', id);
      recordError(err);
      throw err;
    }
    prescription.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(id);
    return prescription;
  },
  
  listByElder(elderId) {
    Elder.get(elderId);
    const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE elder_id = ? ORDER BY version DESC').all(elderId);
    return prescriptions.map(p => {
      p.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(p.id);
      return p;
    });
  },
  
  getActiveForElder(elderId, date) {
    const checkDate = date || new Date().toISOString().split('T')[0];
    const prescription = db.prepare(`
      SELECT * FROM prescriptions 
      WHERE elder_id = ? 
        AND status = 'active'
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY version DESC
      LIMIT 1
    `).get(elderId, checkDate, checkDate);
    
    if (!prescription) {
      const err = new BusinessError('PRESCRIPTION_NOT_FOUND', { elderId, checkDate }, 'prescription', elderId);
      recordError(err);
      throw err;
    }
    
    prescription.items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(prescription.id);
    return prescription;
  }
};

const PillBox = {
  create(data) {
    Elder.get(data.elder_id);
    const id = data.id || uuid();
    db.prepare(`
      INSERT INTO pill_boxes (id, elder_id, box_label, intended_date, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.elder_id, data.box_label, data.intended_date, data.status || 'prepared');
    
    if (data.items && data.items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO pill_box_items (id, pill_box_id, medicine_name, dosage, quantity, unit)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const item of data.items) {
        itemStmt.run(uuid(), id, item.medicine_name, item.dosage, item.quantity, item.unit || '片');
      }
    }
    
    return this.get(id);
  },
  
  get(id) {
    const pillBox = db.prepare('SELECT * FROM pill_boxes WHERE id = ?').get(id);
    if (!pillBox) {
      const err = new BusinessError('PILL_BOX_NOT_FOUND', { pillBoxId: id }, 'pill_box', id);
      recordError(err);
      throw err;
    }
    pillBox.items = db.prepare('SELECT * FROM pill_box_items WHERE pill_box_id = ?').all(id);
    return pillBox;
  },
  
  listByElder(elderId) {
    Elder.get(elderId);
    const boxes = db.prepare('SELECT * FROM pill_boxes WHERE elder_id = ? ORDER BY intended_date DESC').all(elderId);
    return boxes.map(b => {
      b.items = db.prepare('SELECT * FROM pill_box_items WHERE pill_box_id = ?').all(b.id);
      return b;
    });
  },
  
  updateStatus(id, status) {
    this.get(id);
    db.prepare('UPDATE pill_boxes SET status = ? WHERE id = ?').run(status, id);
    return this.get(id);
  }
};

const Distribution = {
  get(id) {
    const dist = db.prepare('SELECT * FROM distributions WHERE id = ?').get(id);
    if (!dist) {
      const err = new BusinessError('DISTRIBUTION_NOT_FOUND', { distributionId: id }, 'distribution', id);
      recordError(err);
      throw err;
    }
    return dist;
  },
  
  listByPillBox(pillBoxId) {
    return db.prepare('SELECT * FROM distributions WHERE pill_box_id = ? ORDER BY distributed_at DESC').all(pillBoxId);
  }
};

const Receipt = {
  get(id) {
    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id);
    if (!receipt) {
      const err = new BusinessError('RECEIPT_NOT_FOUND', { receiptId: id }, 'receipt', id);
      recordError(err);
      throw err;
    }
    return receipt;
  },
  
  listByDistribution(distributionId) {
    return db.prepare('SELECT * FROM receipts WHERE distribution_id = ? ORDER BY received_at DESC').all(distributionId);
  }
};

const Issue = {
  list(status = null) {
    if (status) {
      return db.prepare('SELECT * FROM issues WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM issues ORDER BY created_at DESC').all();
  },
  
  get(id) {
    return db.prepare('SELECT * FROM issues WHERE id = ?').get(id);
  },
  
  resolve(id, notes = null) {
    const updates = ['status = ?'];
    const values = ['resolved'];
    if (notes) {
      updates.push('data = JSON_SET(data, "$.resolution_notes", ?)');
      values.push(notes);
    }
    values.push(id);
    db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }
};

module.exports = {
  Elder,
  Prescription,
  PillBox,
  Distribution,
  Receipt,
  Issue,
  recordIssue,
  recordError
};
