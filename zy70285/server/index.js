const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const {
  validateStoreProfile,
  validateInspectionReliability,
  validateRectificationConsistency,
  addStatusHistory,
  getStatusHistory,
  getValidationHistory
} = require('./validationService');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get('/api/stores', (req, res) => {
  db.all(`SELECT * FROM stores ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/stores/:id', (req, res) => {
  db.get(`SELECT * FROM stores WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '门店不存在' });
      return;
    }
    res.json(row);
  });
});

app.post('/api/stores', (req, res) => {
  const { name, code, address, manager } = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();
  
  db.run(
    `INSERT INTO stores (id, name, code, address, status, manager, authorized, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, 1, ?, ?)`,
    [id, name, code, address, manager, now, now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, code, address, manager, status: 'active', authorized: true, created_at: now });
    }
  );
});

app.get('/api/inspections', (req, res) => {
  db.all(`SELECT * FROM inspections ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : [],
      problems: r.problems ? JSON.parse(r.problems) : []
    })));
  });
});

app.get('/api/inspections/:id', (req, res) => {
  db.get(`SELECT * FROM inspections WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '巡店记录不存在' });
      return;
    }
    res.json({
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : [],
      problems: row.problems ? JSON.parse(row.problems) : []
    });
  });
});

app.post('/api/inspections', (req, res) => {
  const { store_id, inspector, inspection_date, photos, problems, overall_score } = req.body;
  const now = new Date().toISOString();
  const id = uuidv4();
  const status = 'pending';
  
  db.run(
    `INSERT INTO inspections (id, store_id, inspector, inspection_date, photos, problems, overall_score, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, store_id, inspector, inspection_date, 
     JSON.stringify(photos || []), 
     JSON.stringify(problems || []), 
     overall_score || null, status, now, now],
    async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      await addStatusHistory('inspection', id, null, status, 'system', '创建巡店记录');
      
      res.json({
        id, store_id, inspector, inspection_date, photos: photos || [], 
        problems: problems || [], overall_score, status, created_at: now
      });
    }
  );
});

app.post('/api/inspections/:id/submit', async (req, res) => {
  const id = req.params.id;
  const now = new Date().toISOString();
  
  db.get(`SELECT * FROM inspections WHERE id = ?`, [id], async (err, inspection) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!inspection) {
      res.status(404).json({ error: '巡店记录不存在' });
      return;
    }

    const validation = await validateInspectionReliability(id);
    
    if (!validation.passed) {
      res.json({
        success: false,
        validation,
        message: '提交失败：巡店数据可靠性验证未通过'
      });
      return;
    }

    const newStatus = 'submitted';
    db.run(
      `UPDATE inspections SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, id],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        await addStatusHistory('inspection', id, inspection.status, newStatus, 'user', '提交巡店记录，验证通过');
        
        const problems = inspection.problems ? JSON.parse(inspection.problems) : [];
        for (const p of problems) {
          const problemId = uuidv4();
          db.run(
            `INSERT INTO problems (id, inspection_id, store_id, category, description, photos, severity, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [problemId, id, inspection.store_id, p.category || '其他', p.description, 
             JSON.stringify(p.photos || []), p.severity || 'medium', now, now],
            async (err) => {
              if (!err) {
                await addStatusHistory('problem', problemId, null, 'pending', 'system', '从巡店记录创建问题');
              }
            }
          );
        }
        
        res.json({
          success: true,
          validation,
          status: newStatus,
          message: '提交成功，问题已生成'
        });
      }
    );
  });
});

app.get('/api/problems', (req, res) => {
  const { store_id, inspection_id } = req.query;
  let sql = `SELECT * FROM problems`;
  const params = [];
  
  if (store_id) {
    sql += ` WHERE store_id = ?`;
    params.push(store_id);
  }
  if (inspection_id) {
    sql += params.length > 0 ? ` AND inspection_id = ?` : ` WHERE inspection_id = ?`;
    params.push(inspection_id);
  }
  sql += ` ORDER BY created_at DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(r => ({
      ...r,
      photos: r.photos ? JSON.parse(r.photos) : []
    })));
  });
});

