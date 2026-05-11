const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const utils = require('../utils');

function createMember(name, phone) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO members (id, name, phone) VALUES (?, ?, ?)',
      [id, name, phone],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed: members.phone')) {
            reject(new Error('手机号码已存在'));
          } else {
            reject(err);
          }
        } else {
          resolve({ id, name, phone, current_tier: '普通会员' });
        }
      }
    );
  });
}

function getMember(memberId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getMemberByPhone(phone) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM members WHERE phone = ?', [phone], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function listMembers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM members ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  createMember,
  getMember,
  getMemberByPhone,
  listMembers
};
