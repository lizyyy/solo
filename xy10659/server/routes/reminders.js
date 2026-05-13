const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const { page = 1, pageSize = 10, status } = req.query;
  const offset = (page - 1) * pageSize;
  
  let query = `SELECT nr.*, vm.plate_number, vm.vehicle_model, mi.item_name 
               FROM next_reminders nr 
               LEFT JOIN vehicle_mileage vm ON nr.vehicle_id = vm.id 
               LEFT JOIN maintenance_items mi ON nr.item_id = mi.id 
               WHERE 1=1`;
  let countQuery = 'SELECT COUNT(*) as total FROM next_reminders WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND nr.status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY nr.reminder_date ASC LIMIT ? OFFSET ?';
  
  db.get(countQuery, params.slice(0, params.length - (status ? 1 : 0)), (err, countResult) => {
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
  db.get('SELECT * FROM next_reminders WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row);
  });
});

router.put('/:id/status', (req, res) => {
  const { status } = req.body;
  
  db.run(
    'UPDATE next_reminders SET status = ? WHERE id = ?',
    [status, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ updated: this.changes });
    }
  );
});

module.exports = router;
