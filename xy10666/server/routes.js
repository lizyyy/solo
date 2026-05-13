const express = require('express');
const router = express.Router();
const db = require('./database');
const { saveChangeHistory, saveFlowRecord, checkBusinessRules } = require('./businessLogic');

router.get('/molds', (req, res) => {
  const { search, status, responsible_person } = req.query;
  let query = 'SELECT * FROM molds WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (mold_code LIKE ? OR mold_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (responsible_person) {
    query += ' AND responsible_person = ?';
    params.push(responsible_person);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/molds/:id', (req, res) => {
  db.get('SELECT * FROM molds WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/molds', (req, res) => {
  const { mold_code, mold_name, mold_type, max_strokes, location, responsible_person } = req.body;
  
  db.run(
    'INSERT INTO molds (mold_code, mold_name, mold_type, max_strokes, location, responsible_person) VALUES (?, ?, ?, ?, ?, ?)',
    [mold_code, mold_name, mold_type, max_strokes, location, responsible_person],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      saveFlowRecord('mold', this.lastID, 'create', req.body.operator || 'system', '创建模具档案');
      res.json({ id: this.lastID, message: '模具创建成功' });
    }
  );
});

router.put('/molds/:id', (req, res) => {
  const moldId = req.params.id;
  
  db.get('SELECT * FROM molds WHERE id = ?', [moldId], (err, oldMold) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const fields = ['mold_name', 'mold_type', 'max_strokes', 'current_strokes', 'status', 'location', 'responsible_person'];
    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        
        if (oldMold[field] != req.body[field]) {
          saveChangeHistory('mold', moldId, field, oldMold[field], req.body[field], req.body.operator || 'system');
        }
      }
    });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(moldId);

    db.run(
      `UPDATE molds SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        saveFlowRecord('mold', moldId, 'update', req.body.operator || 'system', '更新模具档案');
        res.json({ message: '模具更新成功' });
      }
    );
  });
});

router.get('/maintenance-plans', (req, res) => {
  const { mold_id } = req.query;
  let query = 'SELECT * FROM maintenance_plans WHERE 1=1';
  const params = [];

  if (mold_id) {
    query += ' AND mold_id = ?';
    params.push(mold_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/maintenance-plans', (req, res) => {
  const { mold_id, plan_type, interval_strokes, next_maintenance_stroke, operator } = req.body;
  
  db.run(
    'INSERT INTO maintenance_plans (mold_id, plan_type, interval_strokes, next_maintenance_stroke) VALUES (?, ?, ?, ?)',
    [mold_id, plan_type, interval_strokes, next_maintenance_stroke],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      saveFlowRecord('maintenance_plan', this.lastID, 'create', operator || 'system', '创建保养计划');
      res.json({ id: this.lastID, message: '保养计划创建成功' });
    }
  );
});

router.put('/maintenance-plans/:id', (req, res) => {
  const planId = req.params.id;
  
  db.get('SELECT * FROM maintenance_plans WHERE id = ?', [planId], (err, oldPlan) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const fields = ['plan_type', 'interval_strokes', 'next_maintenance_stroke', 'last_maintenance_stroke', 'status'];
    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
        
        if (oldPlan[field] != req.body[field]) {
          saveChangeHistory('maintenance_plan', planId, field, oldPlan[field], req.body[field], req.body.operator || 'system');
        }
      }
    });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(planId);

    db.run(
      `UPDATE maintenance_plans SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        saveFlowRecord('maintenance_plan', planId, 'update', req.body.operator || 'system', '保养计划变更');
        res.json({ message: '保养计划更新成功' });
      }
    );
  });
});

