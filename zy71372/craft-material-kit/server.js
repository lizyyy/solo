const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'data', 'craft.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    max_students INTEGER NOT NULL DEFAULT 10,
    schedule_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned'
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    student_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'enrolled',
    enrolled_at TEXT DEFAULT (datetime('now','localtime')),
    withdrawn_at TEXT,
    material_deducted INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '个',
    stock_qty REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS course_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    material_id INTEGER NOT NULL REFERENCES materials(id),
    qty_per_person REAL NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS substitution_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_material_id INTEGER NOT NULL REFERENCES materials(id),
    substitute_material_id INTEGER NOT NULL REFERENCES materials(id),
    conversion_ratio REAL NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL REFERENCES materials(id),
    qty REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    arrived_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    related_course_id INTEGER REFERENCES courses(id),
    related_material_id INTEGER REFERENCES materials(id),
    resolved INTEGER NOT NULL DEFAULT 0,
    auto_reason TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS stock_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    material_id INTEGER NOT NULL REFERENCES materials(id),
    qty REAL NOT NULL,
    enrollment_count INTEGER NOT NULL,
    substituted INTEGER DEFAULT 0,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

function addConflict(type, description, courseId, materialId, autoReason) {
  const existing = db.prepare(
    `SELECT id FROM conflicts WHERE type = ? AND description = ? AND resolved = 0`
  ).get(type, description);
  if (existing) return existing.id;
  return db.prepare(
    `INSERT INTO conflicts (type, description, related_course_id, related_material_id, auto_reason) VALUES (?, ?, ?, ?, ?)`
  ).run(type, description, courseId || null, materialId || null, autoReason || null).lastInsertRowid;
}

function recalcAndCheck(courseId) {
  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(courseId);
  if (!course) return;

  db.prepare(`DELETE FROM conflicts WHERE type = 'insufficient_stock' AND related_course_id = ? AND resolved = 0`).run(courseId);

  const enrolledCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`
  ).get(courseId).cnt;

  if (enrolledCount === 0) return;

  const courseMats = db.prepare(
    `SELECT cm.*, m.name as material_name, m.unit FROM course_materials cm JOIN materials m ON cm.material_id = m.id WHERE cm.course_id = ?`
  ).all(courseId);

  const deductions = db.prepare(`SELECT * FROM stock_deductions WHERE course_id = ?`).all(courseId);

  for (const cm of courseMats) {
    const needed = enrolledCount * cm.qty_per_person;

    const origDeducted = deductions
      .filter(d => d.material_id === cm.material_id && !d.substituted)
      .reduce((sum, d) => sum + d.qty, 0);

    const subRule = db.prepare(
      `SELECT * FROM substitution_rules WHERE original_material_id = ? AND active = 1`
    ).get(cm.material_id);

    let subDeductedEquivalent = 0;
    let subMatInfo = null;
    if (subRule) {
      const subDeducted = deductions
        .filter(d => d.material_id === subRule.substitute_material_id && d.substituted)
        .reduce((sum, d) => sum + d.qty, 0);
      subDeductedEquivalent = subDeducted / subRule.conversion_ratio;
      const subMat = db.prepare(`SELECT * FROM materials WHERE id = ?`).get(subRule.substitute_material_id);
      subMatInfo = { name: subMat.name, deducted: subDeducted, stock: subMat.stock_qty };
    }

    const totalFulfilled = origDeducted + subDeductedEquivalent;

    if (totalFulfilled < needed) {
      const shortage = (needed - totalFulfilled).toFixed(1);

      if (subMatInfo) {
        addConflict(
          'insufficient_stock',
          `课程"${course.name}"需要${cm.material_name}${needed}${cm.unit}，原材提供${origDeducted}，替代品${subMatInfo.name}等价提供${subDeductedEquivalent.toFixed(1)}，总缺口${shortage}${cm.unit}`,
          courseId,
          cm.material_id,
          `原材扣${origDeducted}+替代等价${subDeductedEquivalent.toFixed(1)}=${totalFulfilled.toFixed(1)}，需${needed}，缺口${shortage}`
        );
      } else {
        addConflict(
          'insufficient_stock',
          `课程"${course.name}"需要${cm.material_name}${needed}${cm.unit}，仅提供${origDeducted}${cm.unit}，缺口${shortage}${cm.unit}`,
          courseId,
          cm.material_id,
          `库存不足：需${needed}${cm.unit}，仅能提供${origDeducted}${cm.unit}，无替代规则`
        );
      }
    }
  }
}

app.get('/api/courses', (req, res) => {
  const courses = db.prepare(`SELECT * FROM courses ORDER BY schedule_date DESC`).all();
  for (const c of courses) {
    c.enrolled_count = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`).get(c.id).cnt;
  }
  res.json(courses);
});

