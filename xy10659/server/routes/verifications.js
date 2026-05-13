const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, keyword, handler, has_exception } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `SELECT v.*, vm.plate_number, vm.vehicle_model, po.customer_name, mi.item_name 
               FROM verification_records v 
               LEFT JOIN vehicle_mileage vm ON v.vehicle_id = vm.id 
               LEFT JOIN package_orders po ON v.order_id = po.id 
               LEFT JOIN maintenance_items mi ON v.item_id = mi.id 
               WHERE 1=1`;
  let countQuery = 'SELECT COUNT(*) as total FROM verification_records WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (v.verification_no LIKE ? OR vm.plate_number LIKE ?)';
    countQuery += ' AND EXISTS (SELECT 1 FROM vehicle_mileage WHERE id = verification_records.vehicle_id AND (plate_number LIKE ?))';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  if (handler) {
    query += ' AND v.handler = ?';
    countQuery += ' AND handler = ?';
    params.push(handler);
  }
  
  if (has_exception === 'true') {
    query += ' AND v.exception_reason IS NOT NULL';
    countQuery += ' AND exception_reason IS NOT NULL';
  }
  
  query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (keyword ? 3 : 0) - (handler ? 1 : 0) - (has_exception ? 0 : 0)), (err, countResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.all(query, [...params, parseInt(pageSize), offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: rows, total: countResult.total });
    });
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM verification_records WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { order_id, vehicle_id, item_id, actual_mileage, handler, remarks } = req.body;
  const verification_no = `VER${Date.now()}`;
  const mileage_at = moment().format('YYYY-MM-DD');
  
  db.get('SELECT * FROM maintenance_items WHERE id = ?', [item_id], (err, item) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.get('SELECT * FROM vehicle_mileage WHERE id = ?', [vehicle_id], (err, vehicle) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      let supplement_amount = 0;
      let exception_reason = null;
      
      const last_mileage = vehicle.last_maintenance_date ? vehicle.current_mileage - 5000 : vehicle.current_mileage;
      const mileage_diff = actual_mileage - last_mileage;
      const mileage_over_percent = ((mileage_diff - item.standard_mileage) / item.standard_mileage) * 100;
      
      if (mileage_over_percent > 10) {
        supplement_amount = 50;
        exception_reason = `超里程${mileage_over_percent.toFixed(1)}%`;
      }
      
      const total_amount = item.price + supplement_amount;
      
      db.run(
        'INSERT INTO verification_records (verification_no, order_id, vehicle_id, item_id, mileage_at, actual_mileage, supplement_amount, total_amount, handler, remarks, exception_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [verification_no, order_id, vehicle_id, item_id, mileage_at, actual_mileage, supplement_amount, total_amount, handler, remarks, exception_reason],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const reminder_mileage = actual_mileage + item.standard_mileage;
          const reminder_date = moment().add(item.standard_days, 'days').format('YYYY-MM-DD');
          
          db.run(
            'INSERT INTO next_reminders (vehicle_id, item_id, reminder_mileage, reminder_date) VALUES (?, ?, ?, ?)',
            [vehicle_id, item_id, reminder_mileage, reminder_date],
            (remErr) => {
              if (remErr) {
                console.error('创建提醒失败:', remErr);
              }
              
              if (exception_reason) {
                const exception_no = `EXC${Date.now()}`;
                db.run(
                  'INSERT INTO exceptions (exception_no, related_id, related_type, exception_type, exception_reason, handler, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                  [exception_no, this.lastID, 'verification', 'mileage_over', exception_reason, handler, vehicle.current_mileage, actual_mileage],
                  (excErr) => {
                    if (excErr) {
                      console.error('创建异常记录失败:', excErr);
                    }
                  }
                );
              }
              
              db.get('SELECT * FROM package_orders WHERE id = ?', [order_id], (err, order) => {
                if (order && order.remaining_times > 0) {
                  db.run(
                    'UPDATE package_orders SET remaining_times = ?, used_times = ? WHERE id = ?',
                    [order.remaining_times - 1, order.used_times + 1, order_id]
                  );
                }
              });
              
              db.run(
                'UPDATE vehicle_mileage SET current_mileage = ?, last_maintenance_date = ?, next_maintenance_mileage = ? WHERE id = ?',
                [actual_mileage, mileage_at, reminder_mileage, vehicle_id]
              );
            }
          );
          
          res.status(201).json({ id: this.lastID, verification_no, total_amount, exception_reason });
        }
      );
    });
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM verification_records WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