router.get('/maintenance-records', (req, res) => {
  const { mold_id } = req.query;
  let query = 'SELECT * FROM maintenance_records WHERE 1=1';
  const params = [];

  if (mold_id) {
    query += ' AND mold_id = ?';
    params.push(mold_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/maintenance-records', async (req, res) => {
  const { mold_id, maintenance_type, start_stroke, end_stroke, description, responsible_person, operator } = req.body;

  const ruleCheck = await checkBusinessRules('maintenance', { mold_id, end_stroke });
  if (!ruleCheck.passed) {
    res.status(400).json({ error: ruleCheck.message, details: ruleCheck.details });
    return;
  }

  db.run(
    'INSERT INTO maintenance_records (mold_id, maintenance_type, start_stroke, end_stroke, description, responsible_person) VALUES (?, ?, ?, ?, ?, ?)',
    [mold_id, maintenance_type, start_stroke, end_stroke, description, responsible_person],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.run(
        'UPDATE maintenance_plans SET last_maintenance_stroke = ?, next_maintenance_stroke = ? + interval_strokes WHERE mold_id = ?',
        [end_stroke, end_stroke, mold_id],
        (updateErr) => {
          if (updateErr) {
            console.error('更新保养计划失败:', updateErr);
          }
        }
      );

      saveFlowRecord('maintenance', this.lastID, 'create', operator || 'system', '创建保养记录');
      res.json({ id: this.lastID, message: '保养记录创建成功' });
    }
  );
});

router.get('/production-tasks', (req, res) => {
  const { mold_id, status } = req.query;
  let query = 'SELECT * FROM production_tasks WHERE 1=1';
  const params = [];

  if (mold_id) {
    query += ' AND mold_id = ?';
    params.push(mold_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.post('/production-tasks', async (req, res) => {
  const { mold_id, task_code, product_name, planned_quantity, start_stroke, end_stroke, operator, scheduled_date } = req.body;

  const ruleCheck = await checkBusinessRules('production', { mold_id, task_code, start_stroke, end_stroke });
  if (!ruleCheck.passed) {
    res.status(400).json({ error: ruleCheck.message, details: ruleCheck.details });
    return;
  }

  db.run(
    'INSERT INTO production_tasks (mold_id, task_code, product_name, planned_quantity, start_stroke, end_stroke, operator, scheduled_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [mold_id, task_code, product_name, planned_quantity, start_stroke, end_stroke, operator, scheduled_date],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      saveFlowRecord('production', this.lastID, 'create', operator || 'system', '创建排产任务');
      res.json({ id: this.lastID, message: '排产任务创建成功' });
    }
  );
});

router.put('/production-tasks/:id/complete', (req, res) => {
  const taskId = req.params.id;
  const { actual_end_stroke, operator } = req.body;

  db.get('SELECT * FROM production_tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    db.run(
      'UPDATE production_tasks SET status = ?, end_stroke = ? WHERE id = ?',
      ['completed', actual_end_stroke, taskId],
      function(updateErr) {
        if (updateErr) {
          res.status(500).json({ error: updateErr.message });
          return;
        }

        db.run(
          'UPDATE molds SET current_strokes = ? WHERE id = ?',
          [actual_end_stroke, task.mold_id],
          (moldErr) => {
            if (moldErr) {
              console.error('更新模具冲次失败:', moldErr);
            }
          }
        );

        saveFlowRecord('production', taskId, 'complete', operator || 'system', '完成排产任务');
        res.json({ message: '任务完成成功' });
      }
    );
  });
});

router.get('/exceptions', (req, res) => {
  const { status, mold_id } = req.query;
  let query = 'SELECT e.*, m.mold_code, m.mold_name FROM exceptions e JOIN molds m ON e.mold_id = m.id WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND e.status = ?';
    params.push(status);
  }
  if (mold_id) {
    query += ' AND e.mold_id = ?';
    params.push(mold_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.put('/exceptions/:id/resolve', (req, res) => {
  const exceptionId = req.params.id;
  const { resolved_by, remarks } = req.body;

  db.run(
    'UPDATE exceptions SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?',
    ['resolved', resolved_by, exceptionId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      saveFlowRecord('exception', exceptionId, 'resolve', resolved_by, remarks || '处理异常');
      res.json({ message: '异常处理成功' });
    }
  );
});

router.get('/change-history', (req, res) => {
  const { entity_type, entity_id } = req.query;
  let query = 'SELECT * FROM change_history WHERE 1=1';
  const params = [];

  if (entity_type) {
    query += ' AND entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    query += ' AND entity_id = ?';
    params.push(entity_id);
  }

  query += ' ORDER BY changed_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/flow-records', (req, res) => {
  db.all('SELECT * FROM flow_records ORDER BY created_at DESC LIMIT 100', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/reports/export', require('./exportReport'));

router.get('/dashboard/stats', (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total_molds FROM molds', (err1, moldsData) => {
      db.get('SELECT COUNT(*) as open_exceptions FROM exceptions WHERE status = "open"', (err2, exceptionsData) => {
        db.get('SELECT COUNT(*) as pending_tasks FROM production_tasks WHERE status = "pending"', (err3, tasksData) => {
          db.all('SELECT * FROM maintenance_plans WHERE status = "active"', (err4, plans) => {
            const needsMaintenance = [];
            db.all('SELECT * FROM molds', (err5, molds) => {
              molds.forEach(mold => {
                const moldPlans = plans.filter(p => p.mold_id === mold.id);
                moldPlans.forEach(plan => {
                  if (mold.current_strokes >= plan.next_maintenance_stroke) {
                    needsMaintenance.push({
                      mold_code: mold.mold_code,
                      mold_name: mold.mold_name,
                      plan_type: plan.plan_type,
                      current_strokes: mold.current_strokes,
                      next_maintenance: plan.next_maintenance_stroke
                    });
                  }
                });
              });

              res.json({
                total_molds: moldsData.total_molds,
                open_exceptions: exceptionsData.open_exceptions,
                pending_tasks: tasksData.pending_tasks,
                needs_maintenance: needsMaintenance
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
