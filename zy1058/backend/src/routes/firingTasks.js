const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ValidationService = require('../services/validationService');
const StatusService = require('../services/statusService');
const ImportExportService = require('../services/importExportService');

router.get('/', (req, res) => {
  const { status, kiln_id } = req.query;
  
  let query = `
    SELECT ft.*,
      k.name as kiln_name, k.type as kiln_type, k.max_temperature,
      fc.name as curve_name, fc.type as curve_type, fc.cone, fc.max_temperature as curve_temp,
      COUNT(DISTINCT ta.artwork_id) as artwork_count
    FROM firing_tasks ft
    LEFT JOIN kilns k ON ft.kiln_id = k.id
    LEFT JOIN firing_curves fc ON ft.firing_curve_id = fc.id
    LEFT JOIN task_artworks ta ON ft.id = ta.task_id
  `;
  
  const conditions = [];
  const params = [];
  
  if (status) {
    conditions.push('ft.status = ?');
    params.push(status);
  }
  if (kiln_id) {
    conditions.push('ft.kiln_id = ?');
    params.push(parseInt(kiln_id));
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' GROUP BY ft.id ORDER BY ft.created_at DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const query = `
    SELECT ft.*,
      k.name as kiln_name, k.type as kiln_type, k.max_temperature, k.width as kiln_width, k.height as kiln_height, k.depth as kiln_depth,
      fc.name as curve_name, fc.type as curve_type, fc.cone, fc.max_temperature as curve_temp, fc.description as curve_description
    FROM firing_tasks ft
    LEFT JOIN kilns k ON ft.kiln_id = k.id
    LEFT JOIN firing_curves fc ON ft.firing_curve_id = fc.id
    WHERE ft.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '烧窑任务不存在' });
      return;
    }
    
    const result = {
      ...row,
      curve_description: row.curve_description ? JSON.parse(row.curve_description) : null
    };
    
    res.json(result);
  });
});

router.get('/:id/artworks', (req, res) => {
  const query = `
    SELECT 
      a.*,
      c.name as customer_name,
      cl.name as clay_name, cl.temp_min as clay_temp_min, cl.temp_max as clay_temp_max,
      g1.name as glaze_name, g1.temp_min as glaze_temp_min, g1.temp_max as glaze_temp_max, g1.incompatible_glazes,
      g2.name as glaze2_name,
      s.name as shelf_name, s.level as shelf_level,
      ta.shelf_id, ta.position_x, ta.position_y, ta.notes as task_notes
    FROM task_artworks ta
    LEFT JOIN artworks a ON ta.artwork_id = a.id
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN clays cl ON a.clay_id = cl.id
    LEFT JOIN glazes g1 ON a.glaze_id = g1.id
    LEFT JOIN glazes g2 ON a.glaze2_id = g2.id
    LEFT JOIN shelves s ON ta.shelf_id = s.id
    WHERE ta.task_id = ?
    ORDER BY s.level, a.name
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
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

router.get('/:id/validate', async (req, res) => {
  try {
    const validation = await ValidationService.validateFiringTask(parseInt(req.params.id));
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await StatusService.getFiringTaskStatusHistory(parseInt(req.params.id));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, kiln_id, firing_curve_id, scheduled_start, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '任务名称不能为空' });
    return;
  }
  
  const query = `
    INSERT INTO firing_tasks (name, kiln_id, firing_curve_id, scheduled_start, status, notes)
    VALUES (?, ?, ?, ?, 'planning', ?)
  `;
  
  db.run(query, [name, kiln_id || null, firing_curve_id || null, scheduled_start, notes], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      id: this.lastID,
      name,
      kiln_id,
      firing_curve_id,
      scheduled_start,
      status: 'planning',
      notes,
      created_at: new Date().toISOString()
    });
  });
});

router.put('/:id', (req, res) => {
  const { name, kiln_id, firing_curve_id, scheduled_start, notes } = req.body;
  
  if (!name) {
    res.status(400).json({ error: '任务名称不能为空' });
    return;
  }
  
  const query = `
    UPDATE firing_tasks 
    SET name = ?, kiln_id = ?, firing_curve_id = ?, scheduled_start = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [name, kiln_id || null, firing_curve_id || null, scheduled_start, notes, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '烧窑任务不存在' });
      return;
    }
    res.json({
      id: parseInt(req.params.id),
      name,
      kiln_id,
      firing_curve_id,
      scheduled_start,
      notes,
      updated_at: new Date().toISOString()
    });
  });
});

