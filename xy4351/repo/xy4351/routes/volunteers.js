const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const status = req.query.status;
  let query = 'SELECT * FROM volunteers';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '志愿者不存在' });
    }
    
    db.all(`
      SELECT sb.*, ns.common_name, ns.scientific_name, cs.site_name
      FROM seed_batches sb
      LEFT JOIN native_species ns ON sb.species_id = ns.id
      LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
      WHERE sb.volunteer_id = ?
      ORDER BY sb.collection_date DESC
    `, [req.params.id], (err, batches) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      row.seed_batches = batches;
      res.json(row);
    });
  });
});

router.post('/', (req, res) => {
  const { name, role, contact, status } = req.body;

  if (!name) {
    return res.status(400).json({ error: '姓名为必填项' });
  }

  const stmt = db.prepare(`
    INSERT INTO volunteers (name, role, contact, status)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(
    name,
    role || '采集志愿者',
    contact || null,
    status || '活跃',
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '志愿者创建成功'
      });
    }
  );
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const { name, role, contact, status } = req.body;

  db.get('SELECT * FROM volunteers WHERE id = ?', [req.params.id], (err, existingVolunteer) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingVolunteer) {
      return res.status(404).json({ error: '志愿者不存在' });
    }

    const stmt = db.prepare(`
      UPDATE volunteers 
      SET name = ?, role = ?, contact = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(
      name || existingVolunteer.name,
      role || existingVolunteer.role,
      contact !== undefined ? contact : existingVolunteer.contact,
      status || existingVolunteer.status,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: '志愿者更新成功' });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM seed_batches WHERE volunteer_id = ?', [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (result.count > 0) {
      return res.status(400).json({ 
        error: '该志愿者有关联的种子批次，无法删除',
        associated_batches: result.count
      });
    }

    db.run('DELETE FROM volunteers WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '志愿者不存在' });
      }
      res.json({ message: '志愿者删除成功' });
    });
  });
});

module.exports = router;
