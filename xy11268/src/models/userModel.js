const db = require('../config/database');

function createUser(userData) {
  return new Promise((resolve, reject) => {
    const { name, role } = userData;
    db.run(
      `INSERT INTO users (name, role) VALUES (?, ?)`,
      [name, role || 'agent'],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, name, role: role || 'agent' });
      }
    );
  });
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getUserByName(name) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE name = ?`, [name], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAllUsers() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users ORDER BY name`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  createUser,
  getUserById,
  getUserByName,
  getAllUsers
};
