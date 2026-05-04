const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  const status = req.query.status;
  let query = 'SELECT * FROM collection_sites';
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
  db.get('SELECT * FROM collection_sites WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '采集地点不存在' });
    }
    
    db.all(`
      SELECT sb.*, ns.common_name, ns.scientific_name
      FROM seed_batches sb
      LEFT JOIN native_species ns ON sb.species_id = ns.id
      WHERE sb.collection_site_id = ?
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

router.get('/code/:siteCode', (req, res) => {
  db.get('SELECT * FROM collection_sites WHERE site_code = ?', [req.params.siteCode], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '采集地点不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    site_code,
    site_name,
    location,
    latitude,
    longitude,
    habitat,
    elevation,
    description,
    status
  } = req.body;

  if (!site_code || !site_name || !location) {
    return res.status(400).json({ error: '地点编码、名称和位置为必填项' });
  }

  const stmt = db.prepare(`
    INSERT INTO collection_sites (
      site_code, site_name, location, latitude, longitude,
      habitat, elevation, description, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    site_code,
    site_name,
    location,
    latitude || null,
    longitude || null,
    habitat || null,
    elevation || null,
    description || null,
    status || '活跃',
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '地点编码已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        message: '采集地点创建成功'
      });
    }
  );
  stmt.finalize();
});

router.put('/:id', (req, res) => {
  const {
    site_code,
    site_name,
    location,
    latitude,
    longitude,
    habitat,
    elevation,
    description,
    status
  } = req.body;

  db.get('SELECT * FROM collection_sites WHERE id = ?', [req.params.id], (err, existingSite) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingSite) {
      return res.status(404).json({ error: '采集地点不存在' });
    }

    const stmt = db.prepare(`
      UPDATE collection_sites 
      SET site_code = ?, site_name = ?, location = ?, latitude = ?, longitude = ?,
          habitat = ?, elevation = ?, description = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(
      site_code || existingSite.site_code,
      site_name || existingSite.site_name,
      location || existingSite.location,
      latitude !== undefined ? latitude : existingSite.latitude,
      longitude !== undefined ? longitude : existingSite.longitude,
      habitat !== undefined ? habitat : existingSite.habitat,
      elevation !== undefined ? elevation : existingSite.elevation,
      description !== undefined ? description : existingSite.description,
      status || existingSite.status,
      req.params.id,
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '地点编码已存在' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: '采集地点更新成功' });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM seed_batches WHERE collection_site_id = ?', [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (result.count > 0) {
      return res.status(400).json({ 
        error: '该采集地点有关联的种子批次，无法删除',
        associated_batches: result.count
      });
    }

    db.run('DELETE FROM collection_sites WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '采集地点不存在' });
      }
      res.json({ message: '采集地点删除成功' });
    });
  });
});

module.exports = router;
