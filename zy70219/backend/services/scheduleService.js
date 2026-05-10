const db = require('../config/db');
const historyService = require('./historyService');

const cleaningStatuses = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed'
};

const fireInspectionStatuses = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  PASSED: 'passed',
  FAILED: 'failed',
  MISSED: 'missed'
};

function createCleaningWindow(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO cleaning_windows (kitchen_id, start_time, end_time, operator, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.kitchen_id,
        data.start_time,
        data.end_time,
        data.operator || '',
        cleaningStatuses.SCHEDULED
      ],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.CLEANING_WINDOW,
            this.lastID,
            historyService.actions.CREATE,
            null,
            { ...data, status: cleaningStatuses.SCHEDULED }
          );
          resolve(this.lastID);
        }
      }
    );
  });
}

function getCleaningWindows(kitchenId = null) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT cw.*, k.name as kitchen_name
               FROM cleaning_windows cw
               JOIN kitchens k ON cw.kitchen_id = k.id`;
    const params = [];
    
    if (kitchenId) {
      sql += ` WHERE cw.kitchen_id = ?`;
      params.push(kitchenId);
    }
    sql += ` ORDER BY cw.start_time`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateCleaningWindowStatus(id, status, operator = 'system') {
  return new Promise(async (resolve, reject) => {
    const window = await new Promise((res, rej) => {
      db.get(`SELECT * FROM cleaning_windows WHERE id = ?`, [id], (err, row) => {
        if (err) rej(err); else res(row);
      });
    });
    
    if (!window) {
      reject(new Error('清洁窗口记录不存在'));
      return;
    }
    
    db.run(
      `UPDATE cleaning_windows SET status = ? WHERE id = ?`,
      [status, id],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.CLEANING_WINDOW,
            id,
            historyService.actions.STATUS_CHANGE,
            { status: window.status },
            { status }
          );
          resolve(true);
        }
      }
    );
  });
}

function createFireInspection(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO fire_inspections (kitchen_id, scheduled_time, inspector, status)
       VALUES (?, ?, ?, ?)`,
      [
        data.kitchen_id,
        data.scheduled_time,
        data.inspector || '',
        fireInspectionStatuses.SCHEDULED
      ],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.FIRE_INSPECTION,
            this.lastID,
            historyService.actions.CREATE,
            null,
            { ...data, status: fireInspectionStatuses.SCHEDULED }
          );
          resolve(this.lastID);
        }
      }
    );
  });
}

function getFireInspections(kitchenId = null) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT fi.*, k.name as kitchen_name
               FROM fire_inspections fi
               JOIN kitchens k ON fi.kitchen_id = k.id`;
    const params = [];
    
    if (kitchenId) {
      sql += ` WHERE fi.kitchen_id = ?`;
      params.push(kitchenId);
    }
    sql += ` ORDER BY fi.scheduled_time`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateFireInspectionStatus(id, status, result = '', operator = 'system') {
  return new Promise(async (resolve, reject) => {
    const inspection = await new Promise((res, rej) => {
      db.get(`SELECT * FROM fire_inspections WHERE id = ?`, [id], (err, row) => {
        if (err) rej(err); else res(row);
      });
    });
    
    if (!inspection) {
      reject(new Error('消防检查记录不存在'));
      return;
    }
    
    const updates = { status };
    if (result) {
      updates.result = result;
    }
    
    db.run(
      `UPDATE fire_inspections SET status = ?, result = ? WHERE id = ?`,
      [status, result, id],
      async function(err) {
        if (err) reject(err);
        else {
          await historyService.logHistory(
            historyService.entityTypes.FIRE_INSPECTION,
            id,
            historyService.actions.STATUS_CHANGE,
            { status: inspection.status, result: inspection.result },
            { status, result }
          );
          resolve(true);
        }
      }
    );
  });
}

function getKitchens() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM kitchens ORDER BY name`,
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

function getTeams() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM teams ORDER BY name`,
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });
}

function createKitchen(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO kitchens (name, location, capacity, status)
       VALUES (?, ?, ?, ?)`,
      [data.name, data.location || '', data.capacity || 3, 'active'],
      (err) => { if (err) reject(err); else resolve(this.lastID); }
    );
  });
}

function createTeam(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO teams (name, contact)
       VALUES (?, ?)`,
      [data.name, data.contact || ''],
      (err) => { if (err) reject(err); else resolve(this.lastID); }
    );
  });
}

module.exports = {
  cleaningStatuses,
  fireInspectionStatuses,
  createCleaningWindow,
  getCleaningWindows,
  updateCleaningWindowStatus,
  createFireInspection,
  getFireInspections,
  updateFireInspectionStatus,
  getKitchens,
  getTeams,
  createKitchen,
  createTeam
};
