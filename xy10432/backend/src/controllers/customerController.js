const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const customerController = {
  getAllCustomers: (req, res) => {
    const { type } = req.query;
    let sql = 'SELECT * FROM customers';
    const params = [];
    
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getCustomerById: (req, res) => {
    const { id } = req.params;
    const customerSql = 'SELECT * FROM customers WHERE id = ?';
    const appointmentsSql = `
      SELECT a.*, p.name AS package_name
      FROM appointments a
      LEFT JOIN packages p ON a.package_id = p.id
      WHERE a.customer_id = ?
      ORDER BY a.appointment_date DESC
    `;
    
    db.get(customerSql, [id], (err, customer) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      db.all(appointmentsSql, [id], (err, appointments) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ ...customer, appointments });
      });
    });
  },

  createCustomer: (req, res) => {
    const { name, phone, id_card, type, company_name } = req.body;
    const id = uuidv4();
    
    const sql = 'INSERT INTO customers (id, name, phone, id_card, type, company_name) VALUES (?, ?, ?, ?, ?, ?)';
    db.run(sql, [id, name, phone, id_card, type || 'personal', company_name], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, phone, id_card, type, company_name });
    });
  },

  updateCustomer: (req, res) => {
    const { id } = req.params;
    const { name, phone, id_card, type, company_name } = req.body;
    
    const sql = 'UPDATE customers SET name = ?, phone = ?, id_card = ?, type = ?, company_name = ? WHERE id = ?';
    db.run(sql, [name, phone, id_card, type, company_name, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json({ id, name, phone, id_card, type, company_name });
    });
  }
};

module.exports = customerController;
