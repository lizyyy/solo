const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const StateManager = require('../services/stateManager');

router.post('/', (req, res) => {
  const { campaign_id, parent_version_id, version, title, content, creator } = req.body;
  const id = uuidv4();

  db.run(
    `INSERT INTO materials (id, campaign_id, parent_version_id, version, title, content, creator)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, campaign_id, parent_version_id || null, version, title, content, creator],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        success: true,
        data: { id, campaign_id, parent_version_id, version, title, content, creator }
      });
    }
  );
});

router.get('/', (req, res) => {
  const { campaign_id } = req.query;
  let query = `SELECT * FROM materials`;
  let params = [];

  if (campaign_id) {
    query += ` WHERE campaign_id = ?`;
    params.push(campaign_id);
  }
  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

router.get('/tree/:campaignId', (req, res) => {
  const { campaignId } = req.params;

  db.all(
    `SELECT * FROM materials WHERE campaign_id = ? ORDER BY created_at ASC`,
    [campaignId],
    (err, materials) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const map = new Map();
      const roots = [];

      materials.forEach(m => map.set(m.id, { ...m, children: [] }));

      materials.forEach(m => {
        const node = map.get(m.id);
        if (m.parent_version_id && map.has(m.parent_version_id)) {
          map.get(m.parent_version_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      res.json({
        success: true,
        data: {
          total_versions: materials.length,
          tree: roots
        }
      });
    }
  );
});

router.get('/:id', (req, res) => {
  db.get(`SELECT * FROM materials WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }
    res.json({ success: true, data: row });
  });
});

router.post('/:id/assign-channels', (req, res) => {
  const { id } = req.params;
  const { channels, operator } = req.body;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    const results = [];
    let error = null;

    channels.forEach((ch, index) => {
      const mcId = uuidv4();
      db.run(
        `INSERT OR IGNORE INTO material_channels
         (id, material_id, channel_id, budget, status, review_status)
         VALUES (?, ?, ?, ?, 'draft', 'pending')`,
        [mcId, id, ch.channel_id, ch.budget || 0],
        (err) => {
          if (err) {
            error = err;
          } else {
            results.push({
              id: mcId,
              channel_id: ch.channel_id,
              budget: ch.budget || 0
            });
          }

          if (index === channels.length - 1) {
            if (error) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: error.message });
            }
            db.run('COMMIT', (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.status(201).json({
                success: true,
                data: {
                  assigned: results.length,
                  channels: results
                }
              });
            });
          }
        }
      );
    });
  });
});

router.get('/:id/channels', (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT mc.*, c.name as channel_name, c.code as channel_code,
            m.title as material_title, m.version as material_version
     FROM material_channels mc
     JOIN channels c ON mc.channel_id = c.id
     JOIN materials m ON mc.material_id = m.id
     WHERE mc.material_id = ?
     ORDER BY mc.created_at DESC`,
    [id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, data: rows });
    }
  );
});

router.post('/channel/:mcId/submit-review', async (req, res) => {
  try {
    const { operator } = req.body;
    const result = await StateManager.submitForReview(req.params.mcId, operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/approve', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = await StateManager.approveReview(req.params.mcId, operator, reason || '审核通过');
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/reject', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: '驳回原因不能为空' });
    }
    const result = await StateManager.rejectReview(req.params.mcId, operator, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/launch', async (req, res) => {
  try {
    const { operator, request_id } = req.body;
    const result = await StateManager.launch(req.params.mcId, operator, request_id);
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/pause', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = await StateManager.pause(req.params.mcId, operator, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/resume', async (req, res) => {
  try {
    const { operator, request_id } = req.body;
    const result = await StateManager.resume(req.params.mcId, operator, request_id);
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/stop', async (req, res) => {
  try {
    const { operator, reason } = req.body;
    const result = await StateManager.stop(req.params.mcId, operator, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/rollback', async (req, res) => {
  try {
    const { target_material_id, operator, reason, request_id } = req.body;
    if (!target_material_id) {
      return res.status(400).json({ success: false, error: '目标版本ID不能为空' });
    }
    const result = await StateManager.rollback(req.params.mcId, target_material_id, operator, reason || '回滚到历史版本', request_id);
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/channel/:mcId/performance', async (req, res) => {
  try {
    const { impressions, clicks, conversions, cost, request_id } = req.body;
    const result = await StateManager.recordPerformance(req.params.mcId, {
      impressions, clicks, conversions, cost
    }, request_id);
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/channel/:mcId/history', (req, res) => {
  db.all(
    `SELECT * FROM status_history
     WHERE material_channel_id = ?
     ORDER BY created_at DESC`,
    [req.params.mcId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, data: rows });
    }
  );
});

router.post('/manual-correct', async (req, res) => {
  try {
    const { target_id, target_type, before_data, after_data, operator, reason } = req.body;
    if (!target_id || !target_type || !operator) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    const result = await StateManager.manualCorrect(
      target_id, target_type, before_data, after_data, operator, reason
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/manual-corrections/:targetId', (req, res) => {
  db.all(
    `SELECT * FROM manual_corrections WHERE target_id = ? ORDER BY created_at DESC`,
    [req.params.targetId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, data: rows });
    }
  );
});

module.exports = router;
