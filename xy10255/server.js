const express = require('express');
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
const { initDatabase, getDatabase, saveDatabase, DB_DATA_PATH } = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = null;

async function startServer() {
  db = await initDatabase();
  
  app.listen(PORT, () => {
    console.log(`早教中心课包消课台服务已启动: http://localhost:${PORT}`);
    console.log(`请在浏览器中访问 http://localhost:${PORT} 查看应用`);
  });
}

function logHistory(recordType, recordId, action, details = null) {
  const detailsValue = details ? JSON.stringify(details) : null;
  db.run(`
    INSERT INTO history (record_type, record_id, action, details)
    VALUES (?, ?, ?, ?)
  `, [recordType, recordId, action, detailsValue]);
  saveDatabase();
}

function getRemainingClasses(pkg) {
  return pkg.total_classes - pkg.used_classes - pkg.frozen_classes;
}

function calculatePackageStatus(pkg) {
  const remaining = getRemainingClasses(pkg);
  
  if (remaining <= 0) return 'completed';
  if (pkg.status === 'frozen') return 'frozen';
  
  const today = new Date();
  if (pkg.expire_date) {
    const expireDate = new Date(pkg.expire_date);
    if (expireDate < today) return 'expired';
    
    const daysToExpire = Math.ceil((expireDate - today) / (1000 * 60 * 60 * 24));
    if (daysToExpire <= 7) return 'expiring_soon';
  }
  
  if (remaining <= 3) return 'low_remaining';
  
  return 'active';
}

function getLastInsertId() {
  const stmt = db.exec('SELECT last_insert_rowid() as id');
  return stmt[0]?.values[0][0];
}

app.get('/api/children', (req, res) => {
  const result = db.exec('SELECT * FROM children ORDER BY created_at DESC');
  const children = result.length > 0 ? result[0].values.map(row => {
    const columns = result[0].columns;
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }) : [];
  res.json(children);
});

app.post('/api/children', (req, res) => {
  const { name, birth_date, parent_name, parent_phone } = req.body;
  db.run(`
    INSERT INTO children (name, birth_date, parent_name, parent_phone)
    VALUES (?, ?, ?, ?)
  `, [name, birth_date, parent_name, parent_phone]);
  const id = getLastInsertId();
  logHistory('child', id, 'create', { name, parent_name });
  saveDatabase();
  res.json({ id });
});

app.get('/api/courses', (req, res) => {
  const result = db.exec('SELECT * FROM courses ORDER BY created_at DESC');
  const courses = result.length > 0 ? result[0].values.map(row => {
    const columns = result[0].columns;
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  }) : [];
  res.json(courses);
});

app.post('/api/courses', (req, res) => {
  const { name, duration, description } = req.body;
  db.run(`
    INSERT INTO courses (name, duration, description)
    VALUES (?, ?, ?)
  `, [name, duration || 1, description]);
  const id = getLastInsertId();
  logHistory('course', id, 'create', { name, duration });
  saveDatabase();
  res.json({ id });
});

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

app.get('/api/packages', (req, res) => {
  const packages = queryAll(`
    SELECT p.*, 
           c.name as child_name,
           co.name as course_name
    FROM packages p
    JOIN children c ON p.child_id = c.id
    JOIN courses co ON p.course_id = co.id
    ORDER BY p.created_at DESC
  `);
  
  const enriched = packages.map(pkg => ({
    ...pkg,
    remaining_classes: getRemainingClasses(pkg),
    computed_status: calculatePackageStatus(pkg)
  }));
  
  res.json(enriched);
});

app.get('/api/packages/:id', (req, res) => {
  const pkg = queryOne(`
    SELECT p.*, 
           c.name as child_name,
           co.name as course_name
    FROM packages p
    JOIN children c ON p.child_id = c.id
    JOIN courses co ON p.course_id = co.id
    WHERE p.id = ?
  `, [req.params.id]);
  
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  res.json({
    ...pkg,
    remaining_classes: getRemainingClasses(pkg),
    computed_status: calculatePackageStatus(pkg)
  });
});

