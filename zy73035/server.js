const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const PORT = 3000;
const dbPath = path.join(__dirname, 'data', 'review.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
function getDb() {
  if (!db) {
    if (!fs.existsSync(dbPath)) {
      console.error('数据库不存在，请先运行 npm run init');
      process.exit(1);
    }
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function logChange(recordId, batchId, fieldName, oldValue, newValue, changedBy, changeType, changeReason) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO change_history (record_id, batch_id, field_name, old_value, new_value, changed_by, change_type, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(recordId, batchId, fieldName, oldValue || '', newValue || '', changedBy || '前台', changeType, changeReason || '');
}

function detectDirtyData(batchId) {
  const d = getDb();
  const reports = [];
  const records = d.prepare('SELECT * FROM rescue_records WHERE batch_id = ?').all(batchId);

  const aliasMap = new Map();
  records.forEach(r => {
    const alias = (r.pet_alias || '').trim();
    const name = (r.pet_name || '').trim();
    const key = alias ? `${name}|${alias}` : name;
    if (!aliasMap.has(key)) aliasMap.set(key, []);
    aliasMap.get(key).push(r);
  });

  for (const [key, items] of aliasMap.entries()) {
    if (items.length > 1) {
      const [name, alias] = key.split('|');
      items.forEach(r => {
        reports.push({
          batch_id: batchId, record_id: r.id, issue_type: '别名重复', severity: '错误',
          description: `宠物名称"${name}"${alias ? '（别名：' + alias + '）' : ''}出现 ${items.length} 条重复记录，ID: ${items.map(i => i.id).join(', ')}`,
          affected_fields: 'pet_name, pet_alias'
        });
      });
    }
  }

  records.forEach(r => {
    if (!r.vaccine_photo_refs || r.vaccine_photo_refs.trim() === '') {
      reports.push({
        batch_id: batchId, record_id: r.id, issue_type: '疫苗本照片缺失', severity: '警告',
        description: `宠物"${r.pet_name}"没有关联任何疫苗本照片引用，异常照片可能散落在聊天记录中`,
        affected_fields: 'vaccine_photo_refs'
      });
    } else {
      const refs = r.vaccine_photo_refs.split(/[,，;；]/).map(s => s.trim()).filter(s => s);
      if (refs.length < 2) {
        reports.push({
          batch_id: batchId, record_id: r.id, issue_type: '疫苗照片不足', severity: '警告',
          description: `宠物"${r.pet_name}"仅关联 ${refs.length} 张疫苗照片，建议至少提供首免和加强免疫记录`,
          affected_fields: 'vaccine_photo_refs'
        });
      }
    }
    if (!r.rescue_date || r.rescue_date.trim() === '') {
      reports.push({ batch_id: batchId, record_id: r.id, issue_type: '救助日期缺失', severity: '警告',
        description: `宠物"${r.pet_name}"未填写救助日期，无法确定时间线`, affected_fields: 'rescue_date' });
    }
    if (!r.species || r.species.trim() === '') {
      reports.push({ batch_id: batchId, record_id: r.id, issue_type: '物种缺失', severity: '警告',
        description: `宠物"${r.pet_name}"未填写物种（猫/狗等）`, affected_fields: 'species' });
    }
    if (!r.initial_conclusion && !r.final_conclusion) {
      reports.push({ batch_id: batchId, record_id: r.id, issue_type: '结论待定', severity: '信息',
        description: `宠物"${r.pet_name}"尚未得出复核结论，需要人工确认`,
        affected_fields: 'initial_conclusion, final_conclusion' });
    }
    if (r.manual_overridden === 1 && (!r.override_reason || r.override_reason.trim() === '')) {
      reports.push({ batch_id: batchId, record_id: r.id, issue_type: '改判原因缺失', severity: '错误',
        description: `宠物"${r.pet_name}"已被人工改判，但未填写改判原因，无法追溯最终说法`,
        affected_fields: 'manual_overridden, override_reason' });
    }
  });

  const insertStmt = d.prepare(`
    INSERT INTO dirty_data_reports (batch_id, record_id, issue_type, severity, description, affected_fields)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  d.prepare('DELETE FROM dirty_data_reports WHERE batch_id = ?').run(batchId);

  d.exec('BEGIN');
  try {
    for (const item of reports) {
      insertStmt.run(item.batch_id, item.record_id, item.issue_type, item.severity, item.description, item.affected_fields);
    }
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }

  return reports;
}

function generateExport(batchId) {
  const d = getDb();
  const batch = d.prepare('SELECT * FROM review_batches WHERE id = ?').get(batchId);
  if (!batch) return null;

  const records = d.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM change_history h WHERE h.record_id = r.id) as change_count
    FROM rescue_records r
    WHERE r.batch_id = ?
    ORDER BY r.id
  `).all(batchId);

  const dirty = d.prepare('SELECT * FROM dirty_data_reports WHERE batch_id = ?').all(batchId);
  const history = d.prepare(`
    SELECT h.*, r.pet_name
    FROM change_history h
    LEFT JOIN rescue_records r ON h.record_id = r.id
    WHERE h.batch_id = ?
    ORDER BY h.changed_at DESC
  `).all(batchId);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const recordsFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-记录-${timestamp}.csv`);
  createCsvWriter({
    path: recordsFile,
    header: [
      { id: 'id', title: '记录ID' }, { id: 'pet_name', title: '宠物名称' },
      { id: 'pet_alias', title: '别名' }, { id: 'species', title: '物种' },
      { id: 'gender', title: '性别' }, { id: 'rescue_date', title: '救助日期' },
      { id: 'vaccine_photo_refs', title: '疫苗照片' }, { id: 'initial_conclusion', title: '初步结论' },
      { id: 'review_status', title: '复核状态' }, { id: 'review_remark', title: '复核备注' },
      { id: 'manual_overridden', title: '人工改判' }, { id: 'override_reason', title: '改判原因' },
      { id: 'final_conclusion', title: '最终结论' }, { id: 'confirmed_by', title: '确认人' },
      { id: 'confirmed_at', title: '确认时间' }, { id: 'change_count', title: '变更次数' }
    ]
  }).writeRecords(records);

  const dirtyFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-脏数据-${timestamp}.csv`);
  createCsvWriter({
    path: dirtyFile,
    header: [
      { id: 'id', title: '报告ID' }, { id: 'record_id', title: '记录ID' },
      { id: 'issue_type', title: '问题类型' }, { id: 'severity', title: '严重程度' },
      { id: 'description', title: '详细说明' }, { id: 'affected_fields', title: '涉及字段' },
      { id: 'detected_at', title: '检测时间' }
    ]
  }).writeRecords(dirty);

  const historyFile = path.join(exportDir, `${batch.batch_name}-run${batch.run_number}-变更历史-${timestamp}.csv`);
  createCsvWriter({
    path: historyFile,
    header: [
      { id: 'id', title: '变更ID' }, { id: 'pet_name', title: '宠物名称' },
      { id: 'field_name', title: '变更字段' }, { id: 'old_value', title: '原值' },
      { id: 'new_value', title: '新值' }, { id: 'changed_by', title: '操作人' },
      { id: 'change_type', title: '变更类型' }, { id: 'change_reason', title: '变更原因' },
      { id: 'changed_at', title: '变更时间' }
    ]
  }).writeRecords(history);

  return { recordsFile, dirtyFile, historyFile, recordsCount: records.length, dirtyCount: dirty.length, historyCount: history.length };
}

app.get('/api/batches', (req, res) => {
  const d = getDb();
  const batches = d.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM rescue_records r WHERE r.batch_id = b.id) as record_count,
      (SELECT COUNT(*) FROM rescue_records r WHERE r.batch_id = b.id AND r.review_status = '已确认') as confirmed_count,
      (SELECT COUNT(*) FROM dirty_data_reports d WHERE d.batch_id = b.id) as dirty_count
    FROM review_batches b
    ORDER BY b.created_at DESC
  `).all();
  res.json(batches);
});

app.post('/api/batches', (req, res) => {
  const d = getDb();
  const { batch_name, remark } = req.body;
  if (!batch_name) return res.status(400).json({ error: '批次名称必填' });

  const existing = d.prepare('SELECT MAX(run_number) as max_run FROM review_batches WHERE batch_name = ?').get(batch_name);
  const runNumber = (existing?.max_run || 0) + 1;

  const result = d.prepare('INSERT INTO review_batches (batch_name, run_number, remark) VALUES (?, ?, ?)').run(batch_name, runNumber, remark || '');
  const batchId = result.lastInsertRowid;

  if (runNumber > 1) {
    const prevBatch = d.prepare(`SELECT id FROM review_batches WHERE batch_name = ? AND run_number = ?`).get(batch_name, runNumber - 1);
    if (prevBatch) {
      const prevRecords = d.prepare('SELECT * FROM rescue_records WHERE batch_id = ?').all(prevBatch.id);
      const insertRecord = d.prepare(`
        INSERT INTO rescue_records (batch_id, pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_status, review_remark, manual_overridden, override_reason, final_conclusion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      d.exec('BEGIN');
      try {
        for (const r of prevRecords) {
          const newId = insertRecord.run(batchId, r.pet_name, r.pet_alias, r.species, r.gender, r.rescue_date, r.vaccine_photo_refs, r.initial_conclusion, r.review_status, r.review_remark, r.manual_overridden, r.override_reason || '', r.final_conclusion || '').lastInsertRowid;
          logChange(newId, batchId, 'batch_carryover', `run${runNumber - 1}`, `run${runNumber}`, '系统', '批次重跑继承', `从批次 ${batch_name} run${runNumber - 1} 继承数据`);
        }
        d.exec('COMMIT');
      } catch (e) { d.exec('ROLLBACK'); throw e; }
    }
  }

  const batch = d.prepare('SELECT * FROM review_batches WHERE id = ?').get(batchId);
  res.json(batch);
});

