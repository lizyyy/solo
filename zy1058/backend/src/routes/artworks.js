const express = require('express');
const router = express.Router();
const db = require('../config/database');
const StatusService = require('../services/statusService');

router.get('/', (req, res) => {
  const { status, customer_id, clay_id, glaze_id, delivery_date_from, delivery_date_to } = req.query;
  
  let query = `
    SELECT a.*,
      c.name as customer_name, c.phone as customer_phone,
      cl.name as clay_name, cl.temp_min as clay_temp_min, cl.temp_max as clay_temp_max,
      g1.name as glaze_name, g1.temp_min as glaze_temp_min, g1.temp_max as glaze_temp_max, g1.incompatible_glazes,
      g2.name as glaze2_name,
      ft.name as current_firing_task_name
    FROM artworks a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN clays cl ON a.clay_id = cl.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
    LEFT JOIN firing_tasks ft ON a.current_firing_task_id = ft.id
  `;
  
  const conditions = [];
  const params = [];
  
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (customer_id) {
    conditions.push('a.customer_id = ?');
    params.push(parseInt(customer_id));
  }
  if (clay_id) {
    conditions.push('a.clay_id = ?');
    params.push(parseInt(clay_id));
  }
  if (glaze_id) {
    conditions.push('(a.glaze_id = ? OR a.glaze2_id = ?)');
    params.push(parseInt(glaze_id), parseInt(glaze_id));
  }
  if (delivery_date_from) {
    conditions.push('a.delivery_date >= ?');
    params.push(delivery_date_from);
  }
  if (delivery_date_to) {
    conditions.push('a.delivery_date <= ?');
    params.push(delivery_date_to);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY a.delivery_date ASC, a.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const artworks = rows.map(row => ({
      ...row,
      status_info: StatusService.getStatusInfo(row.status)
    }));
    
    res.json(artworks);
  });
});

router.get('/status-flow', (req, res) => {
  res.json(StatusService.getStatusFlow());
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT a.*,
      c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
      cl.name as clay_name, cl.type as clay_type, cl.temp_min as clay_temp_min, cl.temp_max as clay_temp_max, cl.cone as clay_cone,
      g1.name as glaze_name, g1.type as glaze_type, g1.temp_min as glaze_temp_min, g1.temp_max as glaze_temp_max, g1.cone as glaze_cone, g1.incompatible_glazes,
      g2.name as glaze2_name,
      ft.name as current_firing_task_name, ft.status as current_firing_task_status
    FROM artworks a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN clays cl ON a.clay_id = cl.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
    LEFT JOIN firing_tasks ft ON a.current_firing_task_id = ft.id
    WHERE a.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '作品不存在' });
      return;
    }
    
    res.json({
      ...row,
      status_info: StatusService.getStatusInfo(row.status)
    });
  });
});

router.post('/', (req, res) => {
  const { 
    name, customer_id, clay_id, glaze_id, glaze2_id,
    width, height, depth, weight, delivery_date, notes
  } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '作品名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO artworks (
      name, customer_id, clay_id, glaze_id, glaze2_id,
      width, height, depth, weight, delivery_date, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `;
  
  db.run(query, [
    name, customer_id || null, clay_id || null, glaze_id || null, glaze2_id || null,
    width, height, depth, weight, delivery_date, notes
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const newId = this.lastID;
    
    db.run(
      `INSERT INTO status_history (artwork_id, from_status, to_status, notes) VALUES (?, NULL, 'pending', '作品创建')`,
      [newId],
      (historyErr) => {
        if (historyErr) {
          console.warn('创建状态历史失败:', historyErr.message);
        }
        
        res.status(201).json({
          id: newId,
          name,
          customer_id,
          clay_id,
          glaze_id,
          glaze2_id,
          width,
          height,
          depth,
          weight,
          delivery_date,
          status: 'pending',
          status_info: StatusService.getStatusInfo('pending'),
          notes,
          created_at: new Date().toISOString()
        });
      }
    );
  });
});

router.put('/:id', (req, res) => {
  const { 
    name, customer_id, clay_id, glaze_id, glaze2_id,
    width, height, depth, weight, delivery_date, notes
  } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '作品名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE artworks 
    SET name = ?, customer_id = ?, clay_id = ?, glaze_id = ?, glaze2_id = ?,
        width = ?, height = ?, depth = ?, weight = ?, delivery_date = ?, 
        notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [
    name, customer_id || null, clay_id || null, glaze_id || null, glaze2_id || null,
    width, height, depth, weight, delivery_date, notes,
    req.params.id
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '作品不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      customer_id,
      clay_id,
      glaze_id,
      glaze2_id,
      width,
      height,
      depth,
      weight,
      delivery_date,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.patch('/:id/status', async (req, res) => {
  const { to_status, notes } = req.body;
  
  if (!to_status) {
    res.status(400).json({ error: '目标状态不能为空' });
    return;
  }
  
  try {
    const result = await StatusService.transitionArtworkStatus(
      parseInt(req.params.id),
      to_status,
      notes
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await StatusService.getArtworkStatusHistory(parseInt(req.params.id));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const checkQuery = 'SELECT COUNT(*) as count FROM task_artworks WHERE artwork_id = ?';
  
  db.get(checkQuery, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row.count > 0) {
      res.status(400).json({ error: `该作品已分配到 ${row.count} 个烧窑任务中，无法删除` });
      return;
    }
    
    db.serialize(() => {
      db.run('DELETE FROM status_history WHERE artwork_id = ?', [req.params.id]);
      
      const deleteQuery = 'DELETE FROM artworks WHERE id = ?';
      db.run(deleteQuery, [req.params.id], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: '作品不存在' });
          return;
        }
        res.json({ message: '删除成功', id: parseInt(req.params.id) });
      });
    });
  });
});

router.post('/batch/status', async (req, res) => {
  const { artwork_ids, to_status, notes } = req.body;
  
  if (!artwork_ids || !Array.isArray(artwork_ids) || artwork_ids.length === 0) {
    res.status(400).json({ error: '作品ID列表不能为空' });
    return;
  }
  
  if (!to_status) {
    res.status(400).json({ error: '目标状态不能为空' });
    return;
  }
  
  try {
    const results = await StatusService.batchTransitionStatus(artwork_ids, to_status, notes);
    
    const success = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    res.json({
      success: failed.length === 0,
      total: artwork_ids.length,
      success_count: success.length,
      failed_count: failed.length,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