app.post('/api/courses', (req, res) => {
  const { name, max_students, schedule_date } = req.body;
  if (!name || !schedule_date) return res.status(400).json({ error: '课程名和日期必填' });
  const r = db.prepare(`INSERT INTO courses (name, max_students, schedule_date) VALUES (?, ?, ?)`).run(name, max_students || 10, schedule_date);
  res.json({ id: r.lastInsertRowid, name, max_students: max_students || 10, schedule_date, status: 'planned', enrolled_count: 0 });
});

app.put('/api/courses/:id', (req, res) => {
  const { name, max_students, schedule_date, status } = req.body;
  db.prepare(`UPDATE courses SET name=COALESCE(?,name), max_students=COALESCE(?,max_students), schedule_date=COALESCE(?,schedule_date), status=COALESCE(?,status) WHERE id=?`)
    .run(name, max_students, schedule_date, status, req.params.id);
  deductMaterialsForCourse(parseInt(req.params.id));
  recalcAndCheck(parseInt(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/courses/:id', (req, res) => {
  const hasEnrolled = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`).get(req.params.id).cnt;
  if (hasEnrolled > 0) {
    return res.status(400).json({ error: '该课程尚有已报名学员，无法删除' });
  }
  db.prepare(`DELETE FROM stock_deductions WHERE course_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM course_materials WHERE course_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM enrollments WHERE course_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM conflicts WHERE related_course_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM courses WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/courses/:id/materials', (req, res) => {
  const rows = db.prepare(
    `SELECT cm.*, m.name as material_name, m.unit, m.stock_qty FROM course_materials cm JOIN materials m ON cm.material_id = m.id WHERE cm.course_id = ?`
  ).all(req.params.id);
  res.json(rows);
});

app.post('/api/courses/:id/materials', (req, res) => {
  const { material_id, qty_per_person } = req.body;
  if (!material_id || !qty_per_person) return res.status(400).json({ error: '材料和用量必填' });
  const cid = parseInt(req.params.id);
  const existing = db.prepare(`SELECT * FROM course_materials WHERE course_id = ? AND material_id = ?`).get(cid, material_id);
  if (existing) {
    db.prepare(`UPDATE course_materials SET qty_per_person = ? WHERE id = ?`).run(qty_per_person, existing.id);
  } else {
    db.prepare(`INSERT INTO course_materials (course_id, material_id, qty_per_person) VALUES (?, ?, ?)`).run(cid, material_id, qty_per_person);
  }
  deductMaterialsForCourse(cid);
  recalcAndCheck(cid);
  res.json({ id: existing ? existing.id : null, updated: !!existing });
});

app.delete('/api/courses/:courseId/materials/:matId', (req, res) => {
  const cid = parseInt(req.params.courseId);
  db.prepare(`DELETE FROM course_materials WHERE course_id = ? AND material_id = ?`).run(cid, req.params.matId);
  deductMaterialsForCourse(cid);
  recalcAndCheck(cid);
  res.json({ ok: true });
});

app.get('/api/enrollments', (req, res) => {
  const { course_id } = req.query;
  let rows;
  if (course_id) {
    rows = db.prepare(`SELECT e.*, c.name as course_name FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.course_id = ? ORDER BY e.enrolled_at DESC`).all(course_id);
  } else {
    rows = db.prepare(`SELECT e.*, c.name as course_name FROM enrollments e JOIN courses c ON e.course_id = c.id ORDER BY e.enrolled_at DESC`).all();
  }
  res.json(rows);
});

app.post('/api/enrollments', (req, res) => {
  const { course_id, student_name } = req.body;
  if (!course_id || !student_name) return res.status(400).json({ error: '课程和学生名必填' });

  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(course_id);
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const enrolledCount = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`).get(course_id).cnt;
  if (enrolledCount >= course.max_students) {
    addConflict('over_capacity', `课程"${course.name}"已满(${enrolledCount}/${course.max_students})，${student_name}无法加入`, course_id, null, `报名人数已达上限${course.max_students}`);
    return res.status(400).json({ error: `课程已满(${enrolledCount}/${course.max_students})` });
  }

  const r = db.prepare(`INSERT INTO enrollments (course_id, student_name, status) VALUES (?, ?, 'enrolled')`).run(course_id, student_name);

  deductMaterialsForCourse(course_id);

  recalcAndCheck(course_id);
  res.json({ id: r.lastInsertRowid, course_id, student_name, status: 'enrolled' });
});

app.put('/api/enrollments/:id/withdraw', (req, res) => {
  const enrollment = db.prepare(`SELECT * FROM enrollments WHERE id = ?`).get(req.params.id);
  if (!enrollment) return res.status(404).json({ error: '报名记录不存在' });
  if (enrollment.status === 'withdrawn') return res.status(400).json({ error: '该学员已退课' });

  db.prepare(`UPDATE enrollments SET status = 'withdrawn', withdrawn_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);

  if (enrollment.material_deducted) {
    addConflict(
      'withdraw_no_rollback',
      `学员"${enrollment.student_name}"从课程退课，但材料已扣减未回滚`,
      enrollment.course_id,
      null,
      `退课时材料已扣减（material_deducted=1），需人工确认是否回滚库存`
    );
  }

  recalcAndCheck(enrollment.course_id);
  const result = db.prepare(`SELECT * FROM enrollments WHERE id = ?`).get(req.params.id);
  res.json(result);
});

app.post('/api/enrollments/:id/rollback-materials', (req, res) => {
  const enrollment = db.prepare(`SELECT * FROM enrollments WHERE id = ?`).get(req.params.id);
  if (!enrollment) return res.status(404).json({ error: '报名记录不存在' });
  if (enrollment.status !== 'withdrawn') return res.status(400).json({ error: '仅退课学员可回滚材料' });
  if (!enrollment.material_deducted) return res.status(400).json({ error: '材料未扣减，无需回滚' });

  const oldDeductions = db.prepare(`SELECT material_id, SUM(qty) as total_qty FROM stock_deductions WHERE course_id = ? GROUP BY material_id`).all(enrollment.course_id);
  const rollbackResults = [];
  for (const od of oldDeductions) {
    rollbackResults.push({ material_id: od.material_id, previous_deducted: od.total_qty });
  }

  deductMaterialsForCourse(enrollment.course_id);

  const newDeductions = db.prepare(`SELECT material_id, SUM(qty) as total_qty FROM stock_deductions WHERE course_id = ? GROUP BY material_id`).all(enrollment.course_id);
  for (const r of rollbackResults) {
    const nd = newDeductions.find(n => n.material_id === r.material_id);
    r.returned_qty = r.previous_deducted - (nd ? nd.total_qty : 0);
    delete r.previous_deducted;
  }

  db.prepare(`UPDATE enrollments SET material_deducted = 0 WHERE id = ?`).run(req.params.id);

  db.prepare(`DELETE FROM conflicts WHERE type = 'withdraw_no_rollback' AND related_course_id = ? AND resolved = 0`).run(enrollment.course_id);

  recalcAndCheck(enrollment.course_id);
  res.json({ ok: true, rollback_results: rollbackResults, auto_reason: rollbackResults.some(r => r.returned_qty > 0) ? `已回滚${rollbackResults.filter(r => r.returned_qty > 0).length}种材料到库存` : '无需回滚' });
});

function deductMaterialsForCourse(courseId) {
  const enrolledCount = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`).get(courseId).cnt;

  const oldDeductions = db.prepare(`SELECT material_id, SUM(qty) as total_qty FROM stock_deductions WHERE course_id = ? GROUP BY material_id`).all(courseId);
  for (const od of oldDeductions) {
    db.prepare(`UPDATE materials SET stock_qty = stock_qty + ? WHERE id = ?`).run(od.total_qty, od.material_id);
  }
  db.prepare(`DELETE FROM stock_deductions WHERE course_id = ?`).run(courseId);

  if (enrolledCount === 0) {
    db.prepare(`UPDATE enrollments SET material_deducted = 0 WHERE course_id = ? AND status = 'enrolled'`).run(courseId);
    return;
  }

  const courseMats = db.prepare(
    `SELECT cm.*, m.name as material_name, m.stock_qty, m.unit FROM course_materials cm JOIN materials m ON cm.material_id = m.id WHERE cm.course_id = ?`
  ).all(courseId);

  for (const cm of courseMats) {
    const needed = enrolledCount * cm.qty_per_person;

    const subRule = db.prepare(
      `SELECT * FROM substitution_rules WHERE original_material_id = ? AND active = 1`
    ).get(cm.material_id);

    if (cm.stock_qty >= needed) {
      db.prepare(`UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?`).run(needed, cm.material_id);
      db.prepare(`INSERT INTO stock_deductions (course_id, material_id, qty, enrollment_count, substituted, reason) VALUES (?, ?, ?, ?, 0, ?)`)
        .run(courseId, cm.material_id, needed, enrolledCount, `按${enrolledCount}人扣减${cm.material_name}，每人${cm.qty_per_person}`);
    } else if (subRule) {
      const subMat = db.prepare(`SELECT * FROM materials WHERE id = ?`).get(subRule.substitute_material_id);
      const subNeeded = needed * subRule.conversion_ratio;

      if (cm.stock_qty > 0) {
        db.prepare(`UPDATE materials SET stock_qty = 0 WHERE id = ?`).run(cm.material_id);
        const remainingNeed = (needed - cm.stock_qty) * subRule.conversion_ratio;
        db.prepare(`UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?`).run(remainingNeed, subRule.substitute_material_id);
        db.prepare(`INSERT INTO stock_deductions (course_id, material_id, qty, enrollment_count, substituted, reason) VALUES (?, ?, ?, ?, 1, ?)`)
          .run(courseId, subRule.substitute_material_id, remainingNeed, enrolledCount, `原材${cm.material_name}不足，先用库存${cm.stock_qty}，剩余用替代品${subMat.name}补足（比例${subRule.conversion_ratio}）`);
        db.prepare(`INSERT INTO stock_deductions (course_id, material_id, qty, enrollment_count, substituted, reason) VALUES (?, ?, ?, ?, 0, ?)`)
          .run(courseId, cm.material_id, cm.stock_qty, enrolledCount, `原材${cm.material_name}部分使用${cm.stock_qty}`);
      } else {
        db.prepare(`UPDATE materials SET stock_qty = stock_qty - ? WHERE id = ?`).run(subNeeded, subRule.substitute_material_id);
        db.prepare(`INSERT INTO stock_deductions (course_id, material_id, qty, enrollment_count, substituted, reason) VALUES (?, ?, ?, ?, 1, ?)`)
          .run(courseId, subRule.substitute_material_id, subNeeded, enrolledCount, `原材${cm.material_name}库存为0，全量使用替代品${subMat.name}（比例${subRule.conversion_ratio}）`);
      }
    } else {
      if (cm.stock_qty > 0) {
        db.prepare(`UPDATE materials SET stock_qty = 0 WHERE id = ?`).run(cm.material_id);
        db.prepare(`INSERT INTO stock_deductions (course_id, material_id, qty, enrollment_count, substituted, reason) VALUES (?, ?, ?, ?, 0, ?)`)
          .run(courseId, cm.material_id, cm.stock_qty, enrolledCount, `库存不足，仅能提供${cm.stock_qty}${cm.unit}，缺${(needed - cm.stock_qty).toFixed(1)}${cm.unit}`);
      }
    }
  }

  db.prepare(`UPDATE enrollments SET material_deducted = 1 WHERE course_id = ? AND status = 'enrolled'`).run(courseId);
}

app.get('/api/materials', (req, res) => {
  const rows = db.prepare(`SELECT * FROM materials ORDER BY name`).all();
  res.json(rows);
});

app.post('/api/materials', (req, res) => {
  const { name, unit, stock_qty } = req.body;
  if (!name) return res.status(400).json({ error: '材料名必填' });
  const r = db.prepare(`INSERT INTO materials (name, unit, stock_qty) VALUES (?, ?, ?)`).run(name, unit || '个', stock_qty || 0);
  res.json({ id: r.lastInsertRowid, name, unit: unit || '个', stock_qty: stock_qty || 0 });
});

app.put('/api/materials/:id', (req, res) => {
  const { name, unit, stock_qty } = req.body;
  const mid = parseInt(req.params.id);
  db.prepare(`UPDATE materials SET name=COALESCE(?,name), unit=COALESCE(?,unit), stock_qty=COALESCE(?,stock_qty) WHERE id=?`)
    .run(name, unit, stock_qty, mid);

  if (stock_qty !== undefined) {
    const affectedCourses = db.prepare(
      `SELECT DISTINCT sd.course_id FROM stock_deductions sd WHERE sd.material_id = ?`
    ).all(mid);
    const subCourses = db.prepare(
      `SELECT DISTINCT sd.course_id FROM stock_deductions sd JOIN substitution_rules sr ON sd.material_id = sr.substitute_material_id AND sr.original_material_id = ? WHERE sd.substituted = 1`
    ).all(mid);
    const courseIds = new Set([...affectedCourses.map(c => c.course_id), ...subCourses.map(c => c.course_id)]);
    for (const cid of courseIds) {
      deductMaterialsForCourse(cid);
      recalcAndCheck(cid);
    }
  }

  res.json({ ok: true });
});

app.delete('/api/materials/:id', (req, res) => {
  const inUse = db.prepare(`SELECT COUNT(*) as cnt FROM course_materials WHERE material_id = ?`).get(req.params.id).cnt;
  if (inUse > 0) return res.status(400).json({ error: '该材料被课程使用中，无法删除' });
  db.prepare(`DELETE FROM substitution_rules WHERE original_material_id = ? OR substitute_material_id = ?`).run(req.params.id, req.params.id);
  db.prepare(`DELETE FROM purchase_orders WHERE material_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM stock_deductions WHERE material_id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM materials WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/substitution-rules', (req, res) => {
  const rows = db.prepare(
    `SELECT sr.*, m1.name as original_name, m1.unit as original_unit, m2.name as substitute_name, m2.unit as substitute_unit FROM substitution_rules sr JOIN materials m1 ON sr.original_material_id = m1.id JOIN materials m2 ON sr.substitute_material_id = m2.id ORDER BY sr.id`
  ).all();
  res.json(rows);
});

