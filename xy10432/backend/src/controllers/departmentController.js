const db = require('../config/database');

const departmentController = {
  getAllDepartments: (req, res) => {
    const sql = 'SELECT * FROM departments ORDER BY name';
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getDepartmentById: (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM departments WHERE id = ?';
    db.get(sql, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json(row);
    });
  },

  createDepartment: (req, res) => {
    const { name, description, daily_capacity } = req.body;
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const sql = 'INSERT INTO departments (id, name, description, daily_capacity, current_usage) VALUES (?, ?, ?, ?, 0)';
    db.run(sql, [id, name, description, daily_capacity], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, description, daily_capacity, current_usage: 0 });
    });
  },

  updateDepartment: (req, res) => {
    const { id } = req.params;
    const { name, description, daily_capacity } = req.body;
    const sql = 'UPDATE departments SET name = ?, description = ?, daily_capacity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [name, description, daily_capacity, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.json({ id, name, description, daily_capacity });
    });
  },

  getDailyDepartmentUsage: (req, res) => {
    const { date } = req.query;
    const today = date || new Date().toISOString().split('T')[0];
    
    const sql = `
      SELECT 
        d.id AS department_id,
        d.name AS department_name,
        d.daily_capacity,
        COUNT(ai.id) AS usage_count,
        (d.daily_capacity - COUNT(ai.id)) AS remaining_capacity
      FROM departments d
      LEFT JOIN items i ON d.id = i.department_id
      LEFT JOIN appointment_items ai ON i.id = ai.item_id
      LEFT JOIN appointments a ON ai.appointment_id = a.id
      WHERE DATE(a.appointment_date) = ? OR a.appointment_date IS NULL
      GROUP BY d.id
      ORDER BY d.name
    `;
    
    db.all(sql, [today], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  }
};

module.exports = departmentController;