router.patch('/:id/status', (req, res) => {
  const { status, notes } = req.body;
  
  if (!status) {
    res.status(400).json({ error: '状态不能为空' });
    return;
  }
  
  const validStatuses = ['planning', 'loading', 'firing', 'cooling', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: '无效的任务状态' });
    return;
  }
  
  const query = `
    UPDATE firing_tasks 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [status, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: '烧窑任务不存在' });
      return;
    }
    
    if (status === 'firing') {
      const updateArtworksQuery = `
        UPDATE artworks 
        SET status = 'firing', updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT artwork_id FROM task_artworks WHERE task_id = ?)
      `;
      db.run(updateArtworksQuery, [req.params.id], (updateErr) => {
        if (updateErr) {
          console.warn('更新作品状态失败:', updateErr.message);
        }
      });
    }
    
    res.json({
      id: parseInt(req.params.id),
      status,
      updated_at: new Date().toISOString()
    });
  });
});

router.post('/:id/add-artwork', (req, res) => {
  const { artwork_id, shelf_id, position_x, position_y, notes } = req.body;
  
  if (!artwork_id) {
    res.status(400).json({ error: '作品ID不能为空' });
    return;
  }
  
  const taskId = parseInt(req.params.id);
  const artworkId = parseInt(artwork_id);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const checkQuery = 'SELECT * FROM task_artworks WHERE task_id = ? AND artwork_id = ?';
    db.get(checkQuery, [taskId, artworkId], (err, existing) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (existing) {
        db.run('ROLLBACK');
        res.status(400).json({ error: '该作品已在当前烧窑任务中' });
        return;
      }
      
      const insertQuery = `
        INSERT INTO task_artworks (task_id, artwork_id, shelf_id, position_x, position_y, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(insertQuery, [taskId, artworkId, shelf_id || null, position_x, position_y, notes], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        const updateArtworkQuery = `
          UPDATE artworks 
          SET status = 'in_kiln', current_firing_task_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateArtworkQuery, [taskId, artworkId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }
          
          db.run(
            `INSERT INTO status_history (artwork_id, from_status, to_status, notes) VALUES (?, 'pending', 'in_kiln', '添加到烧窑任务')`,
            [artworkId],
            (historyErr) => {
              if (historyErr) {
                console.warn('创建状态历史失败:', historyErr.message);
              }
              
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: commitErr.message });
                  return;
                }
                
                res.status(201).json({
                  id: this.lastID,
                  task_id: taskId,
                  artwork_id: artworkId,
                  shelf_id,
                  position_x,
                  position_y,
                  notes,
                  created_at: new Date().toISOString()
                });
              });
            }
          );
        });
      });
    });
  });
});

router.post('/:id/remove-artwork', (req, res) => {
  const { artwork_id } = req.body;
  
  if (!artwork_id) {
    res.status(400).json({ error: '作品ID不能为空' });
    return;
  }
  
  const taskId = parseInt(req.params.id);
  const artworkId = parseInt(artwork_id);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const deleteQuery = 'DELETE FROM task_artworks WHERE task_id = ? AND artwork_id = ?';
    db.run(deleteQuery, [taskId, artworkId], function(err) {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        db.run('ROLLBACK');
        res.status(404).json({ error: '该作品不在当前烧窑任务中' });
        return;
      }
      
      const updateArtworkQuery = `
        UPDATE artworks 
        SET status = 'pending', current_firing_task_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(updateArtworkQuery, [artworkId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run(
          `INSERT INTO status_history (artwork_id, from_status, to_status, notes) VALUES (?, 'in_kiln', 'pending', '从烧窑任务中移除')`,
          [artworkId],
          (historyErr) => {
            if (historyErr) {
              console.warn('创建状态历史失败:', historyErr.message);
            }
            
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                res.status(500).json({ error: commitErr.message });
                return;
              }
              
              res.json({
                message: '作品已从烧窑任务中移除',
                task_id: taskId,
                artwork_id: artworkId
              });
            });
          }
        );
      });
    });
  });
});

router.get('/:id/export/:format', async (req, res) => {
  const { id, format } = req.params;
  
  if (!['markdown', 'html'].includes(format)) {
    res.status(400).json({ error: '不支持的导出格式，支持 markdown 或 html' });
    return;
  }
  
  try {
    const report = await ImportExportService.generateFiringReport(parseInt(id), format);
    
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="firing-task-${id}.md"`);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="firing-task-${id}.html"`);
    }
    
    res.send(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const artworksQuery = 'SELECT artwork_id FROM task_artworks WHERE task_id = ?';
    db.all(artworksQuery, [taskId], (err, artworks) => {
      if (err) {
        db.run('ROLLBACK');
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (artworks.length > 0) {
        const artworkIds = artworks.map(a => a.artwork_id);
        const placeholders = artworkIds.map(() => '?').join(',');
        
        const updateArtworksQuery = `
          UPDATE artworks 
          SET status = 'pending', current_firing_task_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id IN (${placeholders})
        `;
        
        db.run(updateArtworksQuery, artworkIds, (updateErr) => {
          if (updateErr) {
            console.warn('更新作品状态失败:', updateErr.message);
          }
        });
      }
      
      db.run('DELETE FROM task_artworks WHERE task_id = ?', [taskId]);
      
      const deleteQuery = 'DELETE FROM firing_tasks WHERE id = ?';
      db.run(deleteQuery, [taskId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          db.run('ROLLBACK');
          res.status(404).json({ error: '烧窑任务不存在' });
          return;
        }
        
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            db.run('ROLLBACK');
            res.status(500).json({ error: commitErr.message });
            return;
          }
          
          res.json({ message: '删除成功', id: taskId });
        });
      });
    });
  });
});

module.exports = router;
