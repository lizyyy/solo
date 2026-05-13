const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, keyword, responsible_person } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM vehicle_mileage WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM vehicle_mileage WHERE 1=1';
  const params = [];
  
  if (keyword) {
    query += ' AND (plate_number LIKE ? OR vehicle_model LIKE ?)';
    countQuery += ' AND (plate_number LIKE ? OR vehicle_model LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  if (responsible_person) {
    query += ' AND responsible_person = ?';
    countQuery += ' AND responsible_person = ?';
    params.push(responsible_person);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (keyword ? 2 : 0) - (responsible_person ? 1 : 0)), (err, countResult) => {
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
  db.get('SELECT * FROM vehicle_mileage WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.get('/:id/logs', (req, res) => {
  db.all('SELECT * FROM vehicle_mileage_log WHERE vehicle_id = ? ORDER BY modified_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person, modified_by } = req.body;
  
  db.run(
    'INSERT INTO vehicle_mileage (plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person) VALUES (?, ?, ?, ?, ?, ?)',
    [plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.put('/:id', (req, res) => {
  const { plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person, modified_by } = req.body;
  const vehicleId = req.params.id;
  
  db.get('SELECT * FROM vehicle_mileage WHERE id = ?', [vehicleId], (err, oldVehicle) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.run(
      'UPDATE vehicle_mileage SET plate_number = ?, vehicle_model = ?, current_mileage = ?, last_maintenance_date = ?, next_maintenance_mileage = ?, responsible_person = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [plate_number, vehicle_model, current_mileage, last_maintenance_date, next_maintenance_mileage, responsible_person, vehicleId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.run(
          'INSERT INTO vehicle_mileage_log (vehicle_id, old_value, new_value, modified_by) VALUES (?, ?, ?, ?)',
          [vehicleId, JSON.stringify(oldVehicle), JSON.stringify(req.body), modified_by || 'system'],
          (logErr) => {
            if (logErr) {
              console.error('记录日志失败:', logErr);
            }
            res.json({ updated: this.changes });
          }
        );
      }
    );
  });
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM vehicle_mileage WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
