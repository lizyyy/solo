const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const createMember = async (data) => {
  return new Promise((resolve, reject) => {
    const { name, phone, gender, birthday, remark } = data;
    const id = uuidv4();
    
    const sql = `
      INSERT INTO members (id, name, phone, gender, birthday, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;
    
    db.run(sql, [id, name, phone, gender, birthday, remark], function(err) {
      if (err) reject(err);
      else resolve({ id, ...data, status: 'active' });
    });
  });
};

const getMember = async (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllMembers = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM members ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createCoach = async (data) => {
  return new Promise((resolve, reject) => {
    const { name, phone, gender, specialty, remark } = data;
    const id = uuidv4();
    
    const sql = `
      INSERT INTO coaches (id, name, phone, gender, specialty, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;
    
    db.run(sql, [id, name, phone, gender, specialty, remark], function(err) {
      if (err) reject(err);
      else resolve({ id, ...data, status: 'active' });
    });
  });
};

const getCoach = async (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM coaches WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllCoaches = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM coaches ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createCoursePackage = async (data) => {
  return new Promise((resolve, reject) => {
    const { name, total_lessons, price, valid_days, description } = data;
    const id = uuidv4();
    
    const sql = `
      INSERT INTO course_packages (id, name, total_lessons, price, valid_days, description, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;
    
    db.run(sql, [id, name, total_lessons, price, valid_days, description], function(err) {
      if (err) reject(err);
      else resolve({ id, ...data, status: 'active' });
    });
  });
};

const getCoursePackage = async (id) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM course_packages WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getAllCoursePackages = async () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM course_packages ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  createMember,
  getMember,
  getAllMembers,
  createCoach,
  getCoach,
  getAllCoaches,
  createCoursePackage,
  getCoursePackage,
  getAllCoursePackages
};
