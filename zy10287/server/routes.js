const express = require('express');
const router = express.Router();
const db = require('./database');
const XLSX = require('xlsx');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runInsert(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function runUpdate(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

async function checkPersonTraining(personId) {
  const trainings = await runQuery(
    'SELECT * FROM trainings WHERE person_id = ? AND status = "completed"',
    [personId]
  );
  return trainings.length > 0;
}

async function checkPersonBadgeReturned(personId) {
  const badges = await runQuery(
    'SELECT * FROM badges WHERE person_id = ? AND status != "returned"',
    [personId]
  );
  return badges.length === 0;
}

async function checkPersonExited(personId) {
  const exits = await runQuery(
    'SELECT * FROM exits WHERE person_id = ? ORDER BY exit_date DESC LIMIT 1',
    [personId]
  );
  return exits.length > 0;
}

router.get('/persons', async (req, res) => {
  try {
    const { project, keyword } = req.query;
    let sql = `
      SELECT p.*,
             (SELECT COUNT(*) FROM trainings t WHERE t.person_id = p.id AND t.status = 'completed') as training_completed,
             (SELECT COUNT(*) FROM badges b WHERE b.person_id = p.id AND b.status = 'issued') as badge_issued,
             (SELECT COUNT(*) FROM entries e WHERE e.person_id = p.id) as entry_count,
             (SELECT COUNT(*) FROM exits ex WHERE ex.person_id = p.id) as exit_count,
             (SELECT MAX(entry_date) FROM entries e WHERE e.person_id = p.id) as last_entry_date,
             (SELECT MAX(exit_date) FROM exits ex WHERE ex.person_id = p.id) as last_exit_date
      FROM persons p WHERE 1=1
    `;
    let params = [];
    
    if (project) {
      sql += ' AND p.project = ?';
      params.push(project);
    }
    if (keyword) {
      sql += ' AND (p.name LIKE ? OR p.id_card LIKE ? OR p.phone LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    sql += ' ORDER BY p.created_at DESC';
    const persons = await runQuery(sql, params);
    res.json(persons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/persons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const persons = await runQuery('SELECT * FROM persons WHERE id = ?', [id]);
    if (persons.length === 0) {
      return res.status(404).json({ error: '人员不存在' });
    }
    const person = persons[0];
    const trainings = await runQuery('SELECT * FROM trainings WHERE person_id = ?', [id]);
    const badges = await runQuery('SELECT * FROM badges WHERE person_id = ?', [id]);
    const entries = await runQuery('SELECT * FROM entries WHERE person_id = ?', [id]);
    const exits = await runQuery('SELECT * FROM exits WHERE person_id = ?', [id]);
    const settlements = await runQuery('SELECT * FROM settlements WHERE person_id = ?', [id]);
    const schedules = await runQuery('SELECT * FROM schedules WHERE person_id = ?', [id]);
    
    res.json({
      ...person,
      trainings,
      badges,
      entries,
      exits,
      settlements,
      schedules
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/persons', async (req, res) => {
  try {
    const { id_card, name, phone, gender, outsourcing_company, project } = req.body;
    
    const existing = await runQuery('SELECT * FROM persons WHERE id_card = ?', [id_card]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '该身份证已存在，请勿重复建档', personId: existing[0].id });
    }
    
    const id = await runInsert(
      'INSERT INTO persons (id_card, name, phone, gender, outsourcing_company, project) VALUES (?, ?, ?, ?, ?, ?)',
      [id_card, name, phone, gender, outsourcing_company, project]
    );
    
    res.json({ id, message: '人员创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trainings', async (req, res) => {
  try {
    const { person_id, training_date, training_content, trainer, status, attachment } = req.body;
    const id = await runInsert(
      'INSERT INTO trainings (person_id, training_date, training_content, trainer, status, attachment) VALUES (?, ?, ?, ?, ?, ?)',
      [person_id, training_date, training_content, trainer, status, attachment]
    );
    res.json({ id, message: '培训记录创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/trainings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { training_date, training_content, trainer, status, attachment } = req.body;
    await runUpdate(
      'UPDATE trainings SET training_date = ?, training_content = ?, trainer = ?, status = ?, attachment = ? WHERE id = ?',
      [training_date, training_content, trainer, status, attachment, id]
    );
    res.json({ message: '培训记录更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/badges', async (req, res) => {
  try {
    const { person_id, badge_number, issue_date } = req.body;
    
    const existing = await runQuery('SELECT * FROM badges WHERE badge_number = ?', [badge_number]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '该工牌号已被使用' });
    }
    
    const id = await runInsert(
      'INSERT INTO badges (person_id, badge_number, issue_date) VALUES (?, ?, ?)',
      [person_id, badge_number, issue_date]
    );
    res.json({ id, message: '工牌发放成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/badges/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { returned_date } = req.body;
    await runUpdate(
      'UPDATE badges SET status = "returned", returned_date = ? WHERE id = ?',
      [returned_date, id]
    );
    res.json({ message: '工牌回收成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/entries', async (req, res) => {
  try {
    const { person_id, entry_date, position, approver, remarks } = req.body;
    
    const existingEntry = await runQuery(
      'SELECT * FROM entries WHERE person_id = ? AND entry_date = ?',
      [person_id, entry_date]
    );
    if (existingEntry.length > 0) {
      return res.status(400).json({ error: '该人员当日已有入场记录，请勿重复提交' });
    }
    
    const hasTraining = await checkPersonTraining(person_id);
    
    const id = await runInsert(
      'INSERT INTO entries (person_id, entry_date, position, approver, remarks) VALUES (?, ?, ?, ?, ?)',
      [person_id, entry_date, position, approver, remarks]
    );
    
    if (!hasTraining) {
      res.json({ id, message: '入场登记成功（注意：该人员未完成培训）', warning: '未培训入场' });
    } else {
      res.json({ id, message: '入场登记成功' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/entries/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await runUpdate(
      'UPDATE entries SET approval_status = "approved" WHERE id = ?',
      [id]
    );
    res.json({ message: '入场审批通过' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/exits', async (req, res) => {
  try {
    const { person_id, exit_date, exit_reason, badge_returned, approver, remarks } = req.body;
    
    const existingExit = await runQuery(
      'SELECT * FROM exits WHERE person_id = ? AND exit_date = ?',
      [person_id, exit_date]
    );
    if (existingExit.length > 0) {
      return res.status(400).json({ error: '该人员当日已有离场记录，请勿重复提交' });
    }
    
    const hasBadge = !(await checkPersonBadgeReturned(person_id));
    const actualBadgeReturned = badge_returned || !hasBadge;
    
    const id = await runInsert(
      'INSERT INTO exits (person_id, exit_date, exit_reason, badge_returned, approver, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [person_id, exit_date, exit_reason, actualBadgeReturned ? 1 : 0, approver, remarks]
    );
    
    if (!actualBadgeReturned && hasBadge) {
      res.json({ id, message: '离场登记成功（注意：工牌未回收）', warning: '工牌未回收' });
    } else {
      res.json({ id, message: '离场登记成功' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settlements', async (req, res) => {
  try {
    const { person_id, settlement_date, settlement_amount, attachment, approver, remarks } = req.body;
    
    const existingSettlement = await runQuery(
      'SELECT * FROM settlements WHERE person_id = ? AND settlement_date = ?',
      [person_id, settlement_date]
    );
    if (existingSettlement.length > 0) {
      return res.status(400).json({ error: '该人员当日已有结算记录，请勿重复提交' });
    }
    
    const badgeReturned = await checkPersonBadgeReturned(person_id);
    if (!badgeReturned) {
      return res.status(400).json({ error: '该人员工牌未回收，无法进行结算' });
    }
    
    const id = await runInsert(
      'INSERT INTO settlements (person_id, settlement_date, settlement_amount, attachment, approver, remarks) VALUES (?, ?, ?, ?, ?, ?)',
      [person_id, settlement_date, settlement_amount, attachment, approver, remarks]
    );
    
    res.json({ id, message: '结算登记成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const { person_id, schedule_date, shift, position } = req.body;
    
    const hasExited = await checkPersonExited(person_id);
    
    const existing = await runQuery(
      'SELECT * FROM schedules WHERE person_id = ? AND schedule_date = ? AND shift = ?',
      [person_id, schedule_date, shift]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '该人员此班次已有排班' });
    }
    
    const id = await runInsert(
      'INSERT INTO schedules (person_id, schedule_date, shift, position) VALUES (?, ?, ?, ?)',
      [person_id, schedule_date, shift, position]
    );
    
    if (hasExited) {
      res.json({ id, message: '排班成功（注意：该人员已离场）', warning: '已离场人员排班' });
    } else {
      res.json({ id, message: '排班成功' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const { project } = req.query;
    
    let projectFilter = '';
    let params = [];
    if (project) {
      projectFilter = 'AND p.project = ?';
      params.push(project);
    }
    
    const totalPersons = await runQuery(`SELECT COUNT(*) as count FROM persons p WHERE 1=1 ${projectFilter}`, params);
    
    const noTrainingPersons = await runQuery(`
      SELECT p.* FROM persons p 
      WHERE 1=1 ${projectFilter}
      AND NOT EXISTS (SELECT 1 FROM trainings t WHERE t.person_id = p.id AND t.status = 'completed')
    `, params);
    
    const noBadgeReturnPersons = await runQuery(`
      SELECT p.*, b.badge_number, b.issue_date 
      FROM persons p 
      JOIN badges b ON b.person_id = p.id 
      WHERE 1=1 ${projectFilter} AND b.status != 'returned'
    `, params);
    
    const exitedWithBadge = await runQuery(`
      SELECT p.*, e.exit_date, b.badge_number
      FROM persons p
      JOIN exits e ON e.person_id = p.id
      JOIN badges b ON b.person_id = p.id
      WHERE 1=1 ${projectFilter} AND b.status != 'returned' AND e.badge_returned = 0
    `, params);
    
    const projects = await runQuery('SELECT DISTINCT project FROM persons WHERE project IS NOT NULL AND project != ""');
    
    const recentEntries = await runQuery(`
      SELECT p.name, p.project, e.entry_date, e.position
      FROM entries e
      JOIN persons p ON p.id = e.person_id
      WHERE 1=1 ${projectFilter}
      ORDER BY e.entry_date DESC
      LIMIT 10
    `, params);
    
    res.json({
      totalPersons: totalPersons[0].count,
      noTrainingPersons,
      noBadgeReturnPersons,
      exitedWithBadge,
      projects: projects.map(p => p.project),
      recentEntries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { project, type } = req.query;
    
    let projectFilter = '';
    let params = [];
    if (project) {
      projectFilter = 'AND p.project = ?';
      params.push(project);
    }
    
    let data;
    if (type === 'noTraining') {
      data = await runQuery(`
        SELECT p.id_card as 身份证, p.name as 姓名, p.outsourcing_company as 外包公司, p.project as 项目, p.phone as 电话
        FROM persons p 
        WHERE 1=1 ${projectFilter}
        AND NOT EXISTS (SELECT 1 FROM trainings t WHERE t.person_id = p.id AND t.status = 'completed')
      `, params);
    } else if (type === 'noBadgeReturn') {
      data = await runQuery(`
        SELECT p.id_card as 身份证, p.name as 姓名, b.badge_number as 工牌号, b.issue_date as 发放日期, p.project as 项目
        FROM persons p 
        JOIN badges b ON b.person_id = p.id 
        WHERE 1=1 ${projectFilter} AND b.status != 'returned'
      `, params);
    } else {
      data = await runQuery(`
        SELECT 
          p.id_card as 身份证,
          p.name as 姓名,
          p.outsourcing_company as 外包公司,
          p.project as 项目,
          p.phone as 电话,
          (SELECT COUNT(*) FROM trainings t WHERE t.person_id = p.id AND t.status = 'completed') as 已完成培训,
          (SELECT COUNT(*) FROM badges b WHERE b.person_id = b.id AND b.status = 'issued') as 有效工牌,
          (SELECT MAX(entry_date) FROM entries e WHERE e.person_id = p.id) as 最后入场日期,
          (SELECT MAX(exit_date) FROM exits ex WHERE ex.person_id = p.id) as 最后离场日期
        FROM persons p 
        WHERE 1=1 ${projectFilter}
        ORDER BY p.created_at DESC
      `, params);
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '数据');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=export_${type || 'all'}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/badges', async (req, res) => {
  try {
    const badges = await runQuery(`
      SELECT b.*, p.name, p.project 
      FROM badges b 
      JOIN persons p ON p.id = b.person_id 
      ORDER BY b.created_at DESC
    `);
    res.json(badges);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/trainings', async (req, res) => {
  try {
    const trainings = await runQuery(`
      SELECT t.*, p.name, p.project 
      FROM trainings t 
      JOIN persons p ON p.id = t.person_id 
      ORDER BY t.created_at DESC
    `);
    res.json(trainings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
