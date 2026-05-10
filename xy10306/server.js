const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8888;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'nail_salon.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      deduction_rules TEXT NOT NULL,
      description TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS member_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      remaining_times INTEGER DEFAULT 0,
      purchased_times INTEGER DEFAULT 0,
      given_times INTEGER DEFAULT 0,
      total_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      project_id INTEGER,
      type TEXT NOT NULL,
      times_change INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT '系统',
      status TEXT DEFAULT 'completed',
      refunded_from INTEGER,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      project_id INTEGER,
      transaction_id INTEGER,
      type TEXT NOT NULL,
      proposed_times_change INTEGER,
      reason TEXT,
      reviewer TEXT,
      review_comment TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )
  `);

  db.all(`SELECT COUNT(*) as count FROM projects`, (err, row) => {
    if (row[0].count === 0) {
      const projects = [
        { name: '基础美甲', deduction_rules: '每次消费扣1次', description: '基础美甲服务' },
        { name: '高级美甲', deduction_rules: '每次消费扣2次', description: '高级美甲服务含设计' },
        { name: '手部护理', deduction_rules: '每次消费扣1次', description: '手部护理套餐' },
        { name: '足部美甲', deduction_rules: '每次消费扣1次', description: '足部美甲服务' },
        { name: '卸甲服务', deduction_rules: '每次消费扣0.5次', description: '卸甲服务' }
      ];

      const stmt = db.prepare('INSERT INTO projects (name, deduction_rules, description) VALUES (?, ?, ?)');
      projects.forEach(p => stmt.run(p.name, p.deduction_rules, p.description));
      stmt.finalize();
    }
  });

  db.all(`SELECT COUNT(*) as count FROM members`, (err, row) => {
    if (row[0].count === 0) {
      db.run(`
        INSERT INTO members (name, phone) VALUES
        ('张美丽', '13800138001'),
        ('李小花', '13800138002'),
        ('王芳芳', '13800138003')
      `);

      db.run(`
        INSERT INTO member_projects (member_id, project_id, remaining_times, purchased_times, given_times, total_used) VALUES
        (1, 1, 5, 10, 2, 7),
        (1, 2, 1, 5, 1, 5),
        (2, 1, 0, 3, 0, 3),
        (3, 1, 8, 10, 0, 2),
        (3, 3, 2, 5, 0, 3)
      `);

      db.run(`
        INSERT INTO transactions (member_id, project_id, type, times_change, description, status) VALUES
        (1, 1, 'purchase', 10, '购买基础美甲10次', 'completed'),
        (1, 1, 'gift', 2, '开业活动赠送2次', 'completed'),
        (1, 1, 'consume', -1, '基础美甲消费1次', 'completed'),
        (1, 2, 'purchase', 5, '购买高级美甲5次', 'completed'),
        (1, 2, 'gift', 1, '会员日赠送1次', 'completed'),
        (1, 2, 'consume', -2, '高级美甲消费2次', 'completed'),
        (2, 1, 'purchase', 3, '购买基础美甲3次', 'completed'),
        (2, 1, 'consume', -1, '基础美甲消费1次', 'completed'),
        (2, 1, 'consume', -1, '基础美甲消费1次', 'completed'),
        (3, 1, 'purchase', 10, '购买基础美甲10次', 'completed'),
        (3, 1, 'consume', -1, '基础美甲消费1次', 'completed'),
        (3, 3, 'purchase', 5, '购买手部护理5次', 'completed'),
        (3, 3, 'consume', -1, '手部护理消费1次', 'completed'),
        (3, 3, 'consume', -1, '手部护理消费1次', 'completed')
      `);

      db.run(`
        INSERT INTO corrections (member_id, project_id, type, proposed_times_change, reason, status) VALUES
        (3, 1, 'gift', 1, '会员生日赠送1次基础美甲', 'pending')
      `);
    }
  });
});

app.get('/api/members', (req, res) => {
  db.all('SELECT * FROM members ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/members', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: '姓名和手机号不能为空' });
  }

  db.get('SELECT id FROM members WHERE phone = ?', [phone], (err, row) => {
    if (row) {
      return res.status(400).json({ error: '该手机号已存在会员' });
    }

    db.run('INSERT INTO members (name, phone) VALUES (?, ?)', [name, phone], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, phone });
    });
  });
});

app.get('/api/members/:id', (req, res) => {
  const memberId = req.params.id;
  
  db.get('SELECT * FROM members WHERE id = ?', [memberId], (err, member) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!member) return res.status(404).json({ error: '会员不存在' });

    db.all(`
      SELECT mp.*, p.name as project_name, p.deduction_rules
      FROM member_projects mp
      JOIN projects p ON mp.project_id = p.id
      WHERE mp.member_id = ?
    `, [memberId], (err, projects) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...member, projects });
    });
  });
});

app.get('/api/projects', (req, res) => {
  db.all('SELECT * FROM projects', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/members/:id/projects', (req, res) => {
  const { project_id, times } = req.body;
  const memberId = req.params.id;

  if (!project_id || !times || times <= 0) {
    return res.status(400).json({ error: '项目和次数不能为空，次数必须大于0' });
  }

  db.get('SELECT * FROM projects WHERE id = ?', [project_id], (err, project) => {
    if (!project) return res.status(400).json({ error: '项目不存在' });

    db.get('SELECT * FROM member_projects WHERE member_id = ? AND project_id = ?', [memberId, project_id], (err, mp) => {
      if (mp) {
        db.run(`
          UPDATE member_projects 
          SET purchased_times = purchased_times + ?, 
              remaining_times = remaining_times + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [times, times, mp.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`
            INSERT INTO transactions (member_id, project_id, type, times_change, description)
            VALUES (?, ?, 'purchase', ?, '购买${project.name}${times}次')
          `, [memberId, project_id, times], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, transaction_id: this.lastID });
          });
        });
      } else {
        db.run(`
          INSERT INTO member_projects (member_id, project_id, remaining_times, purchased_times)
          VALUES (?, ?, ?, ?)
        `, [memberId, project_id, times, times], function(err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`
            INSERT INTO transactions (member_id, project_id, type, times_change, description)
            VALUES (?, ?, 'purchase', ?, '购买${project.name}${times}次')
          `, [memberId, project_id, times], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, transaction_id: this.lastID });
          });
        });
      }
    });
  });
});