app.post('/api/substitution-rules', (req, res) => {
  const { original_material_id, substitute_material_id, conversion_ratio, reason } = req.body;
  if (!original_material_id || !substitute_material_id || !reason) return res.status(400).json({ error: '原材、替代品和原因必填' });
  if (original_material_id === substitute_material_id) return res.status(400).json({ error: '原材和替代品不能相同' });

  const existing = db.prepare(`SELECT * FROM substitution_rules WHERE original_material_id = ? AND active = 1`).get(original_material_id);
  if (existing) {
    addConflict('substitute_conflict', `材料ID${original_material_id}已存在活跃替代规则(规则ID:${existing.id})，新建规则可能冲突`, null, original_material_id, `同一种原材存在多条替代规则，需人工确认优先级`);
  }

  const r = db.prepare(`INSERT INTO substitution_rules (original_material_id, substitute_material_id, conversion_ratio, reason) VALUES (?, ?, ?, ?)`)
    .run(original_material_id, substitute_material_id, conversion_ratio || 1, reason);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/substitution-rules/:id', (req, res) => {
  const { active, conversion_ratio } = req.body;
  db.prepare(`UPDATE substitution_rules SET active=COALESCE(?,active), conversion_ratio=COALESCE(?,conversion_ratio) WHERE id=?`)
    .run(active, conversion_ratio, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/substitution-rules/:id', (req, res) => {
  db.prepare(`DELETE FROM substitution_rules WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/purchase-orders', (req, res) => {
  const rows = db.prepare(
    `SELECT po.*, m.name as material_name, m.unit FROM purchase_orders po JOIN materials m ON po.material_id = m.id ORDER BY po.created_at DESC`
  ).all();
  res.json(rows);
});

app.post('/api/purchase-orders/auto', (req, res) => {
  const results = [];

  const conflicts = db.prepare(`SELECT * FROM conflicts WHERE type = 'insufficient_stock' AND resolved = 0`).all();
  for (const c of conflicts) {
    if (!c.related_material_id) continue;
    const mat = db.prepare(`SELECT * FROM materials WHERE id = ?`).get(c.related_material_id);

    const pending = db.prepare(`SELECT SUM(qty) as total FROM purchase_orders WHERE material_id = ? AND status IN ('pending','ordered')`).get(c.related_material_id);
    if (pending && pending.total > 0) continue;

    const enrolledTotal = db.prepare(`
      SELECT SUM(cm.qty_per_person) as total_needed
      FROM course_materials cm
      JOIN enrollments e ON e.course_id = cm.course_id AND e.status = 'enrolled'
      WHERE cm.material_id = ?
    `).get(c.related_material_id);

    const needed = (enrolledTotal.total_needed || 0) - mat.stock_qty;
    if (needed > 0) {
      const r = db.prepare(`INSERT INTO purchase_orders (material_id, qty, status, reason) VALUES (?, ?, 'pending', ?)`)
        .run(c.related_material_id, needed, `自动生成：${c.auto_reason || c.description}`);
      results.push({ id: r.lastInsertRowid, material_id: c.related_material_id, qty: needed, auto_reason: `因冲突"库存不足"自动生成采购单，需补${needed}${mat.unit}` });
    }
  }

  res.json({ generated: results.length, orders: results, auto_reason: results.length > 0 ? `检测到${results.length}项库存不足冲突，已自动生成对应采购单` : '无需自动采购' });
});

app.post('/api/purchase-orders', (req, res) => {
  const { material_id, qty, reason } = req.body;
  if (!material_id || !qty) return res.status(400).json({ error: '材料和数量必填' });
  const r = db.prepare(`INSERT INTO purchase_orders (material_id, qty, status, reason) VALUES (?, ?, 'pending', ?)`)
    .run(material_id, qty, reason || '手动创建');
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/purchase-orders/:id', (req, res) => {
  const { status } = req.body;
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: '采购单不存在' });

  if (status === 'arrived' && order.status !== 'arrived') {
    db.prepare(`UPDATE materials SET stock_qty = stock_qty + ? WHERE id = ?`).run(order.qty, order.material_id);
    db.prepare(`UPDATE purchase_orders SET status = 'arrived', arrived_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM conflicts WHERE type = 'insufficient_stock' AND related_material_id = ? AND resolved = 0`).run(order.material_id);
  } else {
    db.prepare(`UPDATE purchase_orders SET status = COALESCE(?, status) WHERE id = ?`).run(status, req.params.id);
  }

  res.json({ ok: true, auto_reason: status === 'arrived' ? `采购到货，已将${order.qty}入库，并清除相关库存不足冲突` : undefined });
});

app.delete('/api/purchase-orders/:id', (req, res) => {
  const order = db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(req.params.id);
  if (order && order.status === 'arrived') return res.status(400).json({ error: '已到货采购单无法删除' });
  db.prepare(`DELETE FROM purchase_orders WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/conflicts', (req, res) => {
  const rows = db.prepare(`SELECT * FROM conflicts ORDER BY resolved ASC, created_at DESC`).all();
  res.json(rows);
});

app.put('/api/conflicts/:id/resolve', (req, res) => {
  db.prepare(`UPDATE conflicts SET resolved = 1, resolved_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/conflicts/:id/resolve-and-rollback', (req, res) => {
  const conflict = db.prepare(`SELECT * FROM conflicts WHERE id = ?`).get(req.params.id);
  if (!conflict) return res.status(404).json({ error: '冲突不存在' });

  let action = '已标记为已解决';
  if (conflict.type === 'withdraw_no_rollback' && conflict.related_course_id) {
    const enrollments = db.prepare(`SELECT * FROM enrollments WHERE course_id = ? AND status = 'withdrawn' AND material_deducted = 1`).all(conflict.related_course_id);
    for (const e of enrollments) {
      db.prepare(`UPDATE enrollments SET material_deducted = 0 WHERE id = ?`).run(e.id);
    }
    action = `已将${enrollments.length}条退课记录的材料扣减标记重置`;
  }

  db.prepare(`UPDATE conflicts SET resolved = 1, resolved_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
  res.json({ ok: true, action, auto_reason: action });
});

app.get('/api/reports/preparation/:courseId', (req, res) => {
  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(req.params.courseId);
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const enrollments = db.prepare(`SELECT * FROM enrollments WHERE course_id = ?`).all(req.params.courseId);
  const enrolledCount = enrollments.filter(e => e.status === 'enrolled').length;
  const withdrawnCount = enrollments.filter(e => e.status === 'withdrawn').length;

  const courseMats = db.prepare(
    `SELECT cm.*, m.name as material_name, m.unit, m.stock_qty FROM course_materials cm JOIN materials m ON cm.material_id = m.id WHERE cm.course_id = ?`
  ).all(req.params.courseId);

  const deductions = db.prepare(`SELECT * FROM stock_deductions WHERE course_id = ?`).all(req.params.courseId);

  const conflicts = db.prepare(`SELECT * FROM conflicts WHERE related_course_id = ? AND resolved = 0`).all(req.params.courseId);

  const materialDetails = courseMats.map(cm => {
    const needed = enrolledCount * cm.qty_per_person;
    const subRule = db.prepare(`SELECT sr.*, m.name as substitute_name FROM substitution_rules sr JOIN materials m ON sr.substitute_material_id = m.id WHERE sr.original_material_id = ? AND sr.active = 1`).get(cm.material_id);
    const deducted = deductions.filter(d => d.material_id === cm.material_id);
    const subDeducted = deductions.filter(d => d.material_id === (subRule ? subRule.substitute_material_id : -1) && d.substituted);

    return {
      material_id: cm.material_id,
      material_name: cm.material_name,
      unit: cm.unit,
      qty_per_person: cm.qty_per_person,
      enrolled_need: needed,
      current_stock: cm.stock_qty,
      stock_sufficient: cm.stock_qty >= needed,
      shortage: Math.max(0, needed - cm.stock_qty),
      substitution: subRule ? {
        substitute_name: subRule.substitute_name,
        conversion_ratio: subRule.conversion_ratio,
        substitute_needed: needed * subRule.conversion_ratio
      } : null,
      deductions: deducted,
      substitute_deductions: subDeducted
    };
  });

  const report = {
    course,
    enrolled_count: enrolledCount,
    withdrawn_count: withdrawnCount,
    materials: materialDetails,
    conflicts,
    generated_at: new Date().toISOString(),
    auto_reason: conflicts.length > 0 ? `存在${conflicts.length}项未解决冲突，请处理后重新生成` : '备料计算已完成，所有材料需求已核算'
  };

  res.json(report);
});

app.get('/api/reports/preparation/:courseId/export', (req, res) => {
  const courseId = req.params.courseId;
  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(courseId);
  if (!course) return res.status(404).json({ error: '课程不存在' });

  const enrolledCount = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'enrolled'`).get(courseId).cnt;
  const withdrawnCount = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE course_id = ? AND status = 'withdrawn'`).get(courseId).cnt;
  const courseMats = db.prepare(
    `SELECT cm.*, m.name as material_name, m.unit, m.stock_qty FROM course_materials cm JOIN materials m ON cm.material_id = m.id WHERE cm.course_id = ?`
  ).all(courseId);
  const conflicts = db.prepare(`SELECT * FROM conflicts WHERE related_course_id = ? AND resolved = 0`).all(courseId);

  let csv = '\uFEFF';
  csv += `手作课程材料包备料报告\n`;
  csv += `课程名称,${course.name}\n`;
  csv += `课程日期,${course.schedule_date}\n`;
  csv += `报名人数,${enrolledCount}\n`;
  csv += `退课人数,${withdrawnCount}\n`;
  csv += `生成时间,${new Date().toLocaleString('zh-CN')}\n\n`;
  csv += `材料名称,单位,每人用量,总需求,当前库存,是否充足,缺口数量,替代方案\n`;

  for (const cm of courseMats) {
    const needed = enrolledCount * cm.qty_per_person;
    const subRule = db.prepare(`SELECT sr.*, m.name as substitute_name FROM substitution_rules sr JOIN materials m ON sr.substitute_material_id = m.id WHERE sr.original_material_id = ? AND sr.active = 1`).get(cm.material_id);
    csv += `${cm.material_name},${cm.unit},${cm.qty_per_person},${needed},${cm.stock_qty},${cm.stock_qty >= needed ? '是' : '否'},${Math.max(0, needed - cm.stock_qty)},${subRule ? `${subRule.substitute_name}(比例${subRule.conversion_ratio})` : '无'}\n`;
  }

  if (conflicts.length > 0) {
    csv += `\n未解决冲突\n`;
    csv += `冲突类型,描述,自动判断理由\n`;
    for (const c of conflicts) {
      csv += `${c.type},${c.description},${c.auto_reason || ''}\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="备料报告_${course.name}_${course.schedule_date}.csv"`);
  res.send(csv);
});

app.get('/api/dashboard', (req, res) => {
  const courseCount = db.prepare(`SELECT COUNT(*) as cnt FROM courses`).get().cnt;
  const enrolledTotal = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE status = 'enrolled'`).get().cnt;
  const withdrawnTotal = db.prepare(`SELECT COUNT(*) as cnt FROM enrollments WHERE status = 'withdrawn'`).get().cnt;
  const materialCount = db.prepare(`SELECT COUNT(*) as cnt FROM materials`).get().cnt;
  const conflictCount = db.prepare(`SELECT COUNT(*) as cnt FROM conflicts WHERE resolved = 0`).get().cnt;
  const pendingPO = db.prepare(`SELECT COUNT(*) as cnt FROM purchase_orders WHERE status = 'pending'`).get().cnt;

  const lowStock = db.prepare(`SELECT * FROM materials WHERE stock_qty < 5 ORDER BY stock_qty ASC`).all();
  const recentConflicts = db.prepare(`SELECT * FROM conflicts WHERE resolved = 0 ORDER BY created_at DESC LIMIT 10`).all();

  res.json({
    course_count: courseCount,
    enrolled_total: enrolledTotal,
    withdrawn_total: withdrawnTotal,
    material_count: materialCount,
    conflict_count: conflictCount,
    pending_po_count: pendingPO,
    low_stock_materials: lowStock,
    recent_conflicts: recentConflicts
  });
});

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`手作课程材料包系统已启动: http://localhost:${PORT}`);
});
