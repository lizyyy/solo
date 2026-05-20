const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { operator } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }

    const batchId = uuidv4();
    const batchNo = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    await run(
      'INSERT INTO batches (id, batch_no, operator, status) VALUES (?, ?, ?, ?)',
      [batchId, batchNo, operator, 'pending']
    );

    const taskId = uuidv4();
    await run(
      'INSERT INTO task_status (id, batch_id, status, message) VALUES (?, ?, ?, ?)',
      [taskId, batchId, 'pending', '批次已创建，等待上传材料']
    );

    res.status(201).json({
      id: batchId,
      batch_no: batchNo,
      operator,
      status: 'pending',
      message: '批次创建成功'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const batches = await all('SELECT * FROM batches ORDER BY created_at DESC');
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const claims = await all('SELECT * FROM claim_materials WHERE batch_id = ?', [batchId]);
    const results = await all('SELECT * FROM precheck_results WHERE batch_id = ?', [batchId]);
    const tasks = await all('SELECT * FROM task_status WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);

    res.json({
      batch,
      claims_count: claims.length,
      results_count: results.length,
      latest_task: tasks[0] || null,
      tasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { status, message } = req.body;

    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'exported'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态' });
    }

    await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, batchId]);

    const taskId = uuidv4();
    await run(
      'INSERT INTO task_status (id, batch_id, status, message) VALUES (?, ?, ?, ?)',
      [taskId, batchId, status, message || '状态更新']
    );

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