app.post('/api/members/:id/consume', (req, res) => {
  const { project_id } = req.body;
  const memberId = req.params.id;

  if (!project_id) {
    return res.status(400).json({ error: '请选择消费项目' });
  }

  db.get(`
    SELECT mp.*, p.name as project_name, p.deduction_rules
    FROM member_projects mp
    JOIN projects p ON mp.project_id = p.id
    WHERE mp.member_id = ? AND mp.project_id = ?
  `, [memberId, project_id], (err, mp) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!mp) return res.status(400).json({ error: '该会员未购买此项目' });

    let deduction = 1;
    if (mp.deduction_rules.includes('2次')) deduction = 2;
    if (mp.deduction_rules.includes('0.5次')) deduction = 0.5;

    if (mp.remaining_times < deduction) {
      return res.status(400).json({ 
        error: `余额不足！当前剩余${mp.remaining_times}次，需要${deduction}次`,
        remaining_times: mp.remaining_times,
        required_times: deduction
      });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`
        UPDATE member_projects 
        SET remaining_times = remaining_times - ?, 
            total_used = total_used + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [deduction, deduction, mp.id]);

      db.run(`
        INSERT INTO transactions (member_id, project_id, type, times_change, description)
        VALUES (?, ?, 'consume', ?, '${mp.project_name}消费${deduction}次')
      `, [memberId, project_id, -deduction], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        db.run('COMMIT');
        res.json({ 
          success: true, 
          transaction_id: this.lastID,
          remaining_times: mp.remaining_times - deduction,
          deducted_times: deduction
        });
      });
    });
  });
});

app.post('/api/members/:id/gift', (req, res) => {
  const { project_id, times, reason } = req.body;
  const memberId = req.params.id;

  if (!project_id || !times || times <= 0) {
    return res.status(400).json({ error: '项目和赠送次数不能为空' });
  }

  db.get('SELECT * FROM projects WHERE id = ?', [project_id], (err, project) => {
    if (!project) return res.status(400).json({ error: '项目不存在' });

    db.get('SELECT * FROM member_projects WHERE member_id = ? AND project_id = ?', [memberId, project_id], (err, mp) => {
      const description = reason || `赠送${project.name}${times}次`;

      if (mp) {
        db.run(`
          UPDATE member_projects 
          SET given_times = given_times + ?, 
              remaining_times = remaining_times + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [times, times, mp.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`
            INSERT INTO transactions (member_id, project_id, type, times_change, description)
            VALUES (?, ?, 'gift', ?, ?)
          `, [memberId, project_id, times, description], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, transaction_id: this.lastID });
          });
        });
      } else {
        db.run(`
          INSERT INTO member_projects (member_id, project_id, remaining_times, given_times)
          VALUES (?, ?, ?, ?)
        `, [memberId, project_id, times, times], function(err) {
          if (err) return res.status(500).json({ error: err.message });

          db.run(`
            INSERT INTO transactions (member_id, project_id, type, times_change, description)
            VALUES (?, ?, 'gift', ?, ?)
          `, [memberId, project_id, times, description], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, transaction_id: this.lastID });
          });
        });
      }
    });
  });
});