app.post('/api/packages', (req, res) => {
  const { child_id, course_id, total_classes, purchase_date, expire_date } = req.body;
  
  db.run(`
    INSERT INTO packages (child_id, course_id, total_classes, purchase_date, expire_date)
    VALUES (?, ?, ?, ?, ?)
  `, [child_id, course_id, total_classes, purchase_date, expire_date]);
  const id = getLastInsertId();
  logHistory('package', id, 'create', {
    child_id, course_id, total_classes, purchase_date, expire_date
  });
  saveDatabase();
  res.json({ id });
});

app.post('/api/attendances', (req, res) => {
  const { package_id, class_date, class_time, note } = req.body;
  
  const pkg = queryOne('SELECT * FROM packages WHERE id = ?', [package_id]);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  const remaining = getRemainingClasses(pkg);
  if (remaining <= 0) {
    return res.status(400).json({ error: 'No remaining classes available' });
  }
  
  if (pkg.status === 'frozen') {
    return res.status(400).json({ error: 'Package is currently frozen' });
  }
  
  try {
    db.run(`
      INSERT INTO attendances (package_id, child_id, course_id, class_date, class_time, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [package_id, pkg.child_id, pkg.course_id, class_date, class_time, note]);
    const attendanceId = getLastInsertId();
    
    db.run(`
      UPDATE packages 
      SET used_classes = used_classes + 1, updated_at = datetime('now')
      WHERE id = ?
    `, [package_id]);
    
    logHistory('attendance', attendanceId, 'create', {
      package_id, class_date, class_time
    });
    logHistory('package', package_id, 'consume', {
      classes_used: 1,
      previous_used: pkg.used_classes,
      new_used: pkg.used_classes + 1
    });
    saveDatabase();
    
    res.json({ id: attendanceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leaves', (req, res) => {
  const { package_id, leave_date, reason, classes_count } = req.body;
  
  const pkg = queryOne('SELECT * FROM packages WHERE id = ?', [package_id]);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  const count = classes_count || 1;
  const remaining = getRemainingClasses(pkg);
  if (remaining < count) {
    return res.status(400).json({ error: 'Not enough remaining classes' });
  }
  
  try {
    db.run(`
      INSERT INTO leaves (package_id, child_id, course_id, leave_date, reason, classes_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [package_id, pkg.child_id, pkg.course_id, leave_date, reason, count]);
    const leaveId = getLastInsertId();
    
    db.run(`
      UPDATE packages 
      SET frozen_classes = frozen_classes + ?, updated_at = datetime('now')
      WHERE id = ?
    `, [count, package_id]);
    
    logHistory('leave', leaveId, 'create', {
      package_id, leave_date, classes_count: count
    });
    logHistory('package', package_id, 'freeze_leave', {
      classes_frozen: count,
      previous_frozen: pkg.frozen_classes,
      new_frozen: pkg.frozen_classes + count
    });
    saveDatabase();
    
    res.json({ id: leaveId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freezes', (req, res) => {
  const { package_id, start_date, end_date, reason } = req.body;
  
  const pkg = queryOne('SELECT * FROM packages WHERE id = ?', [package_id]);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  const remaining = getRemainingClasses(pkg);
  
  try {
    db.run(`
      INSERT INTO freezes (package_id, child_id, course_id, start_date, end_date, reason, classes_frozen)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [package_id, pkg.child_id, pkg.course_id, start_date, end_date, reason, remaining]);
    const freezeId = getLastInsertId();
    
    db.run(`
      UPDATE packages 
      SET frozen_classes = frozen_classes + ?, status = 'frozen', updated_at = datetime('now')
      WHERE id = ?
    `, [remaining, package_id]);
    
    logHistory('freeze', freezeId, 'create', {
      package_id, start_date, end_date, classes_frozen: remaining
    });
    logHistory('package', package_id, 'freeze', {
      classes_frozen: remaining,
      status: 'frozen'
    });
    saveDatabase();
    
    res.json({ id: freezeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/freezes/:id/unfreeze', (req, res) => {
  const freeze = queryOne('SELECT * FROM freezes WHERE id = ?', [req.params.id]);
  if (!freeze) return res.status(404).json({ error: 'Freeze not found' });
  if (freeze.status !== 'active') return res.status(400).json({ error: 'Freeze is not active' });
  
  const pkg = queryOne('SELECT * FROM packages WHERE id = ?', [freeze.package_id]);
  
  try {
    db.run(`
      UPDATE freezes 
      SET status = 'completed', updated_at = datetime('now')
      WHERE id = ?
    `, [req.params.id]);
    
    db.run(`
      UPDATE packages 
      SET frozen_classes = frozen_classes - ?, status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `, [freeze.classes_frozen, freeze.package_id]);
    
    logHistory('freeze', freeze.id, 'unfreeze', {
      classes_unfrozen: freeze.classes_frozen
    });
    logHistory('package', freeze.package_id, 'unfreeze', {
      classes_unfrozen: freeze.classes_frozen,
      status: 'active'
    });
    saveDatabase();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages/:id/history', (req, res) => {
  const history = queryAll(`
    SELECT * FROM history 
    WHERE record_id = ? AND record_type = 'package'
    ORDER BY timestamp DESC
  `, [req.params.id]);
  
  res.json(history);
});

app.get('/api/packages/:id/attendances', (req, res) => {
  const attendances = queryAll(`
    SELECT * FROM attendances 
    WHERE package_id = ?
    ORDER BY class_date DESC, class_time DESC
  `, [req.params.id]);
  
  res.json(attendances);
});

app.get('/api/packages/:id/leaves', (req, res) => {
  const leaves = queryAll(`
    SELECT * FROM leaves 
    WHERE package_id = ?
    ORDER BY leave_date DESC
  `, [req.params.id]);
  
  res.json(leaves);
});

app.get('/api/packages/:id/freezes', (req, res) => {
  const freezes = queryAll(`
    SELECT * FROM freezes 
    WHERE package_id = ?
    ORDER BY start_date DESC
  `, [req.params.id]);
  
  res.json(freezes);
});

app.get('/api/dashboard', (req, res) => {
  const totalPackages = queryOne('SELECT COUNT(*) as count FROM packages')?.count || 0;
  const activePackages = queryOne("SELECT COUNT(*) as count FROM packages WHERE status = 'active'")?.count || 0;
  const frozenPackages = queryOne("SELECT COUNT(*) as count FROM packages WHERE status = 'frozen'")?.count || 0;
  const totalAttendances = queryOne('SELECT COUNT(*) as count FROM attendances')?.count || 0;
  const totalLeaves = queryOne('SELECT COUNT(*) as count FROM leaves')?.count || 0;
  
  const recentActivities = queryAll(`
    SELECT h.*,
           CASE 
             WHEN h.record_type = 'package' THEN '课包'
             WHEN h.record_type = 'attendance' THEN '签到'
             WHEN h.record_type = 'leave' THEN '请假'
             WHEN h.record_type = 'freeze' THEN '冻结'
             ELSE h.record_type
           END as type_name,
           CASE 
             WHEN h.action = 'create' THEN '创建'
             WHEN h.action = 'consume' THEN '消课'
             WHEN h.action = 'freeze' THEN '冻结'
             WHEN h.action = 'unfreeze' THEN '解冻'
             WHEN h.action = 'freeze_leave' THEN '请假冻结'
             ELSE h.action
           END as action_name
    FROM history h
    ORDER BY h.timestamp DESC
    LIMIT 20
  `);
  
  res.json({
    total_packages: totalPackages,
    active_packages: activePackages,
    frozen_packages: frozenPackages,
    total_attendances: totalAttendances,
    total_leaves: totalLeaves,
    recent_activities: recentActivities
  });
});

app.get('/api/export/packages', async (req, res) => {
  const packages = queryAll(`
    SELECT p.*, 
           c.name as child_name,
           co.name as course_name
    FROM packages p
    JOIN children c ON p.child_id = c.id
    JOIN courses co ON p.course_id = co.id
    ORDER BY p.created_at DESC
  `);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('课包列表');
  
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '孩子姓名', key: 'child_name', width: 15 },
    { header: '课程名称', key: 'course_name', width: 20 },
    { header: '总课时', key: 'total_classes', width: 10 },
    { header: '已消课', key: 'used_classes', width: 10 },
    { header: '冻结中', key: 'frozen_classes', width: 10 },
    { header: '剩余课时', key: 'remaining', width: 10 },
    { header: '购买日期', key: 'purchase_date', width: 12 },
    { header: '到期日期', key: 'expire_date', width: 12 },
    { header: '状态', key: 'status', width: 12 }
  ];
  
  packages.forEach(pkg => {
    worksheet.addRow({
      ...pkg,
      remaining: getRemainingClasses(pkg),
      status: calculatePackageStatus(pkg)
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=packages.xlsx');
  
  await workbook.xlsx.write(res);
  res.end();
});

app.get('/api/export/reconciliation/:packageId', async (req, res) => {
  const pkg = queryOne(`
    SELECT p.*, 
           c.name as child_name,
           co.name as course_name
    FROM packages p
    JOIN children c ON p.child_id = c.id
    JOIN courses co ON p.course_id = co.id
    WHERE p.id = ?
  `, [req.params.packageId]);
  
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  const attendances = queryAll(`
    SELECT * FROM attendances WHERE package_id = ? ORDER BY class_date
  `, [req.params.packageId]);
  
  const leaves = queryAll(`
    SELECT * FROM leaves WHERE package_id = ? ORDER BY leave_date
  `, [req.params.packageId]);
  
  const freezes = queryAll(`
    SELECT * FROM freezes WHERE package_id = ? ORDER BY start_date
  `, [req.params.packageId]);
  
  const history = queryAll(`
    SELECT * FROM history 
    WHERE record_id = ? AND record_type = 'package'
    ORDER BY timestamp
  `, [req.params.packageId]);
  
  const workbook = new ExcelJS.Workbook();
  
  const summarySheet = workbook.addWorksheet('对账摘要');
  summarySheet.columns = [
    { header: '项目', key: 'item', width: 20 },
    { header: '详情', key: 'detail', width: 40 }
  ];
  
  summarySheet.addRows([
    { item: '孩子姓名', detail: pkg.child_name },
    { item: '课程名称', detail: pkg.course_name },
    { item: '总课时', detail: pkg.total_classes },
    { item: '已消课时', detail: pkg.used_classes },
    { item: '冻结课时', detail: pkg.frozen_classes },
    { item: '剩余课时', detail: getRemainingClasses(pkg) },
    { item: '购买日期', detail: pkg.purchase_date },
    { item: '到期日期', detail: pkg.expire_date || '无' },
    { item: '当前状态', detail: calculatePackageStatus(pkg) }
  ]);
  summarySheet.getRow(1).font = { bold: true };
  
  const attendanceSheet = workbook.addWorksheet('签到记录');
  attendanceSheet.columns = [
    { header: '日期', key: 'class_date', width: 12 },
    { header: '时间', key: 'class_time', width: 10 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'note', width: 30 }
  ];
  if (attendances.length > 0) {
    attendanceSheet.addRows(attendances);
  }
  attendanceSheet.getRow(1).font = { bold: true };
  
  const leaveSheet = workbook.addWorksheet('请假记录');
  leaveSheet.columns = [
    { header: '日期', key: 'leave_date', width: 12 },
    { header: '课时数', key: 'classes_count', width: 10 },
    { header: '原因', key: 'reason', width: 30 }
  ];
  if (leaves.length > 0) {
    leaveSheet.addRows(leaves);
  }
  leaveSheet.getRow(1).font = { bold: true };
  
  const freezeSheet = workbook.addWorksheet('冻结记录');
  freezeSheet.columns = [
    { header: '开始日期', key: 'start_date', width: 12 },
    { header: '结束日期', key: 'end_date', width: 12 },
    { header: '冻结课时', key: 'classes_frozen', width: 12 },
    { header: '状态', key: 'status', width: 10 },
    { header: '原因', key: 'reason', width: 25 }
  ];
  if (freezes.length > 0) {
    freezeSheet.addRows(freezes);
  }
  freezeSheet.getRow(1).font = { bold: true };
  
  const historySheet = workbook.addWorksheet('操作历史');
  historySheet.columns = [
    { header: '时间', key: 'timestamp', width: 20 },
    { header: '操作', key: 'action', width: 15 },
    { header: '详情', key: 'details', width: 50 }
  ];
  if (history.length > 0) {
    historySheet.addRows(history.map(h => ({
      ...h,
      details: h.details ? JSON.stringify(JSON.parse(h.details)) : ''
    })));
  }
  historySheet.getRow(1).font = { bold: true };
  
  const fileName = `对账_${pkg.child_name}_${pkg.course_name}_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  
  await workbook.xlsx.write(res);
  res.end();
});

startServer();
