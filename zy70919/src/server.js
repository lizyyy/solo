const express = require('express');
const bodyParser = require('body-parser');
const CryptoJS = require('crypto-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const data = { batches: [], materials: [], elderly: [], nurses: [], schedules: [], auditLogs: [], processTraces: [] };
const counters = { batch:1, material:1, elderly:1, nurse:1, schedule:1, audit:1, trace:1 };

function hash(d) { const str = typeof d === 'string' ? d : JSON.stringify(d); return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex); }
function batchNo() { const d = new Date(); return 'BATCH-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + Date.now().toString(36).toUpperCase(); }
function now() { return new Date().toISOString(); }

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Home Care Scheduling API is running', stats: { batches: data.batches.length, schedules: data.schedules.length } });
});

app.listen(PORT, () => {
  console.log('Home Care Scheduling API is running on http://localhost:' + PORT);
  console.log('Health check: GET /health');
});

const data = { batches: [], materials: [], elderly: [], nurses: [], schedules: [], auditLogs: [], processTraces: [] };

const counters = { batch:1, material:1, elderly:1, nurse:1, schedule:1, audit:1, trace:1 };

function hash(d) { const str = typeof d === 'string' ? d : JSON.stringify(d); return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex); }

function batchNo() { const d = new Date(); return 'BATCH-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + Date.now().toString(36).toUr�쵾��J
N�B���[��[ۈ���
H��]\���]�]J
K��T����[�

N�B��\��]
	��X[	�
�\K�\�HO��\˚��ۊ��]\Έ	����Y\��Y�N�	��H�\�H��Y[[��TH�[��[���JNJN�\�\�\�ԕ

HO���ۜ��K���	��\��\�ۈܝ	�ԕ
N�JN
const data = {
  batches: [],
  materials: [],
  elderly: [],
  nurses: [],
  schedules: [],
  auditLogs: [],
  processTraces: []
};

const counters = { batch: 1, material: 1, elderly: 1, nurse: 1, schedule: 1, audit: 1, trace: 1 };

function hash(d) {
  const str = typeof d === 'string' ? d : JSON.stringify(d);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function batchNo() {
  const d = new Date();
  return 'BATCH-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + Date.now().toString(36).toUpperCase();
}

function now() { return new Date().toISOString(); }

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Home Care Scheduling API is running', stats: { batches: data.batches.length, schedules: data.schedules.length } });
});

app.post('/api/batches', (req, res) => {
  const { title, material_data, created_by } = req.body;
  if (!title || !material_data || !created_by) return res.status(400).json({ error: 'Missing required fields' });
  const h = hash(material_data);
  const ex = data.batches.find(b => b.material_hash === h);
  if (ex) return res.json({ isDuplicate: true, batch: ex, message: 'Duplicate material, returning existing batch' });
  const b = { id: counters.batch++, batch_no: batchNo(), material_hash: h, title, status: 'pending', created_by, created_at: now(), updated_at: now() };
  data.batches.push(b);
  res.json({ isDuplicate: false, batch: b, message: 'Batch created successfully' });
});

app.get('/api/batches', (req, res) => {
  res.json(data.batches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.get('/api/batches/:id', (req, res) => {
  const b = data.batches.find(x => x.id == req.params.id);
  b ? res.json(b) : res.status(404).json({ error: 'Batch not found' });
});

app.listen(PORT, () => {
  console.log('Home Care Scheduling API is running on http://localhost:' + PORT);
  console.log('Health check: GET /health');
});app.use(bodyParser.urlencoded({ extended: true }));

const data = {
  batches: [],
  materials: [],
  elderly: [],
  nurses: [],
  schedules: [],
  auditLogs: [],
  processTraces: []
};

const counters = { batch:1, material:1, elderly:1, nurse:1, schedule:1, audit:1, trace:1 };

function hash(d) {
  const str = typeof d === 'string' ? d : JSON.stringify(d);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function batchNo() {
  const d = new Date();
  return 'BATCH-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + Date.now().toString(36).toUpperCase();
}
function now() { return new Date().toISOString(); }

app.post('/api/batches', (req, res) => {
  const { title, material_data, created_by } = req.body;
  if (!title || !material_data || !created_by) return res.status(400).json({ error: 'Missing required fields' });
  const h = hash(material_data);
  const ex = data.batches.find(b => b.material_hash === h);
  if (ex) return res.json({ isDuplicate: true, batch: ex, message: 'Duplicate material, returning existing batch' });
  const b = { id: counters.batch++, batch_no: batchNo(), material_hash: h, title, status: 'pending', created_by, created_at: now(), updated_at: now() };
  data.batches.push(b);
  res.json({ isDuplicate: false, batch: b, message: 'Batch created successfully' });
});

app.get('/api/batches', (req, res) => {
  res.json(data.batches.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.get('/api/batches/:id', (req, res) => {
  const b = data.batches.find(x => x.id == req.params.id);
  b ? res.json(b) : res.status(404).json({ error: 'Batch not found' });
});

app.get('/api/batches/:id/statistics', (req, res) => {
  const id = parseInt(req.params.id);
  const s = data.schedules.filter(x => x.batch_id === id);
  res.json({
    totalSchedules: s.length,
    totalElderly: data.elderly.filter(x => x.batch_id === id).length,
    totalNurses: data.nurses.filter(x => x.batch_id === id).length,
    statusBreakdown: {
      scheduled: s.filter(x => x.status === 'scheduled').length,
      cancelled: s.filter(x => x.status === 'cancelled').length,
      completed: s.filter(x => x.status === 'completed').length
    }
  });
});

app.post('/api/materials', (req, res) => {
  const { batch_id, source_type, raw_data, file_name, uploaded_by } = req.body;
  if (!batch_id || !source_type || !raw_data || !uploaded_by) return res.status(400).json({ error: 'Missing required fields' });
  const h = hash(raw_data);
  const ex = data.materials.find(m => m.content_hash === h);
  if (ex) return res.json({ isDuplicate: true, material: ex, message: 'Duplicate material' });
  const m = { id: counters.material++, batch_id: parseInt(batch_id), source_type, content_hash: h, raw_data: JSON.stringify(raw_data), file_name, uploaded_by, created_at: now() };
  data.materials.push(m);
  const d = typeof raw_data === 'string' ? JSON.parse(raw_data) : raw_data;
  if (d.elderly && d.elderly.length) {
    for (const e of d.elderly) data.elderly.push({ id: counters.elderly++, batch_id: parseInt(batch_id), name: e.name, phone: e.phone || '', address: e.address || '', care_level: e.care_level || '', care_items: e.care_items || [], created_at: now() });
  }
  if (d.nurses && d.nurses.length) {
    for (const n of d.nurses) data.nurses.push({ id: counters.nurse++, batch_id: parseInt(batch_id), name: n.name, phone: n.phone || '', skills: n.skills || [], status: 'active', created_at: now() });
  }
  res.json({ isDuplicate: false, material: m, message: 'Material registered successfully' });
});

app.post('/api/schedules/recalculate/:batchId', (req, res) => {
  const id = parseInt(req.params.batchId);
  data.schedules = data.schedules.filter(s => s.batch_id !== id || s.status !== 'scheduled');
  const elder = data.elderly.filter(e => e.batch_id === id);
  const nurses = data.nurses.filter(n => n.batch_id === id);
  if (!elder.length || !nurses.length) return res.json({ scheduled: 0, message: 'Insufficient data' });
  const slots = ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'];
  let cnt = 0;
  for (let day = 0; day < 7; day++) {
    const dt = new Date(); dt.setDate(dt.getDate() + day);
    const ds = dt.toISOString().split('T')[0];
    let ni = 0;
    for (let i = 0; i < elder.length; i++) {
      const nurse = nurses[ni % nurses.length]; ni++;
      const s = { id: counters.schedule++, batch_id: id, elderly_id: elder[i].id, nurse_id: nurse.id, schedule_date: ds, time_slot: slots[i%slots.length], care_items: elder[i].care_items || [], status: 'scheduled', cancel_reason: null, cancel_type: null, last_handler: null, handled_at: null, created_at: now(), updated_at: now() };
      data.schedules.push(s);
      data.processTraces.push({ id: counters.trace++, schedule_id: s.id, action: 'schedule_created', operator: 'system', detail: 'Auto-scheduled', created_at: now() });
      cnt++;
    }
  }
  const b = data.batches.find(x => x.id === id);
  if (b) { b.status = 'completed'; b.updated_at = now(); }
  res.json({ scheduled: cnt, message: 'Scheduling completed' });
});

app.get('/api/schedules/batch/:batchId', (req, res) => {
  const id = parseInt(req.params.batchId);
  res.json(data.schedules.filter(s => s.batch_id === id).map(s => ({ ...s, elderly_name: data.elderly.find(e => e.id === s.elderly_id)?.name || '', nurse_name: data.nurses.find(n => n.id === s.nurse_id)?.name || '' })).sort((a,b) => a.schedule_date.localeCompare(b.schedule_date) || a.time_slot.localeCompare(b.time_slot)));
});

app.get('/api/schedules/:id', (req, res) => {
  const s = data.schedules.find(x => x.id == req.params.id);
  if (!s) return res.status(404).json({ error: 'Schedule not found' });
  const e = data.elderly.find(x => x.id === s.elderly_id);
  const n = data.nurses.find(x => x.id === s.nurse_id);
  res.json({ ...s, elderly_name: e?.name || '', elderly_phone: e?.phone || '', elderly_address: e?.address || '', nurse_name: n?.name || '', nurse_phone: n?.phone || '' });
});

app.get('/api/schedules/:id/traces', (req, res) => {
  res.json(data.processTraces.filter(t => t.schedule_id == req.params.id).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
});

app.get('/api/schedules/:id/audit', (req, res) => {
  res.json(data.auditLogs.filter(l => l.schedule_id == req.params.id).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
});

app.put('/api/schedules/:id', (req, res) => {
  const { updates, operator, reason } = req.body;
  if (!updates || !operator || !reason) return res.status(400).json({ error: 'Missing required fields' });
  const s = data.schedules.find(x => x.id == req.params.id);
  if (!s) return res.status(404).json({ error: 'Schedule not found' });
  for (const [k, v] of Object.entries(updates)) {
    if (s[k] !== undefined && String(s[k] || '') !== String(v || '')) {
      data.auditLogs.push({ id: counters.audit++, schedule_id: s.id, field_name: k, old_value: String(s[k] || ''), new_value: String(v || ''), change_reason: reason, changed_by: operator, created_at: now() });
    }
  }
  Object.assign(s, updates); s.last_handler = operator; s.handled_at = now(); s.updated_at = now();
  data.processTraces.push({ id: counters.trace++, schedule_id: s.id, action: 'updated', operator, detail: reason, created_at: now() });
  const e = data.elderly.find(x => x.id === s.elderly_id);
  const n = data.nurses.find(x => x.id === s.nurse_id);
  res.json({ ...s, elderly_name: e?.name || '', nurse_name: n?.name || '' });
});

app.post('/api/schedules/:id/cancel', (req, res) => {
  const { cancel_type, reason, operator } = req.body;
  if (!cancel_type || !reason || !operator) return res.status(400).json({ error: 'Missing required fields' });
  req.body.updates = { status: 'cancelled', cancel_type, cancel_reason: reason };
  req.body.reason = reason; req.body.operator = operator;
  app._router.handle(req, res);
});

app.get('/api/schedules/export/:batchId', (req, res) => {
  const id = parseInt(req.params.batchId);
  res.json(data.schedules.filter(s => s.batch_id === id).map(s => {
    const e = data.elderly.find(x => x.id === s.elderly_id);
    const n = data.nurses.find(x => x.id === s.nurse_id);
    return { schedule_id: s.id, schedule_date: s.schedule_date, time_slot: s.time_slot, status: s.status, nurse_name: n?.name || '', nurse_phone: n?.phone || '', elderly_name: e?.name || '', elderly_phone: e?.phone || '', elderly_address: e?.address || '', care_level: e?.care_level || '', care_items: e?.care_items || [], cancel_type: s.cancel_type || '', cancel_reason: s.cancel_reason || '', last_handler: s.last_handler || '', handled_at: s.handled_at || '' };
  }).sort((a,b) => a.schedule_date.localeCompare(b.schedule_date) || a.time_slot.localeCompare(b.time_slot)));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Home Care Scheduling API is running', stats: { batches: data.batches.length, schedules: data.schedules.length } });
});

app.listen(PORT, () => {
  console.log('Home Care Scheduling API is running on http://localhost:' + PORT);
  console.log('Health check: GET /health');
});

const data = {
  batches: [],
  materials: [],
  elderly: [],
  nurses: [],
  schedules: [],
  auditLogs: [],
  processTraces: []
};

const counters = { batch:1, material:1, elderly:1, nurse:1, schedule:1, audit:1, trace:1 };

function hash(d) {
  const str = typeof d === 'string' ? d : JSON.stringify(d);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function batchNo() {
  const d = new Date();
  return 'BATCH-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '-' + Date.now().toString(36).toUpperCase();
}
function now() { return new Date().toISOString(); }

app.get('/health', (req, res) => {
  res.json({status:'ok', message:'居家护理排班API服务运行正常', stats:{batches:data.batches.length, schedules:data.schedules.length}});
});

app.listen(PORT, () => {
  console.log('服务运行在 http://localhost:' + PORT);
  console.log('健康检查: GET /health');
});
app.use(bodyParser.urlencoded({ extended: true }));

// 内存数据存储
const data = {
  batches: [],
  materials: [],
  elderly: [],
  nurses: [],
  schedules: [],
  auditLogs: [],
  processTraces: []
};

// 自增ID计数器
const counters = {
  batch: 1,
  material: 1,
  elderly: 1,
  nurse: 1,
  schedule: 1,
  audit: 1,
  trace: 1
};

// 工具函数
function generateHash(inputData) {
  const str = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function generateBatchNo() {
  const date = new Date();
  const timestamp = date.getTime().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${timestamp}-${random}`;
}

function getCurrentTime() {
  return new Date().toISOString();
}

// 1. 批次管理接口
app.post('/api/batches', (req, res) => {
  const { title, material_data, created_by } = req.body;
  if (!title || !material_data || !created_by) {
    return res.status(400).json({ error: '缺少必填字段: title, material_data, created_by' });
  }

  const materialHash = generateHash(material_data);
  const existing = data.batches.find(b => b.material_hash === materialHash);
  
  if (existing) {
    return res.json({
      isDuplicate: true,
      batch: existing,
      message: '相同材料已存在，返回原有批次'
    });
  }

  const batch = {
    id: counters.batch++,
    batch_no: generateBatchNo(),
    material_hash: materialHash,
    title,
    status: 'pending',
    created_by,
    created_at: getCurrentTime(),
    updated_at: getCurrentTime()
  };
  data.batches.push(batch);
  
  res.json({
    isDuplicate: false,
    batch,
    message: '批次创建成功'
  });
});

app.get('/api/batches', (req, res) => {
  res.json(data.batches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.get('/api/batches/:id', (req, res) => {
  const batch = data.batches.find(b => b.id == req.params.id);
  if (!batch) return res.status(404).json({ error: '批次不存在' });
  res.json(batch);
});

app.get('/api/batches/:id/statistics', (req, res) => {
  const batchId = parseInt(req.params.id);
  const schedules = data.schedules.filter(s => s.batch_id === batchId);
  const elderly = data.elderly.filter(e => e.batch_id === batchId);
  const nurses = data.nurses.filter(n => n.batch_id === batchId);
  
  res.json({
    totalSchedules: schedules.length,
    totalElderly: elderly.length,
    totalNurses: nurses.length,
    statusBreakdown: {
      scheduled: schedules.filter(s => s.status === 'scheduled').length,
      cancelled: schedules.filter(s => s.status === 'cancelled').length,
      completed: schedules.filter(s => s.status === 'completed').length
    }
  });
});

// 2. 材料上传/登记接口
app.post('/api/materials', (req, res) => {
  const { batch_id, source_type, raw_data, file_name, uploaded_by } = req.body;
  if (!batch_id || !source_type || !raw_data || !uploaded_by) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const contentHash = generateHash(raw_data);
  const existing = data.materials.find(m => m.content_hash === contentHash);
  
  if (existing) {
    return res.json({
      isDuplicate: true,
      material: existing,
      message: '相同材料已存在'
    });
  }

  const material = {
    id: counters.material++,
    batch_id: parseInt(batch_id),
    source_type,
    content_hash: contentHash,
    raw_data: JSON.stringify(raw_data),
    file_name,
    uploaded_by,
    created_at: getCurrentTime()
  };
  data.materials.push(material);

  // 解析并保存数据
  const inputData = typeof raw_data === 'string' ? JSON.parse(raw_data) : raw_data;
  
  if (inputData.elderly && inputData.elderly.length) {
    for (const e of inputData.elderly) {
      data.elderly.push({
        id: counters.elderly++,
        batch_id: parseInt(batch_id),
        name: e.name,
        id_card: e.id_card || '',
        phone: e.phone || '',
        address: e.address || '',
        care_level: e.care_level || '',
        care_items: e.care_items || [],
        created_at: getCurrentTime()
      });
    }
  }
  
  if (inputData.nurses && inputData.nurses.length) {
    for (const n of inputData.nurses) {
      data.nurses.push({
        id: counters.nurse++,
        batch_id: parseInt(batch_id),
        name: n.name,
        phone: n.phone || '',
        skills: n.skills || [],
        status: 'active',
        created_at: getCurrentTime()
      });
    }
  }

  res.json({
    isDuplicate: false,
    material,
    message: '材料登记成功，数据已解析'
  });
});

// 3. 排班计算和重算接口
app.post('/api/schedules/recalculate/:batchId', (req, res) => {
  const batchId = parseInt(req.params.batchId);
  
  // 清除未执行的排班
  data.schedules = data.schedules.filter(s => s.batch_id !== batchId || s.status !== 'scheduled');
  
  const batchElderly = data.elderly.filter(e => e.batch_id === batchId);
  const batchNurses = data.nurses.filter(n => n.batch_id === batchId);
  
  if (batchElderly.length === 0 || batchNurses.length === 0) {
    return res.json({ scheduled: 0, message: '老人或护士数据不足' });
  }

  const timeSlots = ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00'];
  const today = new Date();
  let scheduledCount = 0;

  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    let nurseIdx = 0;
    
    for (let i = 0; i < batchElderly.length; i++) {
      const slotIdx = i % timeSlots.length;
      const nurse = batchNurses[nurseIdx % batchNurses.length];
      nurseIdx++;
      const e = batchElderly[i];
      
      const schedule = {
        id: counters.schedule++,
        batch_id: batchId,
        elderly_id: e.id,
        nurse_id: nurse.id,
        schedule_date: dateStr,
        time_slot: timeSlots[slotIdx],
        care_items: e.care_items || [],
        status: 'scheduled',
        cancel_reason: null,
        cancel_type: null,
        last_handler: null,
        handled_at: null,
        created_at: getCurrentTime(),
        updated_at: getCurrentTime()
      };
      data.schedules.push(schedule);
      
      // 添加处理轨迹
      data.processTraces.push({
        id: counters.trace++,
        schedule_id: schedule.id,
        action: 'schedule_created',
        operator: 'system',
        detail: '系统自动排班',
        created_at: getCurrentTime()
      });
      
      scheduledCount++;
    }
  }

  // 更新批次状态
  const batch = data.batches.find(b => b.id === batchId);
  if (batch) {
    batch.status = 'completed';
    batch.updated_at = getCurrentTime();
  }

  res.json({ scheduled: scheduledCount, message: '排班完成' });
});

// 4. 排班列表接口
app.get('/api/schedules/batch/:batchId', (req, res) => {
  const batchId = parseInt(req.params.batchId);
  const result = data.schedules
    .filter(s => s.batch_id === batchId)
    .map(s => {
      const e = data.elderly.find(ed => ed.id === s.elderly_id);
      const n = data.nurses.find(nu => nu.id === s.nurse_id);
      return {
        ...s,
        elderly_name: e ? e.name : '',
        nurse_name: n ? n.name : ''
      };
    })
    .sort((a, b) => {
      if (a.schedule_date !== b.schedule_date) return a.schedule_date.localeCompare(b.schedule_date);
      return a.time_slot.localeCompare(b.time_slot);
    });
  
  res.json(result);
});

// 5. 单条明细查询
app.get('/api/schedules/:id', (req, res) => {
  const schedule = data.schedules.find(s => s.id == req.params.id);
  if (!schedule) return res.status(404).json({ error: '排班记录不存在' });
  
  const e = data.elderly.find(ed => ed.id === schedule.elderly_id);
  const n = data.nurses.find(nu => nu.id === schedule.nurse_id);
  
  res.json({
    ...schedule,
    elderly_name: e ? e.name : '',
    elderly_phone: e ? e.phone : '',
    elderly_address: e ? e.address : '',
    nurse_name: n ? n.name : '',
    nurse_phone: n ? n.phone : ''
  });
});

// 6. 处理轨迹查询
app.get('/api/schedules/:id/traces', (req, res) => {
  const traces = data.processTraces
    .filter(t => t.schedule_id == req.params.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(traces);
});

// 7. 审计日志查询（谁改过、为什么改、改动前后）
app.get('/api/schedules/:id/audit', (req, res) => {
  const logs = data.auditLogs
    .filter(l => l.schedule_id == req.params.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(logs);
});

// 8. 修改排班（带审计）
app.put('/api/schedules/:id', (req, res) => {
  const { updates, operator, reason } = req.body;
  if (!updates || !operator || !reason) {
    return res.status(400).json({ error: '缺少必填字段: updates, operator, reason' });
  }

  const schedule = data.schedules.find(s => s.id == req.params.id);
  if (!schedule) return res.status(404).json({ error: '排班记录不存在' });

  // 记录审计日志
  for (const [field, value] of Object.entries(updates)) {
    if (schedule[field] !== undefined) {
      const oldVal = String(schedule[field] || '');
      const newVal = String(value || '');
      if (oldVal !== newVal) {
        data.auditLogs.push({
          id: counters.audit++,
          schedule_id: schedule.id,
          field_name: field,
          old_value: oldVal,
          new_value: newVal,
          change_reason: reason,
          changed_by: operator,
          created_at: getCurrentTime()
        });
      }
    }
  }

  // 更新排班
  Object.assign(schedule, updates);
  schedule.last_handler = operator;
  schedule.handled_at = getCurrentTime();
  schedule.updated_at = getCurrentTime();

  // 添加处理轨迹
  data.processTraces.push({
    id: counters.trace++,
    schedule_id: schedule.id,
    action: 'updated',
    operator,
    detail: reason,
    created_at: getCurrentTime()
  });

  const e = data.elderly.find(ed => ed.id === schedule.elderly_id);
  const n = data.nurses.find(nu => nu.id === schedule.nurse_id);

  res.json({
    ...schedule,
    elderly_name: e ? e.name : '',
    nurse_name: n ? n.name : ''
  });
});

// 9. 取消排班
app.post('/api/schedules/:id/cancel', (req, res) => {
  const { cancel_type, reason, operator } = req.body;
  if (!cancel_type || !reason || !operator) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  req.body.updates = {
    status: 'cancelled',
    cancel_type,
    cancel_reason: reason
  };
  req.body.reason = reason;
  req.body.operator = operator;
  
  app.handle(req, res);
});

// 10. 导出接口
app.get('/api/schedules/export/:batchId', (req, res) => {
  const batchId = parseInt(req.params.batchId);
  const result = data.schedules
    .filter(s => s.batch_id === batchId)
    .map(s => {
      const e = data.elderly.find(ed => ed.id === s.elderly_id);
      const n = data.nurses.find(nu => nu.id === s.nurse_id);
      return {
        schedule_id: s.id,
        schedule_date: s.schedule_date,
        time_slot: s.time_slot,
        status: s.status,
        nurse_name: n ? n.name : '',
        nurse_phone: n ? n.phone : '',
        elderly_name: e ? e.name : '',
        elderly_phone: e ? e.phone : '',
        elderly_address: e ? e.address : '',
        care_level: e ? e.care_level : '',
        care_items: e ? e.care_items : [],
        cancel_type: s.cancel_type || '',
        cancel_reason: s.cancel_reason || '',
        last_handler: s.last_handler || '',
        handled_at: s.handled_at || ''
      };
    })
    .sort((a, b) => {
      if (a.schedule_date !== b.schedule_date) return a.schedule_date.localeCompare(b.schedule_date);
      return a.time_slot.localeCompare(b.time_slot);
    });

  res.json(result);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '居家护理排班API服务运行正常',
    stats: {
      batches: data.batches.length,
      schedules: data.schedules.length
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
};

app.listen(PORT, () => {
  console.log(`居家护理排班API服务运行在 http://localhost:${PORT}`);
  console.log('健康检查: GET /health');
  console.log('');
  console.log('API接口列表:');
  console.log('  POST   /api/batches              - 创建批次');
  console.log('  GET    /api/batches              - 查询批次列表');
  console.log('  GET    /api/batches/:id          - 查询单个批次');
  console.log('  GET    /api/batches/:id/statistics - 查询批次统计');
  console.log('  POST   /api/materials            - 登记材料');
  console.log('  POST   /api/schedules/recalculate/:batchId - 触发重算');
  console.log('  GET    /api/schedules/batch/:batchId - 查询排班列表');
  console.log('  GET    /api/schedules/:id        - 查询单条明细');
  console.log('  GET    /api/schedules/:id/traces - 查询处理轨迹');
  console.log('  GET    /api/schedules/:id/audit  - 查询审计日志');
  console.log('  PUT    /api/schedules/:id        - 修改排班');
  console.log('  POST   /api/schedules/:id/cancel - 取消排班');
  console.log('  GET    /api/schedules/export/:batchId - 导出数据');
});

module.exports = app;
