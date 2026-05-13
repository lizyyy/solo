const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class TeamController {
  static async create(req, res) {
    const { name, leader, phone } = req.body;

    db.run(
      `INSERT INTO teams (id, name, leader, phone) VALUES (?, ?, ?, ?)`,
      [uuidv4(), name, leader, phone],
      (err) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, message: '班组创建成功' });
      }
    );
  }

  static async list(req, res) {
    db.all(`SELECT * FROM teams ORDER BY created_at DESC`, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, data: rows });
    });
  }
}

module.exports = TeamController;