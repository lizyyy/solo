const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(RECORDS_FILE)) {
    fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
}

function readRecords() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf8'));
}

function writeRecords(records) {
  ensureDataDir();
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
}

function readHistory() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
}

function writeHistory(history) {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function addHistory(entry) {
  const history = readHistory();
  history.push({
    ...entry,
    timestamp: new Date().toISOString()
  });
  writeHistory(history);
}

function validateCoordinate(lat, lng) {
  const issues = [];
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    issues.push('经纬度格式错误');
    return { valid: false, issues, reversed: false };
  }

  if (Math.abs(latNum) > 90) {
    issues.push('纬度超出正常范围（-90 ~ 90）');
  }
  if (Math.abs(lngNum) > 180) {
    issues.push('经度超出正常范围（-180 ~ 180）');
  }

  const latInLngRange = Math.abs(latNum) > 90 && Math.abs(latNum) <= 180;
  const lngInLatRange = Math.abs(lngNum) <= 90;
  const reversed = latInLngRange && lngInLatRange && Math.abs(latNum) > Math.abs(lngNum);

  if (reversed) {
    issues.push('经纬度疑似反写（纬度值异常偏大，经度值异常偏小）');
  }

  return {
    valid: issues.length === 0,
    issues,
    reversed
  };
}

function determineStatus(record, existingRecord) {
  if (existingRecord && existingRecord.status === 'suspended' && !record.overrideSuspend) {
    return 'suspended';
  }

  const coordCheck = validateCoordinate(record.latitude, record.longitude);
  if (!coordCheck.valid) {
    return 'suspended';
  }

  const requiredFields = ['water_level', 'power_output', 'sample_date'];
  const missingFields = requiredFields.filter(f => !record[f] && record[f] !== 0);

  if (missingFields.length > 0) {
    return 'pending_evidence';
  }

  return 'processed';
}

function mergeRecords(existing, incoming) {
  const merged = { ...existing };
  const updatedFields = [];
  const evidenceAdded = [];

  const evidenceFields = ['water_level', 'power_output', 'temperature', 'salinity', 'flow_velocity'];

  evidenceFields.forEach(field => {
    if (incoming[field] !== undefined && incoming[field] !== null && incoming[field] !== '') {
      if (existing[field] === undefined || existing[field] === null || existing[field] === '') {
        merged[field] = incoming[field];
        evidenceAdded.push(field);
        updatedFields.push(field);
      }
    }
  });

  if (incoming.sample_date && !existing.sample_date) {
    merged.sample_date = incoming.sample_date;
    evidenceAdded.push('sample_date');
    updatedFields.push('sample_date');
  }

  if (incoming.station_name && !existing.station_name) {
    merged.station_name = incoming.station_name;
    updatedFields.push('station_name');
  }

  const newCoordCheck = validateCoordinate(incoming.latitude, incoming.longitude);
  if (!newCoordCheck.valid) {
    merged.latitude = incoming.latitude;
    merged.longitude = incoming.longitude;
    merged.coordIssues = newCoordCheck.issues;
    merged.coordReversed = newCoordCheck.reversed;
    updatedFields.push('latitude', 'longitude');
  } else if (!existing.latitude || !existing.longitude) {
    merged.latitude = incoming.latitude;
    merged.longitude = incoming.longitude;
    merged.coordIssues = [];
    merged.coordReversed = false;
    updatedFields.push('latitude', 'longitude');
  }

  if (evidenceAdded.length > 0) {
    merged.evidenceHistory = merged.evidenceHistory || [];
    merged.evidenceHistory.push({
      fields: evidenceAdded,
      timestamp: new Date().toISOString(),
      batch: incoming.batch_no || 'manual'
    });
  }

  merged.updatedAt = new Date().toISOString();
  merged.updateHistory = merged.updateHistory || [];
  if (updatedFields.length > 0) {
    merged.updateHistory.push({
      fields: updatedFields,
      timestamp: new Date().toISOString()
    });
  }

  const newStatus = determineStatus(merged, existing);
  if (newStatus !== existing.status) {
    merged.status = newStatus;
    merged.statusChangedAt = new Date().toISOString();
  }

  return { merged, updatedFields, evidenceAdded };
}