app.get('/api/batches/:batchId/records', (req, res) => {
  const d = getDb();
  const { batchId } = req.params;
  const records = d.prepare('SELECT * FROM rescue_records WHERE batch_id = ? ORDER BY id').all(batchId);
  res.json(records);
});

app.post('/api/batches/:batchId/records', (req, res) => {
  const d = getDb();
  const { batchId } = req.params;
  const { pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_remark } = req.body;
  if (!pet_name) return res.status(400).json({ error: '宠物名称必填' });

  const result = d.prepare(`
    INSERT INTO rescue_records (batch_id, pet_name, pet_alias, species, gender, rescue_date, vaccine_photo_refs, initial_conclusion, review_remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, pet_name, pet_alias || '', species || '', gender || '', rescue_date || '', vaccine_photo_refs || '', initial_conclusion || '', review_remark || '');

  const recordId = result.lastInsertRowid;
  logChange(recordId, batchId, 'record_create', '', JSON.stringify(req.body), '前台', '创建记录', '新建救助记录');
  const record = d.prepare('SELECT * FROM rescue_records WHERE id = ?').get(recordId);
  res.json(record);
});

app.put('/api/records/:recordId', (req, res) => {
  const d = getDb();
  const { recordId } = req.params;
  const existing = d.prepare('SELECT * FROM rescue_records WHERE id = ?').get(recordId);
  if (!existing) return res.status(404).json({ error: '记录不存在' });

  const fields = ['pet_name', 'pet_alias', 'species', 'gender', 'rescue_date', 'vaccine_photo_refs', 'initial_conclusion', 'review_remark', 'manual_overridden', 'override_reason', 'final_conclusion', 'review_status', 'confirmed_by'];
  const updates = [];
  const values = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      const oldVal = existing[f];
      const newVal = req.body[f];
      if (String(oldVal || '') !== String(newVal || '')) {
        logChange(recordId, existing.batch_id, f, oldVal, newVal, req.body.changed_by || '前台', '字段修改', req.body.change_reason || '');
      }
      updates.push(`${f} = ?`);
      values.push(newVal);
    }
  });

  if (updates.length === 0) return res.json(existing);

  updates.push(`updated_at = datetime('now', 'localtime')`);
  if (req.body.review_status === '已确认' || req.body.final_conclusion !== undefined) {
    if (!existing.confirmed_at || req.body.review_status === '已确认') {
      updates.push(`confirmed_at = datetime('now', 'localtime')`);
    }
  }
  values.push(recordId);

  d.prepare(`UPDATE rescue_records SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = d.prepare('SELECT * FROM rescue_records WHERE id = ?').get(recordId);
  res.json(updated);
});

app.get('/api/records/:recordId/history', (req, res) => {
  const d = getDb();
  const { recordId } = req.params;
  const history = d.prepare('SELECT * FROM change_history WHERE record_id = ? ORDER BY changed_at DESC, id DESC').all(recordId);
  res.json(history);
});

app.get('/api/batches/:batchId/dirty', (req, res) => {
  const d = getDb();
  const { batchId } = req.params;
  let reports = d.prepare('SELECT * FROM dirty_data_reports WHERE batch_id = ? ORDER BY severity DESC, id').all(batchId);
  if (reports.length === 0) reports = detectDirtyData(Number(batchId));
  const grouped = {};
  reports.forEach(r => { if (!grouped[r.issue_type]) grouped[r.issue_type] = []; grouped[r.issue_type].push(r); });
  res.json({ list: reports, grouped, total: reports.length, bySeverity: {
    错误: reports.filter(r => r.severity === '错误').length,
    警告: reports.filter(r => r.severity === '警告').length,
    信息: reports.filter(r => r.severity === '信息').length
  }});
});

app.post('/api/batches/:batchId/check-dirty', (req, res) => {
  const { batchId } = req.params;
  const reports = detectDirtyData(Number(batchId));
  res.json({ total: reports.length, reports });
});

app.get('/api/batches/:batchId/compare', (req, res) => {
  const d = getDb();
  const { batchId } = req.params;
  const current = d.prepare('SELECT * FROM review_batches WHERE id = ?').get(batchId);
  if (!current) return res.status(404).json({ error: '批次不存在' });
  if (current.run_number <= 1) {
    return res.json({ message: '这是第1次运行，没有上一批数据可对比', current, previous: null });
  }
  const prev = d.prepare('SELECT * FROM review_batches WHERE batch_name = ? AND run_number = ?').get(current.batch_name, current.run_number - 1);
  const prevRecords = d.prepare('SELECT * FROM rescue_records WHERE batch_id = ? ORDER BY pet_name').all(prev.id);
  const currRecords = d.prepare('SELECT * FROM rescue_records WHERE batch_id = ? ORDER BY pet_name').all(current.id);
  const prevMap = new Map(prevRecords.map(r => [r.pet_name + '|' + (r.pet_alias || ''), r]));
  const currMap = new Map(currRecords.map(r => [r.pet_name + '|' + (r.pet_alias || ''), r]));
  const diffs = [];
  for (const [key, curr] of currMap.entries()) {
    const prev = prevMap.get(key);
    if (!prev) continue;
    ['review_remark', 'final_conclusion', 'review_status', 'manual_overridden', 'override_reason'].forEach(f => {
      if (String(prev[f] || '') !== String(curr[f] || '')) {
        diffs.push({ pet_name: curr.pet_name, field: f, prev_value: prev[f], curr_value: curr[f] });
      }
    });
  }
  res.json({ current, previous: prev, diffs, count: diffs.length });
});

app.post('/api/batches/:batchId/export', (req, res) => {
  const { batchId } = req.params;
  detectDirtyData(Number(batchId));
  const result = generateExport(Number(batchId));
  if (!result) return res.status(404).json({ error: '批次不存在' });
  res.json({
    message: '导出完成',
    records_file: path.basename(result.recordsFile),
    dirty_file: path.basename(result.dirtyFile),
    history_file: path.basename(result.historyFile),
    records_count: result.recordsCount,
    dirty_count: result.dirtyCount,
    history_count: result.historyCount,
    export_dir: './exports'
  });
});

app.get('/api/exports', (req, res) => {
  const exportDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(exportDir)) return res.json([]);
  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.csv'));
  files.sort().reverse();
  res.json(files);
});

app.listen(PORT, () => {
  console.log(`\n🐾 流浪动物救助记录复核系统已启动`);
  console.log(`📍 前台界面: http://localhost:${PORT}`);
  console.log(`📝 小温操作提示: 打开上面的地址就能开始交班啦！\n`);
});