app.get('/api/members/:id/transactions', (req, res) => {
  const memberId = req.params.id;
  
  db.all(`
    SELECT t.*, p.name as project_name, m.name as member_name, m.phone as member_phone
    FROM transactions t
    LEFT JOIN projects p ON t.project_id = p.id
    JOIN members m ON t.member_id = m.id
    WHERE t.member_id = ?
    ORDER BY t.created_at DESC
  `, [memberId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions/:id/refund', (req, res) => {
  const transactionId = req.params.id;
  const { reason } = req.body;

  db.get('SELECT * FROM transactions WHERE id = ?', [transactionId], (err, transaction) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!transaction) return res.status(404).json({ error: '流水不存在' });

    if (transaction.status === 'refunded') {
      return res.status(400).json({ error: '该流水已退款，不能重复退款' });
    }

    db.all('SELECT * FROM transactions WHERE refunded_from = ? AND status = "refunded"', [transactionId], (err, existingRefunds) => {
      if (existingRefunds.length > 0) {
        return res.status(400).json({ error: '该流水已存在退款记录，不能重复退款' });
      }

      if (!transaction.project_id) {
        return res.status(400).json({ error: '该流水无项目关联，无法退款' });
      }

      const refundTimes = -transaction.times_change;

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const updateQuery = transaction.times_change > 0
          ? `UPDATE member_projects 
             SET remaining_times = remaining_times - ?, 
                 purchased_times = purchased_times - ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE member_id = ? AND project_id = ?`
          : `UPDATE member_projects 
             SET remaining_times = remaining_times + ?, 
                 total_used = total_used + ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE member_id = ? AND project_id = ?`;

        const timesToUse = transaction.times_change > 0 ? transaction.times_change : -transaction.times_change;

        db.run(updateQuery, [timesToUse, timesToUse, transaction.member_id, transaction.project_id], (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          db.run(`
            INSERT INTO transactions (member_id, project_id, type, times_change, description, refunded_from)
            VALUES (?, ?, 'refund', ?, ?, ?)
          `, [transaction.member_id, transaction.project_id, refundTimes, reason || `退款：${transaction.description}`, transactionId], function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            db.run('UPDATE transactions SET status = "refunded" WHERE id = ?', [transactionId]);

            db.run('COMMIT');
            res.json({ success: true, refund_transaction_id: this.lastID });
          });
        });
      });
    });
  });
});

