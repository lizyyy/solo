const fs = require('fs');
const path = require('path');

const files = {
  'src/models/database.js': `const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/homecare.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
`,

  'src/scripts/init-db.js': `const db = require('../models/database');

function initDatabase() {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      material_hash TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      raw_data TEXT NOT NULL,
      file_name TEXT,
      uploaded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS elderly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      address TEXT,
      care_level TEXT,
      care_items TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS nurses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      skills TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      elderly_id INTEGER NOT NULL,
      nurse_id INTEGER NOT NULL,
      schedule_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      care_items TEXT,
      status TEXT DEFAULT 'scheduled',
      cancel_reason TEXT,
      cancel_type TEXT,
      last_handler TEXT,
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (elderly_id) REFERENCES elderly(id),
      FOREIGN KEY (nurse_id) REFERENCES nurses(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    );

    CREATE TABLE IF NOT EXISTS process_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    );

    CREATE INDEX IF NOT EXISTS idx_batches_hash ON batches(material_hash);
    CREATE INDEX IF NOT EXISTS idx_schedules_batch ON schedules(batch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_schedule ON audit_logs(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_trace_schedule ON process_traces(schedule_id);
  \`);
  console.log('数据库初始化完成');
}
initDatabase();
`,

  'src/utils/hash.js': `const CryptoJS = require('crypto-js');

function generateHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function generateBatchNo() {
  const date = new Date();
  const timestamp = date.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return \`BATCH-\${date.getFullYear()}\${(date.getMonth()+1).toString().padStart(2,'0')}\${date.getDate().toString().padStart(2,'0')}-\${timestamp}-\${random}\`;
}

module.exports = { generateHash, generateBatchNo };
`,

  'src/services/batchService.js': `const db = require('../models/database');
const { generateHash, generateBatchNo } = require('../utils/hash');

function createBatch(title, materialData, createdBy) {
  const materialHash = generateHash(materialData);
  const existing = db.prepare('SELECT * FROM batches WHERE material_hash = ?').get(materialHash);
  if (existing) return { isDuplicate: true, batch: existing, message: '相同材料已存在，返回原有批次' };
  const batchNo = generateBatchNo();
  const result = db.prepare("INSERT INTO batches (batch_no, material_hash, title, created_by) VALUES (?, ?, ?, ?)").run(batchNo, materialHash, title, createdBy);
  return { isDuplicate: false, batch: db.prepare('SELECT * FROM batches WHERE id = ?').get(result.lastInsertRowid), message: '批次创建成功' };
}

function getBatchById(id) { return db.prepare('SELECT * FROM batches WHERE id = ?').get(id); }
function getBatchByNo(batchNo) { return db.prepare('SELECT * FROM batches WHERE batch_no = ?').get(batchNo); }
function listBatches() { return db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all(); }

function getBatchStatistics(batchId) {
  const scheduleCount = db.prepare('SELECT COUNT(*) as count FROM schedules WHERE batch_id = ?').get(batchId);
  const elderCount = db.prepare('SELECT COUNT(*) as count FROM elderly WHERE batch_id = ?').get(batchId);
  const nurseCount = db.prepare('SELECT COUNT(*) as count FROM nurses WHERE batch_id = ?').get(batchId);
  return {
    totalSchedules: scheduleCount.count,
    totalElderly: elderCount.count,
    totalNurses: nurseCount.count
  };
}

module.exports = { createBatch, getBatchById, getBatchByNo, listBatches, getBatchStatistics };
`,

  'src/services/materialService.js': `const db = require('../models/database');
const { generateHash } = require('../utils/hash');

function addMaterial(batchId, sourceType, rawData, fileName, uploadedBy) {
  const contentHash = generateHash(rawData);
  const existing = db.prepare('SELECT * FROM materials WHERE content_hash = ?').get(contentHash);
  if (existing) return { isDuplicate: true, material: existing };
  const result = db.prepare('INSERT INTO materials (batch_id, source_type, content_hash, raw_data, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)').run(batchId, sourceType, contentHash, JSON.stringify(rawData), fileName, uploadedBy);
  return { isDuplicate: false, material: db.prepare('SELECT * FROM materials WHERE id = ?').get(result.lastInsertRowid) };
}

function parseAndSaveData(batchId, rawData) {
  const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  const elderlyIds = [], nurseIds = [];
  if (data.elderly && data.elderly.length) {
    for (const e of data.elderly) {
      const r = db.prepare('INSERT INTO elderly (batch_id, name, phone, address, care_level, care_items) VALUES (?, ?, ?, ?, ?, ?)').run(batchId, e.name, e.phone || '', e.address || '', e.care_level || '', JSON.stringify(e.care_items || []));
      elderlyIds.push(r.lastInsertRowid);
    }
  }
  if (data.nurses && data.nurses.length) {
    for (const n of data.nurses) {
      const r = db.prepare('INSERT INTO nurses (batch_id, name, phone, skills) VALUES (?, ?, ?, ?)').run(batchId, n.name, n.phone || '', JSON.stringify(n.skills || []));
      nurseIds.push(r.lastInsertRowid);
    }
  }
  return { elderlyCount: elderlyIds.length, nurseCount: nurseIds.length };
}

module.exports = { addMaterial, parseAndSaveData };
`,

  'src/services/scheduleService.js': `const db = require('../models/database');

function calculateSchedules(batchId) {
  db.prepare("DELETE FROM schedules WHERE batch_id = ? AND status = 'scheduled'").run(batchId);
  const elderly = db.prepare('SELECT * FROM elderly WHERE batch_id = ?').all(batchId);
  const nurses = db.prepare('SELECT * FROM nurses WHERE batch_id = ?').all(batchId);
  if (elderly.length === 0 || nurses.length === 0) return { scheduled: 0, message: '老人或护士数据不足' };
  const timeSlots = ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'];
  const today = new Date();
  let scheduledCount = 0;
  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    let nurseIdx = 0;
    for (let i = 0; i < elderly.length; i++) {
      const slotIdx = i % timeSlots.length;
      const nurse = nurses[nurseIdx % nurses.length];
      nurseIdx++;
      const e = elderly[i];
      const result = db.prepare('INSERT INTO schedules (batch_id, elderly_id, nurse_id, schedule_date, time_slot, care_items) VALUES (?, ?, ?, ?, ?, ?)').run(batchId, e.id, nurse.id, dateStr, timeSlots[slotIdx], e.care_items || '[]');
      db.prepare('INSERT INTO process_traces (schedule_id, action, operator, detail) VALUES (?, ?, ?, ?)').run(result.lastInsertRowid, 'schedule_created', 'system', '系统自动排班');
      scheduledCount++;
    }
  }
  db.prepare("UPDATE batches SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(batchId);
  return { scheduled: scheduledCount, message: '排班完成' };
}

function getScheduleDetail(scheduleId) {
  return db.prepare(\`
    SELECT s.*, e.name as elderly_name, e.phone as elderly_phone, e.address as elderly_address,
           n.name as nurse_name, n.phone as nurse_phone
    FROM schedules s
    JOIN elderly e ON s.elderly_id = e.id
    JOIN nurses n ON s.nurse_id = n.id
    WHERE s.id = ?
  \`).get(scheduleId);
}

function getScheduleTraces(scheduleId) {
  return db.prepare('SELECT * FROM process_traces WHERE schedule_id = ? ORDER BY created_at ASC').all(scheduleId);
}

function getScheduleAuditLogs(scheduleId) {
  return db.prepare('SELECT * FROM audit_logs WHERE schedule_id = ? ORDER BY created_at ASC').all(scheduleId);
}

function updateSchedule(scheduleId, updates, operator, reason) {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
  if (!schedule) return null;
  for (const [field, value] of Object.entries(updates)) {
    if (schedule[field] !== undefined && String(schedule[field] || '') !== String(value || '')) {
      db.prepare('INSERT INTO audit_logs (schedule_id, field_name, old_value, new_value, change_reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)').run(scheduleId, field, String(schedule[field] || ''), String(value || ''), reason, operator);
    }
  }
  const setClauses = Object.keys(updates).map(k => \`\${k} = ?\`).join(', ');
  const values = [...Object.values(updates), operator, scheduleId];
  db.prepare(\`UPDATE schedules SET \${setClauses}, last_handler = ?, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?\`).run(...values);
  db.prepare('INSERT INTO process_traces (schedule_id, action, operator, detail) VALUES (?, ?, ?, ?)').run(scheduleId, 'updated', operator, reason);
  return getScheduleDetail(scheduleId);
}

function cancelSchedule(scheduleId, cancelType, reason, operator) {
  return updateSchedule(scheduleId, { status: 'cancelled', cancel_type: cancelType, cancel_reason: reason }, operator, reason);
}

function listSchedules(batchId) {
  return db.prepare(\`
    SELECT s.*, e.name as elderly_name, n.name as nurse_name
    FROM schedules s
    JOIN elderly e ON s.elderly_id = e.id
    JOIN nurses n ON s.nurse_id = n.id
    WHERE s.batch_id = ?
    ORDER BY s.schedule_date, s.time_slot
  \`).all(batchId);
}

module.exports = { calculateSchedules, getScheduleDetail, getScheduleTraces, getScheduleAuditLogs, updateSchedule, cancelSchedule, listSchedules };
`,

  'src/services/exportService.js': `const db = require('../models/database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

function exportBatchData(batchId) {
  const schedules = db.prepare(\`
    SELECT 
      s.id,
      s.schedule_date,
      s.time_slot,
      s.status,
      s.cancel_reason,
      s.cancel_type,
      s.last_handler,
      s.handled_at,
      e.name as elderly_name,
      e.phone as elderly_phone,
      e.address as elderly_address,
      e.care_level,
      e.care_items as elderly_care_items,
      n.name as nurse_name,
      n.phone as nurse_phone
    FROM schedules s
    JOIN elderly e ON s.elderly_id = e.id
    JOIN nurses n ON s.nurse_id = n.id
    WHERE s.batch_id = ?
    ORDER BY s.schedule_date, s.time_slot
  \`).all(batchId);

  return schedules.map(s => ({
    schedule_id: s.id,
    schedule_date: s.schedule_date,
    time_slot: s.time_slot,
    status: s.status,
    nurse_name: s.nurse_name,
    nurse_phone: s.nurse_phone,
    elderly_name: s.elderly_name,
    elderly_phone: s.elderly_phone,
    elderly_address: s.elderly_address,
    care_level: s.care_level,
    care_items: s.elderly_care_items,
    cancel_type: s.cancel_type || '',
    cancel_reason: s.cancel_reason || '',
    last_handler: s.last_handler || '',
    handled_at: s.handled_at || ''
  }));
}

async function exportToCsv(batchId, outputPath) {
  const data = exportBatchData(batchId);
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      {id: 'schedule_id', title: '排班ID'},
      {id: 'schedule_date', title: '排班日期'},
      {id: 'time_slot', title: '时间段'},
      {id: 'status', title: '状态'},
      {id: 'nurse_name', title: '护士姓名'},
      {id: 'nurse_phone', title: '护士电话'},
      {id: 'elderly_name', title: '老人姓名'},
      {id: 'elderly_phone', title: '老人电话'},
      {id: 'elderly_address', title: '老人地址'},
      {id: 'care_level', title: '护理等级'},
      {id: 'care_items', title: '护理项目'},
      {id: 'cancel_type', title: '取消类型'},
      {id: 'cancel_reason', title: '取消原因'},
      {id: 'last_handler', title: '最后处理人'},
      {id: 'handled_at', title: '处理时间'}
    ]
  });
  await csvWriter.writeRecords(data);
  return { recordCount: data.length, path: outputPath };
}

module.exports = { exportBatchData, exportToCsv };
`,

  'src/routes/batches.js': `const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');

router.post('/', (req, res) => {
  const { title, material_data, created_by } = req.body;
  if (!title || !material_data || !created_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = batchService.createBatch(title, material_data, created_by);
  res.json(result);
});

router.get('/', (req, res) => {
  res.json(batchService.listBatches());
});

router.get('/:id', (req, res) => {
  const batch = batchService.getBatchById(req.params.id);
  if (!batch) return res.status(404).json({ error: '批次不存在' });
  res.json(batch);
});

router.get('/:id/statistics', (req, res) => {
  const stats = batchService.getBatchStatistics(req.params.id);
  res.json(stats);
});

module.exports = router;
`,

  'src/routes/materials.js': `const express = require('express');
const router = express.Router();
const materialService = require('../services/materialService');

router.post('/', (req, res) => {
  const { batch_id, source_type, raw_data, file_name, uploaded_by } = req.body;
  if (!batch_id || !source_type || !raw_data || !uploaded_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = materialService.addMaterial(batch_id, source_type, raw_data, file_name, uploaded_by);
  if (result.isDuplicate) {
    return res.json({ ...result, message: '相同材料已存在' });
  }
  materialService.parseAndSaveData(batch_id, raw_data);
  res.json(result);
});

module.exports = router;
`,

  'src/routes/schedules.js': `const express = require('express');
const router = express.Router();
const scheduleService = require('../services/scheduleService');
const exportService = require('../services/exportService');
const path = require('path');

router.post('/recalculate/:batchId', (req, res) => {
  const result = scheduleService.calculateSchedules(req.params.batchId);
  res.json(result);
});

router.get('/batch/:batchId', (req, res) => {
  res.json(scheduleService.listSchedules(req.params.batchId));
});

router.get('/:id', (req, res) => {
  const schedule = scheduleService.getScheduleDetail(req.params.id);
  if (!schedule) return res.status(404).json({ error: '排班记录不存在' });
  res.json(schedule);
});

router.get('/:id/traces', (req, res) => {
  res.json(scheduleService.getScheduleTraces(req.params.id));
});

router.get('/:id/audit', (req, res) => {
  res.json(scheduleService.getScheduleAuditLogs(req.params.id));
});

router.put('/:id', (req, res) => {
  const { updates, operator, reason } = req.body;
  if (!updates || !operator || !reason) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = scheduleService.updateSchedule(req.params.id, updates, operator, reason);
  if (!result) return res.status(404).json({ error: '排班记录不存在' });
  res.json(result);
});

router.post('/:id/cancel', (req, res) => {
  const { cancel_type, reason, operator } = req.body;
  if (!cancel_type || !reason || !operator) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const result = scheduleService.cancelSchedule(req.params.id, cancel_type, reason, operator);
  res.json(result);
});

router.get('/export/:batchId', async (req, res) => {
  try {
    const data = exportService.exportBatchData(req.params.batchId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/:batchId/csv', async (req, res) => {
  try {
    const outputPath = path.join(__dirname, \`../../export_batch_\${req.params.batchId}.csv\`);
    const result = await exportService.exportToCsv(req.params.batchId, outputPath);
    res.download(outputPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
`,

  'src/server.js': `const express = require('express');
const bodyParser = require('body-parser');
const batchRoutes = require('./routes/batches');
const materialRoutes = require('./routes/materials');
const scheduleRoutes = require('./routes/schedules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/schedules', scheduleRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '居家护理排班API服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(\`居家护理排班API服务运行在 http://localhost:\${PORT}\`);
  console.log('健康检查: GET /health');
});

module.exports = app;
`,

  'src/scripts/test-api.js': `const batchService = require('../services/batchService');
const materialService = require('../services/materialService');
const scheduleService = require('../services/scheduleService');

const testData = {
  elderly: [
    { name: '张奶奶', phone: '13800138001', address: '北京市朝阳区xx街道xx号', care_level: '二级', care_items: ['血压测量', '血糖检测'] },
    { name: '李爷爷', phone: '13800138002', address: '北京市朝阳区xx街道xx号', care_level: '一级', care_items: ['换药', '康复训练'] },
    { name: '王奶奶', phone: '13800138003', address: '北京市海淀区xx街道xx号', care_level: '三级', care_items: ['生活照料', '心理疏导'] }
  ],
  nurses: [
    { name: '刘护士', phone: '13900139001', skills: ['基础护理', '康复'] },
    { name: '陈护士', phone: '13900139002', skills: ['专科护理', '伤口护理'] }
  ]
};

async function runTest() {
  console.log('=== 开始测试 ===\n');

  console.log('1. 创建批次...');
  const batchResult = batchService.createBatch('2024年5月第1周排班', testData, '站长张三');
  console.log('   结果:', batchResult.message);
  console.log('   批次号:', batchResult.batch.batch_no);
  const batchId = batchResult.batch.id;

  console.log('\\n2. 重复提交相同材料...');
  const duplicateResult = batchService.createBatch('2024年5月第1周排班', testData, '站长李四');
  console.log('   结果:', duplicateResult.message);
  console.log('   是否重复:', duplicateResult.isDuplicate);

  console.log('\\n3. 登记材料并解析数据...');
  const materialResult = materialService.addMaterial(batchId, 'json', testData, '排班数据.json', '站长张三');
  console.log('   材料ID:', materialResult.material.id);

  console.log('\\n4. 触发排班计算...');
  const calcResult = scheduleService.calculateSchedules(batchId);
  console.log('   排班数量:', calcResult.scheduled);

  console.log('\\n5. 查询排班列表...');
  const schedules = scheduleService.listSchedules(batchId);
  console.log('   排班总数:', schedules.length);
  if (schedules.length > 0) {
    console.log('   第一条排班:', schedules[0].schedule_date, schedules[0].time_slot, schedules[0].elderly_name, '->', schedules[0].nurse_name);
  }

  console.log('\\n6. 修改排班（测试审计）...');
  if (schedules.length > 0) {
    const updated = scheduleService.updateSchedule(schedules[0].id, { time_slot: '09:00-11:00' }, '护士长王五', '调整时间更合理');
    console.log('   修改后的时间段:', updated.time_slot);

    console.log('\\n7. 查询审计日志...');
    const auditLogs = scheduleService.getScheduleAuditLogs(schedules[0].id);
    auditLogs.forEach(log => {
      console.log('   ', log.created_at, '-', log.changed_by, '修改', log.field_name, ':', log.old_value, '->', log.new_value, '原因:', log.change_reason);
    });

    console.log('\\n8. 查询处理轨迹...');
    const traces = scheduleService.getScheduleTraces(schedules[0].id);
    traces.forEach(t => {
      console.log('   ', t.created_at, '-', t.action, 'by', t.operator, ':', t.detail);
    });

    console.log('\\n9. 取消排班（电话协调）...');
    const cancelled = scheduleService.cancelSchedule(schedules[1].id, 'phone_call', '老人身体不适，临时取消', '调度员赵六');
    console.log('   取消后状态:', cancelled.status);
    console.log('   取消原因:', cancelled.cancel_reason);
    console.log('   最后处理人:', cancelled.last_handler);
  }

  console.log('\\n=== 测试完成 ===');
}

runTest().catch(console.error);
`
};

for (const [filePath, content] of Object.entries(files)) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
  console.log('Created:', filePath);
}

console.log('\n项目文件生成完成！');
