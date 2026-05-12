const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function createPatient(data) {
  const existingPatient = db.prepare('SELECT * FROM patients WHERE id_card = ?').get(data.idCard);
  if (existingPatient) {
    return existingPatient;
  }
  
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO patients (id, name, id_card, gender, age, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  stmt.run(id, data.name, data.idCard || null, data.gender || null, data.age || null, data.phone || null);
  
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
}

function getPatientById(id) {
  return db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
}

function getPatientByIdCard(idCard) {
  return db.prepare('SELECT * FROM patients WHERE id_card = ?').get(idCard);
}

function getAllPatients() {
  return db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
}

function updatePatient(id, data) {
  const oldPatient = getPatientById(id);
  if (!oldPatient) return null;
  
  const updates = [];
  const values = [];
  const diff = {};
  
  const fields = ['name', 'id_card', 'gender', 'age', 'phone'];
  fields.forEach(field => {
    if (data[field] !== undefined && data[field] !== oldPatient[field]) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
      diff[field] = { old: oldPatient[field], new: data[field] };
    }
  });
  
  if (updates.length === 0) return { patient: oldPatient, diff: null };
  
  values.push(id);
  
  db.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return {
    patient: getPatientById(id),
    diff
  };
}

module.exports = {
  createPatient,
  getPatientById,
  getPatientByIdCard,
  getAllPatients,
  updatePatient
};