function createNewRecord(incoming) {
  const coordCheck = validateCoordinate(incoming.latitude, incoming.longitude);
  const status = determineStatus(incoming, null);

  return {
    id: incoming.record_id || `REC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    record_id: incoming.record_id,
    station_name: incoming.station_name || '未命名站点',
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    water_level: incoming.water_level,
    power_output: incoming.power_output,
    temperature: incoming.temperature,
    salinity: incoming.salinity,
    flow_velocity: incoming.flow_velocity,
    sample_date: incoming.sample_date,
    batch_no: incoming.batch_no,
    source_file: incoming.source_file,
    manual_note: incoming.manual_note || '',
    status,
    coordIssues: coordCheck.issues,
    coordReversed: coordCheck.reversed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statusChangedAt: new Date().toISOString(),
    importCount: 1,
    evidenceHistory: [],
    updateHistory: [],
    suspendReason: coordCheck.issues.length > 0 ? coordCheck.issues.join('；') : null,
    processedBy: incoming.processedBy || '系统自动'
  };
}

app.get('/api/records', (req, res) => {
  const { status } = req.query;
  let records = readRecords();

  if (status) {
    records = records.filter(r => r.status === status);
  }

  res.json({
    success: true,
    data: records
  });
});

app.get('/api/records/:id', (req, res) => {
  const records = readRecords();
  const record = records.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({ success: true, data: record });
});

app.get('/api/statistics', (req, res) => {
  const records = readRecords();
  const total = records.length;
  const processed = records.filter(r => r.status === 'processed').length;
  const pending = records.filter(r => r.status === 'pending_evidence').length;
  const suspended = records.filter(r => r.status === 'suspended').length;

  const hasNotes = records.filter(r => r.manual_note && r.manual_note.trim()).length;
  const hasEvidenceHistory = records.filter(r => r.evidenceHistory && r.evidenceHistory.length > 0).length;

  res.json({
    success: true,
    data: {
      total,
      processed,
      pending,
      suspended,
      hasNotes,
      hasEvidenceHistory,
      importBatches: [...new Set(records.map(r => r.batch_no).filter(Boolean))].length
    }
  });
});

app.post('/api/import', (req, res) => {
  const { records: incomingRecords, batch_no, source_file } = req.body;
  const existingRecords = readRecords();
  const results = {
    created: [],
    updated: [],
    skipped: [],
    suspended: [],
    errors: []
  };

  incomingRecords.forEach(incoming => {
    const recordId = incoming.record_id || incoming.id;
    if (!recordId) {
      results.errors.push({ record: incoming, error: '缺少记录ID' });
      return;
    }

    const existingIndex = existingRecords.findIndex(r => r.record_id === recordId || r.id === recordId);

    if (existingIndex >= 0) {
      const existing = existingRecords[existingIndex];
      existing.importCount = (existing.importCount || 1) + 1;

      if (incoming.manual_note && existing.manual_note && existing.manual_note.trim()) {
        results.skipped.push({
          record_id: recordId,
          reason: '已存在人工备注，跳过覆盖',
          existing_note: existing.manual_note,
          incoming_note: incoming.manual_note
        });
        delete incoming.manual_note;
      }

      const { merged, updatedFields, evidenceAdded } = mergeRecords(existing, incoming);
      existingRecords[existingIndex] = merged;

      if (updatedFields.length > 0) {
        results.updated.push({
          record_id: recordId,
          updatedFields,
          evidenceAdded,
          status: merged.status
        });
      } else {
        results.skipped.push({
          record_id: recordId,
          reason: '无新字段需要更新',
          importCount: existing.importCount
        });
      }

      if (merged.status === 'suspended') {
        results.suspended.push({
          record_id: recordId,
          reason: merged.suspendReason
        });
      }

      addHistory({
        type: 'update',
        record_id: recordId,
        batch_no,
        source_file,
        updatedFields,
        evidenceAdded
      });
    } else {
      const newRecord = createNewRecord({
        ...incoming,
        batch_no: batch_no || incoming.batch_no,
        source_file: source_file || incoming.source_file
      });
      existingRecords.push(newRecord);
      results.created.push({
        record_id: newRecord.record_id,
        status: newRecord.status
      });

      if (newRecord.status === 'suspended') {
        results.suspended.push({
          record_id: newRecord.record_id,
          reason: newRecord.suspendReason
        });
      }

      addHistory({
        type: 'create',
        record_id: newRecord.record_id,
        batch_no,
        source_file,
        status: newRecord.status
      });
    }
  });

  writeRecords(existingRecords);

  res.json({
    success: true,
    data: results,
    statistics: {
      total: existingRecords.length,
      processed: existingRecords.filter(r => r.status === 'processed').length,
      pending: existingRecords.filter(r => r.status === 'pending_evidence').length,
      suspended: existingRecords.filter(r => r.status === 'suspended').length
    }
  });
});

app.post('/api/records/:id/note', (req, res) => {
  const { note } = req.body;
  const records = readRecords();
  const index = records.findIndex(r => r.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  records[index].manual_note = note;
  records[index].updatedAt = new Date().toISOString();
  records[index].noteUpdatedAt = new Date().toISOString();

  writeRecords(records);

  addHistory({
    type: 'note',
    record_id: records[index].record_id,
    note
  });

  res.json({ success: true, data: records[index] });
});

app.post('/api/records/:id/resolve-suspend', (req, res) => {
  const { action, correctedLat, correctedLng, note } = req.body;
  const records = readRecords();
  const index = records.findIndex(r => r.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  const record = records[index];

  if (action === 'accept_correction') {
    record.latitude = correctedLat;
    record.longitude = correctedLng;
    record.coordIssues = [];
    record.coordReversed = false;
    record.suspendReason = null;
    record.status = determineStatus(record, { ...record, status: 'processed' });
    record.resolvedAt = new Date().toISOString();
    record.resolvedBy = '复核人';
    record.resolveNote = note || '经纬度已修正';
  } else if (action === 'confirm_reversed') {
    const temp = record.latitude;
    record.latitude = record.longitude;
    record.longitude = temp;
    record.coordIssues = [];
    record.coordReversed = false;
    record.suspendReason = null;
    record.status = determineStatus(record, { ...record, status: 'processed' });
    record.resolvedAt = new Date().toISOString();
    record.resolvedBy = '复核人';
    record.resolveNote = note || '已确认经纬度反写并互换';
  } else if (action === 'keep_suspended') {
    record.suspendReason = note || record.suspendReason;
    record.keepSuspendedNote = note;
  }

  record.updatedAt = new Date().toISOString();
  writeRecords(records);

  addHistory({
    type: 'resolve_suspend',
    record_id: record.record_id,
    action,
    note
  });

  res.json({ success: true, data: record });
});

app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json({ success: true, data: history });
});

app.get('/api/generate-report', (req, res) => {
  const records = readRecords();
  const stats = {
    total: records.length,
    processed: records.filter(r => r.status === 'processed').length,
    pending: records.filter(r => r.status === 'pending_evidence').length,
    suspended: records.filter(r => r.status === 'suspended').length
  };

  const pendingRecords = records.filter(r => r.status === 'pending_evidence');
  const suspendedRecords = records.filter(r => r.status === 'suspended');
  const recordsWithNotes = records.filter(r => r.manual_note && r.manual_note.trim());

  const pendingDetails = pendingRecords.map(r => {
    const missing = [];
    if (!r.water_level && r.water_level !== 0) missing.push('水位');
    if (!r.power_output && r.power_output !== 0) missing.push('发电功率');
    if (!r.sample_date) missing.push('采样日期');
    return `${r.station_name}（${r.record_id}）缺：${missing.join('、')}`;
  }).join('；');

  const suspendedDetails = suspendedRecords.map(r => {
    return `${r.station_name}（${r.record_id}）：${r.suspendReason || '经纬度异常待确认'}`;
  }).join('；');

  const noteDetails = recordsWithNotes.map(r => {
    return `${r.station_name}（${r.record_id}）：${r.manual_note}`;
  }).join('；');

  const report = `# 潮汐能站数据清洗交班说明

**生成时间**：${new Date().toLocaleString('zh-CN')}

## 一、整体处理进展

- 总记录数：${stats.total} 条
- 已处理完成：${stats.processed} 条（${((stats.processed / stats.total) * 100).toFixed(1)}%）
- 待补证据：${stats.pending} 条
- 异常挂起：${stats.suspended} 条

## 二、已处理完成情况

已处理 ${stats.processed} 条记录，数据完整、经纬度校验通过，可用于后续分析。

## 三、待补充证据（${stats.pending} 条）

${stats.pending > 0 ? `以下记录缺少关键数据，需等待下一批实验室结果补齐：
${pendingDetails}
` : '暂无待补证据记录。'}

## 四、异常挂起待复核（${stats.suspended} 条）

${stats.suspended > 0 ? `以下记录存在经纬度异常，已挂起等待复核人确认：
${suspendedDetails}

⚠️  注意：挂起记录未给出稳定结论，请勿用于正式报告。
` : '暂无异常挂起记录。'}

## 五、人工备注说明

${recordsWithNotes.length > 0 ? `已记录 ${recordsWithNotes.length} 条人工备注：
${noteDetails}
` : '暂无人工备注。'}

## 六、交班提示

1. 待实验室下一批结果到后，可直接导入本工具，系统会自动识别并补充缺失字段，不会覆盖已有的人工备注和判断
2. 对于挂起记录，请优先处理经纬度反写问题，确认后再给出稳定结论
3. 所有筛选、统计、明细均基于同一套清洗结果，确保交班口径一致

---
*本说明由潮汐能站数据清洗工具自动生成*`;

  res.json({
    success: true,
    data: {
      report,
      statistics: stats,
      pendingRecords,
      suspendedRecords
    }
  });
});

app.post('/api/reset', (req, res) => {
  writeRecords([]);
  writeHistory([]);
  res.json({ success: true, message: '数据已重置' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  潮汐能站数据清洗工具已启动                                ║
║  访问地址: http://localhost:${PORT}                        ║
║  初始化示例数据: npm run init-data                        ║
╚════════════════════════════════════════════════════════════╝
  `);
});
