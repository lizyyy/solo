const express = require('express');
const { getAsync } = require('../database');

const router = express.Router();

router.get('/tasks', async (req, res) => {
  const db = getAsync();
  const { team_name, task_code } = req.query;

  try {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (team_name) {
      sql += ' AND team_name = ?';
      params.push(team_name);
    }

    if (task_code) {
      sql += ' AND task_code = ?';
      params.push(task_code);
    }

    const tasks = await db.all(sql, ...params);
    const result = tasks.map(task => ({
      ...task,
      devices: JSON.parse(task.devices)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/tasks', async (req, res) => {
  const db = getAsync();
  const { task_code, team_name, devices, due_date } = req.body;

  if (!task_code || !team_name || !devices || !due_date) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }

  try {
    const existing = await db.get('SELECT 1 FROM tasks WHERE task_code = ?', task_code);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: '任务编号已存在'
      });
    }

    await db.run(
      'INSERT INTO tasks (task_code, team_name, devices, due_date) VALUES (?, ?, ?, ?)',
      task_code,
      team_name,
      JSON.stringify(devices),
      due_date
    );

    res.status(201).json({
      success: true,
      message: '任务创建成功',
      data: { task_code, team_name, devices, due_date }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
