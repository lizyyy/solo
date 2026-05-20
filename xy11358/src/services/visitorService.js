const { db } = require('../models/database');
const { maskPhone } = require('../utils/security');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class VisitorService {
  async createVisitor(data, createdBy) {
    const id = uuidv4();
    const now = moment().format();
    const status = data.status || 'pending';

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO visitors (
          id, name, phone, id_card, company, visit_purpose,
          visit_date, start_time, end_time, host_name, host_phone,
          host_department, status, license_plate, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.name, data.phone, data.id_card, data.company,
          data.visit_purpose, data.visit_date, data.start_time,
          data.end_time, data.host_name, data.host_phone,
          data.host_department, status, data.license_plate,
          createdBy, now, now
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  async getVisitor(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM visitors WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else resolve({
            ...row,
            phone: maskPhone(row.phone),
            host_phone: row.host_phone ? maskPhone(row.host_phone) : null
          });
        }
      );
    });
  }

  async updateVisitorStatus(id, status, updatedBy) {
    const now = moment().format();
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE visitors SET status = ?, updated_at = ? WHERE id = ?`,
        [status, now, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status, updatedBy });
        }
      );
    });
  }

  async approveVisitor(id, approver) {
    return this.updateVisitorStatus(id, 'approved', approver);
  }

  async rejectVisitor(id, rejector) {
    return this.updateVisitorStatus(id, 'rejected', rejector);
  }

  async getVisitors(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM visitors WHERE 1=1`;
      let params = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.visitDate) {
        query += ` AND visit_date = ?`;
        params.push(filters.visitDate);
      }

      if (filters.hostName) {
        query += ` AND host_name LIKE ?`;
        params.push(`%${filters.hostName}%`);
      }

      query += ` ORDER BY created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          const masked = rows.map(r => ({
            ...r,
            phone: maskPhone(r.phone),
            host_phone: r.host_phone ? maskPhone(r.host_phone) : null
          }));
          resolve(masked);
        }
      });
    });
  }

  async createTemporaryPlate(data, createdBy) {
    const id = uuidv4();
    const now = moment().format();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO temporary_plates (
          id, plate_number, visitor_id, vehicle_type, driver_name,
          driver_phone, valid_from, valid_to, status, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.plate_number, data.visitor_id, data.vehicle_type,
          data.driver_name, data.driver_phone, data.valid_from,
          data.valid_to, 'active', createdBy, now, now
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  async getTemporaryPlates(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM temporary_plates WHERE 1=1`;
      let params = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.plateNumber) {
        query += ` AND plate_number LIKE ?`;
        params.push(`%${filters.plateNumber}%`);
      }

      query += ` ORDER BY created_at DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          const masked = rows.map(r => ({
            ...r,
            driver_phone: r.driver_phone ? maskPhone(r.driver_phone) : null
          }));
          resolve(masked);
        }
      });
    });
  }

  async addToBlacklist(data, addedBy) {
    const id = uuidv4();
    const now = moment().format();

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO blacklist (
          id, type, identifier, name, reason, added_by, added_at,
          expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.type, data.identifier, data.name,
          data.reason, addedBy, now, data.expires_at, 'active'
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  async removeFromBlacklist(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE blacklist SET status = 'inactive' WHERE id = ?`,
        [id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: 'inactive' });
        }
      );
    });
  }

  async getBlacklist(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM blacklist WHERE 1=1`;
      let params = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.type) {
        query += ` AND type = ?`;
        params.push(filters.type);
      }

      query += ` ORDER BY added_at DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new VisitorService();