app.get('/api/problems/:id', (req, res) => {
  db.get(`SELECT * FROM problems WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: '问题不存在' });
      return;
    }
    res.json({
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : []
    });
  });
});

app.post('/api/problems/:id/rectify', async (req, res) => {
  const problemId = req.params.id;
  const { rectifier, photos, description } = req.body;
  const now = new Date().toISOString();
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [problemId], async (err, problem) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!problem) {
      res.status(404).json({ error: '问题不存在' });
      return;
    }

    const rectId = uuidv4();
    db.run(
      `INSERT INTO rectifications (id, problem_id, store_id, rectifier, rectification_date, photos, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`,
      [rectId, problemId, problem.store_id, rectifier, now, 
       JSON.stringify(photos || []), description, now, now],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const newStatus = 'rectified';
        db.run(
          `UPDATE problems SET status = ?, updated_at = ? WHERE id = ?`,
          [newStatus, now, problemId],
          async (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            
            await addStatusHistory('problem', problemId, problem.status, newStatus, rectifier || 'user', '提交整改记录');
            
            res.json({
              success: true,
              rectification_id: rectId,
              status: newStatus,
              message: '整改记录已提交'
            });
          }
        );
      }
    );
  });
});

app.post('/api/problems/:id/review', async (req, res) => {
  const problemId = req.params.id;
  const { reviewer, photos, comments, passed, score } = req.body;
  const now = new Date().toISOString();
  
  db.get(`SELECT * FROM problems WHERE id = ?`, [problemId], async (err, problem) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!problem) {
      res.status(404).json({ error: '问题不存在' });
      return;
    }

    const consistencyCheck = await validateRectificationConsistency(problemId);
    
    const reviewId = uuidv4();
    db.run(
      `INSERT INTO reviews (id, problem_id, store_id, reviewer, review_date, photos, comments, passed, score, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reviewId, problemId, problem.store_id, reviewer, now, 
       JSON.stringify(photos || []), comments, passed ? 1 : 0, score || null, 'submitted', now],
      async (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        const newStatus = passed ? 'completed' : 'rejected';
        db.run(
          `UPDATE problems SET status = ?, updated_at = ? WHERE id = ?`,
          [newStatus, now, problemId],
          async (err) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            
            await addStatusHistory('problem', problemId, problem.status, newStatus, reviewer, 
              passed ? '复查通过，问题关闭' : '复查未通过，需要重新整改');
            
            res.json({
              success: true,
              review_id: reviewId,
              status: newStatus,
              consistencyCheck,
              message: passed ? '复查通过' : '复查未通过，需要重新整改'
            });
          }
        );
      }
    );
  });
});

app.get('/api/problems/:id/rectifications', (req, res) => {
  db.all(
    `SELECT * FROM rectifications WHERE problem_id = ? ORDER BY created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows.map(r => ({
        ...r,
        photos: r.photos ? JSON.parse(r.photos) : []
      })));
    }
  );
});

app.get('/api/problems/:id/reviews', (req, res) => {
  db.all(
    `SELECT * FROM reviews WHERE problem_id = ? ORDER BY created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows.map(r => ({
        ...r,
        photos: r.photos ? JSON.parse(r.photos) : [],
        passed: r.passed === 1
      })));
    }
  );
});

app.post('/api/validate/store/:id', async (req, res) => {
  try {
    const result = await validateStoreProfile(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/validate/inspection/:id', async (req, res) => {
  try {
    const result = await validateInspectionReliability(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/validate/problem/:id', async (req, res) => {
  try {
    const result = await validateRectificationConsistency(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/:entityType/:entityId', async (req, res) => {
  try {
    const [statusHistory, validationHistory] = await Promise.all([
      getStatusHistory(req.params.entityType, req.params.entityId),
      getValidationHistory(req.params.entityType, req.params.entityId)
    ]);
    res.json({
      statusHistory,
      validationHistory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard/stats', (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM stores`, (err, storeCount) => {
    db.get(`SELECT COUNT(*) as total FROM problems`, (err, problemCount) => {
      db.get(`SELECT COUNT(*) as total FROM problems WHERE status = 'pending'`, (err, pendingCount) => {
        db.get(`SELECT COUNT(*) as total FROM problems WHERE status = 'rectified'`, (err, rectifiedCount) => {
          db.get(`SELECT COUNT(*) as total FROM problems WHERE status = 'completed'`, (err, completedCount) => {
            db.get(`SELECT COUNT(*) as total FROM problems WHERE status = 'rejected'`, (err, rejectedCount) => {
              res.json({
                stores: storeCount.total,
                problems: problemCount.total,
                byStatus: {
                  pending: pendingCount.total,
                  rectified: rectifiedCount.total,
                  completed: completedCount.total,
                  rejected: rejectedCount.total
                }
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/inspections/:id/status-flow', (req, res) => {
  const flow = [
    { status: 'pending', label: '待提交', description: '巡店记录已创建，等待提交', isInitial: true },
    { status: 'submitted', label: '已提交', description: '巡店记录已提交验证，问题已生成' },
    { status: 'processing', label: '处理中', description: '问题正在整改处理中' },
    { status: 'reviewing', label: '复查中', description: '整改完成，等待总部复查' },
    { status: 'completed', label: '已完成', description: '复查通过，问题关闭', isFinal: true }
  ];
  res.json(flow);
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`巡店问题台服务运行在端口 ${PORT}`);
});