app.post('/api/corrections', (req, res) => {
  const { member_id, project_id, transaction_id, type, proposed_times_change, reason } = req.body;

  if (!member_id || !type || proposed_times_change === undefined) {
    return res.status(400).json({ error: '会员ID、类型和修正次数不能为空' });
  }

  if (transaction_id) {
    db.get('SELECT * FROM transactions WHERE id = ?', [transaction_id], (err, transaction) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!transaction) return res.status(404).json({ error: '关联的流水不存在' });
      if (transaction.status === 'refunded') {
        return res.status(400).json({ error: '该流水已退款，不能对已退款流水发起修正' });
      }

      db.all('SELECT * FROM corrections WHERE transaction_id = ? AND status IN ("pending", "approved")', [transaction_id], (err, existingCorrections) => {
        if (existingCorrections.length > 0) {
          return res.status(400).json({ error: '该流水已有待审核或已通过的修正申请' });
        }

        db.run(`
          INSERT INTO corrections (member_id, project_id, transaction_id, type, proposed_times_change, reason)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [member_id, project_id, transaction_id, type, proposed_times_change, reason], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, correction_id: this.lastID });
        });
      });
    });
  } else {
    db.run(`
      INSERT INTO corrections (member_id, project_id, type, proposed_times_change, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [member_id, project_id, null, type, proposed_times_change, reason], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, correction_id: this.lastID });
    });
  }
});

app.get('/api/corrections', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT c.*, m.name as member_name, m.phone as member_phone, p.name as project_name,
           t.id as transaction_id, t.type as transaction_type, t.times_change as original_times, t.description as transaction_description
    FROM corrections c
    JOIN members m ON c.member_id = m.id
    LEFT JOIN projects p ON c.project_id = p.id
    LEFT JOIN transactions t ON c.transaction_id = t.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE c.status = ?';
    params.push(status);
  }

  query += ' ORDER BY c.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/corrections/:id/review', (req, res) => {
  const correctionId = req.params.id;
  const { action, review_comment, reviewer } = req.body;

  if (!action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '请指定审核操作（approve/reject）' });
  }

  db.get('SELECT * FROM corrections WHERE id = ?', [correctionId], (err, correction) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!correction) return res.status(404).json({ error: '修正申请不存在' });
    if (correction.status !== 'pending') {
      return res.status(400).json({ error: '该申请已审核，不能重复审核' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      if (!correction.project_id) {
        return res.status(400).json({ error: '需要指定项目才能通过审核' });
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get('SELECT * FROM member_projects WHERE member_id = ? AND project_id = ?', [correction.member_id, correction.project_id], (err, mp) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          let updateQuery, timesToUse;
          const times = correction.proposed_times_change;

          if (mp) {
            if (times > 0) {
              updateQuery = `
                UPDATE member_projects 
                SET remaining_times = remaining_times + ?, 
                    given_times = given_times + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `;
              timesToUse = [times, times, mp.id];
            } else {
              if (mp.remaining_times < Math.abs(times)) {
                db.run('ROLLBACK');
                return res.status(400).json({ error: '剩余次数不足，无法通过此修正申请' });
              }
              updateQuery = `
                UPDATE member_projects 
                SET remaining_times = remaining_times + ?, 
                    total_used = total_used + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `;
              timesToUse = [times, Math.abs(times), mp.id];
            }
          } else {
            if (times < 0) {
              db.run('ROLLBACK');
              return res.status(400).json({ error: '该会员无此项目，无法扣减次数' });
            }
            db.run(`
              INSERT INTO member_projects (member_id, project_id, remaining_times, given_times)
              VALUES (?, ?, ?, ?)
            `, [correction.member_id, correction.project_id, times, times]);
            updateQuery = null;
          }

          if (updateQuery) {
            db.run(updateQuery, timesToUse, (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
            });
          }

          db.get('SELECT name FROM projects WHERE id = ?', [correction.project_id], (err, project) => {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }

            const desc = `修正${correction.type}：${correction.reason || ''}（${times > 0 ? '+' : ''}${times}次 ${project?.name || ''}）`;
            db.run(`
              INSERT INTO transactions (member_id, project_id, type, times_change, description)
              VALUES (?, ?, 'correction', ?, ?)
            `, [correction.member_id, correction.project_id, times, desc], (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }

              db.run(`
                UPDATE corrections 
                SET status = ?, reviewer = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [newStatus, reviewer || '审核员', review_comment, correctionId], (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: err.message });
                }

                db.run('COMMIT');
                res.json({ success: true, status: newStatus });
              });
            });
          });
        });
      });
    } else {
      db.run(`
        UPDATE corrections 
        SET status = ?, reviewer = ?, review_comment = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newStatus, reviewer || '审核员', review_comment, correctionId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, status: newStatus });
      });
    }
  });
});

