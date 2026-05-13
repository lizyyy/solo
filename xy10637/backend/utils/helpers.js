const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../config/database');

const generateId = () => uuidv4();

const formatDate = (date) => moment(date).format('YYYY-MM-DD');

const formatDateTime = (date) => moment(date).format('YYYY-MM-DD HH:mm:ss');

const addTimeLine = (relatedType, relatedId, action, description, oldValue = null, newValue = null, operator = 'system') => {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const sql = `INSERT INTO time_lines (id, related_type, related_id, action, old_value, new_value, description, operator, operation_time)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [id, relatedType, relatedId, action, JSON.stringify(oldValue), JSON.stringify(newValue), description, operator, formatDateTime(new Date())], (err) => {
      if (err) reject(err);
      else resolve(id);
    });
  });
};

const addAuditLog = (tableName, recordId, operation, oldData = null, newData = null, operator = 'system') => {
  return new Promise((resolve, reject) => {
    const id = generateId();
    const sql = `INSERT INTO audit_logs (id, table_name, record_id, operation, old_data, new_data, operator, operation_time)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [id, tableName, recordId, operation, JSON.stringify(oldData), JSON.stringify(newData), operator, formatDateTime(new Date())], (err) => {
      if (err) reject(err);
      else resolve(id);
    });
  });
};

const getShiftHours = (shiftType) => {
  const shifts = {
    'morning': { start: '08:00', end: '16:00', hours: 8 },
    'afternoon': { start: '16:00', end: '00:00', hours: 8 },
    'night': { start: '00:00', end: '08:00', hours: 8 },
    'day': { start: '08:00', end: '20:00', hours: 12 },
    'night_full': { start: '20:00', end: '08:00', hours: 12 }
  };
  return shifts[shiftType] || shifts['morning'];
};

const checkQualificationMatch = (caregiverQuals, requiredQuals) => {
  if (!requiredQuals || requiredQuals.length === 0) return true;
  if (!caregiverQuals) return false;
  const caregiverList = Array.isArray(caregiverQuals) ? caregiverQuals : JSON.parse(caregiverQuals || '[]');
  const requiredList = Array.isArray(requiredQuals) ? requiredQuals : JSON.parse(requiredQuals || '[]');
  return requiredList.every(req => caregiverList.includes(req));
};

const calculateConsecutiveHours = async (caregiverId, date, db) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT start_time, end_time FROM schedules 
                  WHERE caregiver_id = ? AND date <= ? AND status IN ('scheduled', 'completed')
                  ORDER BY date DESC, start_time DESC LIMIT 10`;
    db.all(sql, [caregiverId, date], (err, rows) => {
      if (err) reject(err);
      else {
        let consecutiveHours = 0;
        let lastEndTime = null;
        rows.forEach(row => {
          if (lastEndTime && moment(row.start_time).isAfter(lastEndTime)) {
            return;
          }
          consecutiveHours += moment(row.end_time).diff(moment(row.start_time), 'hours');
          lastEndTime = moment(row.end_time);
        });
        resolve(consecutiveHours);
      }
    });
  });
};

module.exports = {
  generateId,
  formatDate,
  formatDateTime,
  addTimeLine,
  addAuditLog,
  getShiftHours,
  checkQualificationMatch,
  calculateConsecutiveHours
};