const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const appointmentController = {
  getAllAppointments: (req, res) => {
    const { date, customer_id } = req.query;
    let sql = `
      SELECT a.*, c.name AS customer_name, c.type AS customer_type, c.company_name, p.name AS package_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN packages p ON a.package_id = p.id
    `;
    const params = [];
    
    const conditions = [];
    if (date) {
      conditions.push('DATE(a.appointment_date) = ?');
      params.push(date);
    }
    if (customer_id) {
      conditions.push('a.customer_id = ?');
      params.push(customer_id);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY a.appointment_date DESC, a.created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  getAppointmentById: (req, res) => {
    const { id } = req.params;
    
    const appointmentSql = `
      SELECT a.*, c.name AS customer_name, c.phone, c.id_card, c.type AS customer_type, c.company_name, p.name AS package_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN packages p ON a.package_id = p.id
      WHERE a.id = ?
    `;
    
    const itemsSql = `
      SELECT ai.*, i.name AS item_name, i.department_id, d.name AS department_name, i.price AS original_price
      FROM appointment_items ai
      LEFT JOIN items i ON ai.item_id = i.id
      LEFT JOIN departments d ON i.department_id = d.id
      WHERE ai.appointment_id = ?
      ORDER BY ai.created_at
    `;
    
    const transactionsSql = `
      SELECT * FROM transactions 
      WHERE appointment_id = ? 
      ORDER BY created_at DESC
    `;
    
    const recordsSql = `
      SELECT arr.*, i.name AS item_name
      FROM add_remove_records arr
      LEFT JOIN items i ON arr.item_id = i.id
      WHERE arr.appointment_id = ?
      ORDER BY arr.created_at DESC
    `;
    
    db.get(appointmentSql, [id], (err, appointment) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      db.all(itemsSql, [id], (err, items) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.all(transactionsSql, [id], (err, transactions) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          db.all(recordsSql, [id], (err, addRemoveRecords) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({
              ...appointment,
              items,
              transactions,
              addRemoveRecords
            });
          });
        });
      });
    });
  },

  createAppointment: (req, res) => {
    const { customer_id, package_id, appointment_date, paid_amount } = req.body;
    
    const getPackageSql = 'SELECT * FROM packages WHERE id = ?';
    const getPackageItemsSql = 'SELECT item_id FROM package_items WHERE package_id = ?';
    
    db.get(getPackageSql, [package_id], (err, pkg) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      db.all(getPackageItemsSql, [package_id], (err, packageItems) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const appointmentId = uuidv4();
        const totalAmount = pkg.base_price;
        const paid = paid_amount || 0;
        
        const insertAppointmentSql = `
          INSERT INTO appointments (id, customer_id, package_id, appointment_date, status, total_amount, paid_amount)
          VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `;
        
        db.run(insertAppointmentSql, [appointmentId, customer_id, package_id, appointment_date, totalAmount, paid], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const getItemSql = 'SELECT price FROM items WHERE id = ?';
          const insertItemSql = `
            INSERT INTO appointment_items (id, appointment_id, item_id, item_type, price, status, report_issued)
            VALUES (?, ?, ?, 'package', ?, 'pending', 0)
          `;
          
          const itemPromises = packageItems.map(pkgItem => {
            return new Promise((resolve, reject) => {
              db.get(getItemSql, [pkgItem.item_id], (err, item) => {
                if (err) reject(err);
                const itemId = uuidv4();
                db.run(insertItemSql, [itemId, appointmentId, pkgItem.item_id, item.price], function(err) {
                  if (err) reject(err);
                  resolve();
                });
              });
            });
          });
          
          Promise.all(itemPromises)
            .then(() => {
              if (paid > 0) {
                const transactionId = uuidv4();
                const insertTransactionSql = `
                  INSERT INTO transactions (id, appointment_id, type, amount, description)
                  VALUES (?, ?, 'initial_payment', ?, '套餐费用')
                `;
                db.run(insertTransactionSql, [transactionId, appointmentId, paid], function(err) {
                  if (err) {
                    console.error('Error creating transaction:', err);
                  }
                });
              }
              
              res.status(201).json({
                id: appointmentId,
                customer_id,
                package_id,
                appointment_date,
                total_amount: totalAmount,
                paid_amount: paid
              });
            })
            .catch(err => res.status(500).json({ error: err.message }));
        });
      });
    });
  },

  updateAppointmentStatus: (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const sql = 'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    db.run(sql, [status, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      res.json({ id, status });
    });
  }
};

module.exports = appointmentController;
