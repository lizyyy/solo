const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');
const { BED_STATUS } = require('../utils/constants');

function getAvailableBeds(departmentId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  const stmt = db.prepare(`
    SELECT b.*, d.name as department_name, h.name as hospital_name
    FROM beds b
    JOIN departments d ON b.department_id = d.id
    JOIN hospitals h ON d.hospital_id = h.id
    WHERE b.department_id = ? 
      AND b.status = ?
      AND d.is_active = 1
    ORDER BY b.bed_number
  `);
  
  return stmt.all(departmentId, BED_STATUS.AVAILABLE);
}

function getBedStatusByDate(departmentId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  const availableBeds = db.prepare(`
    SELECT COUNT(*) as count FROM beds 
    WHERE department_id = ? AND status = ?
  `).get(departmentId, BED_STATUS.AVAILABLE).count;
  
  const reservedBeds = db.prepare(`
    SELECT COUNT(DISTINCT a.bed_id) as count 
    FROM appointments a
    JOIN transfer_requests r ON a.request_id = r.id
    WHERE r.to_department_id = ? 
      AND a.scheduled_date = ? 
      AND a.status IN (?, ?)
  `).get(departmentId, dateStr, 'confirmed', 'scheduled').count;
  
  return {
    available: availableBeds,
    reserved: reservedBeds,
    date: dateStr
  };
}

function getAllBedStatus() {
  return db.prepare(`
    SELECT 
      h.id as hospital_id,
      h.name as hospital_name,
      d.id as department_id,
      d.name as department_name,
      d.is_active as department_active,
      SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END) as available_beds,
      SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END) as occupied_beds,
      SUM(CASE WHEN b.status = ? THEN 1 ELSE 0 END) as reserved_beds,
      COUNT(*) as total_beds
    FROM beds b
    JOIN departments d ON b.department_id = d.id
    JOIN hospitals h ON d.hospital_id = h.id
    GROUP BY h.id, d.id
    ORDER BY h.name, d.name
  `).all(BED_STATUS.AVAILABLE, BED_STATUS.OCCUPIED, BED_STATUS.RESERVED);
}

function updateBedStatus(bedId, status, reason) {
  const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(bedId);
  if (!bed) return null;
  
  db.prepare(`
    UPDATE beds SET status = ? WHERE id = ?
  `).run(status, bedId);
  
  return db.prepare('SELECT * FROM beds WHERE id = ?').get(bedId);
}

function getBedById(bedId) {
  return db.prepare('SELECT * FROM beds WHERE id = ?').get(bedId);
}

module.exports = {
  getAvailableBeds,
  getBedStatusByDate,
  getAllBedStatus,
  updateBedStatus,
  getBedById
};
