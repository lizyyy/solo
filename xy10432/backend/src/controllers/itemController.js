const db = require('../config/database');

const itemController = {
  getAllItems: (req, res) => {
    const sql = `
      SELECT i.*, d.name AS department_name 
      FROM items i 
      LEFT JOIN departments d ON i.department_id = d.id 
      ORDER BY i.name
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getItemById: (req, res) => {
    const { id } = req.params;
    const sql = `
      SELECT i.*, d.name AS department_name 
      FROM items i 
      LEFT JOIN departments d ON i.department_id = d.id 
      WHERE i.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json(row);
    });
  },

  createItem: (req, res) => {
    const { name, description, price, department_id, is_addable } = req.body;
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const sql = 'INSERT INTO items (id, name, description, price, department_id, is_addable) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sql, [id, name, description, price, department_id, is_addable], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, description, price, department_id, is_addable });
    });
  },

  updateItem: (req, res) => {
    const { id } = req.params;
    const { name, description, price, department_id, is_addable } = req.body;
    const sql = 'UPDATE items SET name = ?, description = ?, price = ?, department_id = ?, is_addable = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [name, description, price, department_id, is_addable, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json({ id, name, description, price, department_id, is_addable });
    });
  },

  getAddableItems: (req, res) => {
    const sql = `
      SELECT i.*, d.name AS department_name 
      FROM items i 
      LEFT JOIN departments d ON i.department_id = d.id 
      WHERE i.is_addable = 1 
      ORDER BY i.name
    `;
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  }
};

module.exports = itemController;