app.get('/api/reconciliation', (req, res) => {
  const { start_date, end_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (start_date) {
    dateFilter += ' AND t.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ' AND t.created_at <= ?';
    params.push(end_date + ' 23:59:59');
  }

  const query = `
    SELECT 
      m.id as member_id,
      m.name as member_name,
      m.phone as member_phone,
      p.id as project_id,
      p.name as project_name,
      SUM(CASE WHEN t.type = 'purchase' THEN t.times_change ELSE 0 END) as total_purchased,
      SUM(CASE WHEN t.type = 'gift' THEN t.times_change ELSE 0 END) as total_gifted,
      SUM(CASE WHEN t.type = 'consume' THEN ABS(t.times_change) ELSE 0 END) as total_consumed,
      SUM(CASE WHEN t.type = 'correction' THEN t.times_change ELSE 0 END) as total_correction,
      SUM(CASE WHEN t.type = 'refund' THEN t.times_change ELSE 0 END) as total_refunded
    FROM transactions t
    JOIN members m ON t.member_id = m.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1 ${dateFilter}
    GROUP BY m.id, p.id
    ORDER BY m.name, p.name
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/reconciliation/export', (req, res) => {
  const { start_date, end_date } = req.query;

  let dateFilter = '';
  const params = [];

  if (start_date) {
    dateFilter += ' AND t.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += ' AND t.created_at <= ?';
    params.push(end_date + ' 23:59:59');
  }

  const query = `
    SELECT 
      m.name as 会员姓名,
      m.phone as 手机号,
      p.name as 项目名称,
      SUM(CASE WHEN t.type = 'purchase' THEN t.times_change ELSE 0 END) as 购买次数,
      SUM(CASE WHEN t.type = 'gift' THEN t.times_change ELSE 0 END) as 赠送次数,
      SUM(CASE WHEN t.type = 'consume' THEN ABS(t.times_change) ELSE 0 END) as 消费次数,
      SUM(CASE WHEN t.type = 'correction' THEN t.times_change ELSE 0 END) as 修正次数,
      SUM(CASE WHEN t.type = 'refund' THEN t.times_change ELSE 0 END) as 退款次数,
      (SUM(CASE WHEN t.type = 'purchase' THEN t.times_change ELSE 0 END) +
       SUM(CASE WHEN t.type = 'gift' THEN t.times_change ELSE 0 END) +
       SUM(CASE WHEN t.type = 'consume' THEN t.times_change ELSE 0 END) +
       SUM(CASE WHEN t.type = 'correction' THEN t.times_change ELSE 0 END) +
       SUM(CASE WHEN t.type = 'refund' THEN t.times_change ELSE 0 END)) as 实际剩余
    FROM transactions t
    JOIN members m ON t.member_id = m.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1 ${dateFilter}
    GROUP BY m.id, p.id
    ORDER BY m.name, p.name
  `;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (rows.length === 0) {
      return res.json({ data: [], csv: '' });
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map(row => 
      Object.values(row).map(v => `"${v || 0}"`).join(',')
    );
    const csv = [headers, ...csvRows].join('\n');

    res.json({ data: rows, csv });
  });
});

app.listen(PORT, () => {
  console.log(`美甲店会员卡欠次修正台系统已启动，访问地址：http://localhost:${PORT}`);
});
