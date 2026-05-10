const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = {
  stores: [],
  dishes: [],
  batches: [],
  samples: [],
  deliveries: [],
  temperature_anomalies: [],
  complaints: [],
  nextIds: {
    stores: 1,
    dishes: 1,
    batches: 1,
    samples: 1,
    deliveries: 1,
    temperature_anomalies: 1,
    complaints: 1
  }
};

function loadDB() {
  if (fs.existsSync(dbFile)) {
    try {
      const data = fs.readFileSync(dbFile, 'utf8');
      db = JSON.parse(data);
    } catch (e) {
      console.error('加载数据库失败，使用空数据库:', e.message);
    }
  }
}

function saveDB() {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('保存数据库失败:', e.message);
  }
}

function initSampleData() {
  if (db.stores.length > 0) {
    console.log('数据库已存在数据，跳过初始化');
    return;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const formatDate = (d) => d.toISOString().split('T')[0];
  const formatDateTime = (d) => d.toISOString();

  db.stores = [
    { id: 1, name: '幸福路店', address: '幸福路123号', contact_person: '张经理', phone: '13800138001', created_at: formatDateTime(today) },
    { id: 2, name: '建设路店', address: '建设路456号', contact_person: '李店长', phone: '13800138002', created_at: formatDateTime(today) },
    { id: 3, name: '人民广场店', address: '人民广场B1层', contact_person: '王主管', phone: '13800138003', created_at: formatDateTime(today) },
  ];

  db.dishes = [
    { id: 1, name: '红烧肉', code: 'HC001', category: '热菜', shelf_life_hours: 24, min_temp: 0, max_temp: 8, created_at: formatDateTime(today) },
    { id: 2, name: '清炒时蔬', code: 'SC001', category: '素菜', shelf_life_hours: 12, min_temp: 0, max_temp: 8, created_at: formatDateTime(today) },
    { id: 3, name: '糖醋排骨', code: 'PG001', category: '热菜', shelf_life_hours: 24, min_temp: 0, max_temp: 8, created_at: formatDateTime(today) },
    { id: 4, name: '米饭', code: 'MF001', category: '主食', shelf_life_hours: 6, min_temp: 60, max_temp: 80, created_at: formatDateTime(today) },
    { id: 5, name: '酸辣汤', code: 'ST001', category: '汤品', shelf_life_hours: 12, min_temp: 0, max_temp: 8, created_at: formatDateTime(today) },
  ];

  db.batches = [
    {
      id: 1,
      batch_no: `BATCH-${formatDate(yesterday)}-001`,
      dish_id: 1,
      production_date: formatDate(yesterday),
      production_time: '08:30',
      quantity: 50,
      unit: '份',
      responsible_person: '陈厨师',
      status: 'delivered',
      notes: '正常生产',
      created_at: formatDateTime(yesterday)
    },
    {
      id: 2,
      batch_no: `BATCH-${formatDate(yesterday)}-002`,
      dish_id: 2,
      production_date: formatDate(yesterday),
      production_time: '09:00',
      quantity: 80,
      unit: '份',
      responsible_person: '王厨师',
      status: 'delivered',
      notes: '正常生产',
      created_at: formatDateTime(yesterday)
    },
    {
      id: 3,
      batch_no: `BATCH-${formatDate(yesterday)}-003`,
      dish_id: 3,
      production_date: formatDate(yesterday),
      production_time: '23:30',
      quantity: 40,
      unit: '份',
      responsible_person: '刘厨师',
      status: 'delivered',
      notes: '夜间批次（边界值：时间跨天）',
      created_at: formatDateTime(yesterday)
    },
    {
      id: 4,
      batch_no: `BATCH-${formatDate(today)}-001`,
      dish_id: 4,
      production_date: formatDate(today),
      production_time: '10:00',
      quantity: 0,
      unit: '份',
      responsible_person: '',
      status: 'created',
      notes: '边界值：数量为零',
      created_at: formatDateTime(today)
    },
    {
      id: 5,
      batch_no: `BATCH-${formatDate(today)}-002`,
      dish_id: 1,
      production_date: formatDate(today),
      production_time: '11:00',
      quantity: 100,
      unit: '份',
      responsible_person: '陈厨师',
      status: 'in_progress',
      notes: '部分完成批次',
      created_at: formatDateTime(today)
    },
    {
      id: 6,
      batch_no: `BATCH-${formatDate(twoDaysAgo)}-001`,
      dish_id: 1,
      production_date: formatDate(twoDaysAgo),
      production_time: '09:00',
      quantity: 60,
      unit: '份',
      responsible_person: null,
      status: 'delivered',
      notes: '边界值：负责人缺失',
      created_at: formatDateTime(twoDaysAgo)
    },
  ];

  db.samples = [
    { id: 1, batch_id: 1, sample_weight: 150, storage_location: '冷藏柜A-01', sampler: '李质检员', status: 'stored', destroyed_at: null, notes: '留样正常', sample_time: formatDateTime(yesterday) },
    { id: 2, batch_id: 1, sample_weight: 150, storage_location: '冷藏柜A-02', sampler: '李质检员', status: 'stored', destroyed_at: null, notes: '备份留样', sample_time: formatDateTime(yesterday) },
    { id: 3, batch_id: 2, sample_weight: 100, storage_location: '冷藏柜A-03', sampler: '赵质检员', status: 'stored', destroyed_at: null, notes: '新鲜蔬菜留样', sample_time: formatDateTime(yesterday) },
    { id: 4, batch_id: 3, sample_weight: 150, storage_location: '冷藏柜B-01', sampler: '孙质检员', status: 'stored', destroyed_at: null, notes: '夜间生产批次', sample_time: formatDateTime(yesterday) },
    { id: 5, batch_id: 5, sample_weight: 150, storage_location: '冷藏柜C-01', sampler: '李质检员', status: 'stored', destroyed_at: null, notes: '已留样', sample_time: formatDateTime(today) },
    { id: 6, batch_id: 6, sample_weight: 150, storage_location: '冷藏柜D-01', sampler: null, status: 'destroyed', destroyed_at: formatDateTime(twoDaysAgo), notes: '留样已销毁', sample_time: formatDateTime(twoDaysAgo) },
  ];

  const lateDelivery = new Date(yesterday);
  lateDelivery.setHours(23, 55, 0);
  const arrived = new Date(today);
  arrived.setHours(0, 30, 0);

  db.deliveries = [
    { id: 1, batch_id: 1, store_id: 1, delivery_quantity: 30, dispatched_at: formatDateTime(yesterday), arrived_at: formatDateTime(yesterday), transport_temp: 4.5, received_by: '张经理', signature: '签收', status: 'completed', notes: '正常配送' },
    { id: 2, batch_id: 1, store_id: 2, delivery_quantity: 20, dispatched_at: formatDateTime(yesterday), arrived_at: formatDateTime(yesterday), transport_temp: 5.2, received_by: '李店长', signature: '签收', status: 'completed', notes: '正常配送' },
    { id: 3, batch_id: 2, store_id: 3, delivery_quantity: 80, dispatched_at: formatDateTime(yesterday), arrived_at: formatDateTime(yesterday), transport_temp: 15.5, received_by: '王主管', signature: '签收', status: 'completed', notes: '温度偏高' },
    { id: 4, batch_id: 3, store_id: 1, delivery_quantity: 40, dispatched_at: formatDateTime(lateDelivery), arrived_at: formatDateTime(arrived), transport_temp: 3.8, received_by: '张经理', signature: '签收', status: 'completed', notes: '跨天配送' },
    { id: 5, batch_id: 5, store_id: 2, delivery_quantity: 40, dispatched_at: formatDateTime(today), arrived_at: null, transport_temp: null, received_by: null, signature: null, status: 'in_transit', notes: '运输中' },
    { id: 6, batch_id: 5, store_id: 3, delivery_quantity: 60, dispatched_at: null, arrived_at: null, transport_temp: null, received_by: null, signature: null, status: 'pending', notes: '待配送' },
    { id: 7, batch_id: 6, store_id: 1, delivery_quantity: 60, dispatched_at: formatDateTime(twoDaysAgo), arrived_at: formatDateTime(twoDaysAgo), transport_temp: 5.0, received_by: '张经理', signature: '签收', status: 'completed', notes: '正常配送' },
  ];

  db.temperature_anomalies = [
    {
      id: 1,
      delivery_id: 3,
      recorded_temp: 15.5,
      min_temp: 0,
      max_temp: 8,
      anomaly_type: 'over_temp',
      handled: 1,
      handling_opinion: '配送车辆温控故障，已安排紧急检修。该批次菜品已通知门店退回处理。',
      handled_by: '周主管',
      handled_at: formatDateTime(yesterday),
      anomaly_time: formatDateTime(yesterday)
    }
  ];

  db.complaints = [
    {
      id: 1,
      complaint_no: `COMP-${formatDate(yesterday)}-001`,
      store_id: 3,
      complaint_date: formatDate(yesterday),
      dish_id: 2,
      batch_id: 2,
      complaint_type: 'quality',
      description: '清炒时蔬配送温度过高，部分蔬菜发黄变质，口感不佳。',
      reporter: '王主管',
      reporter_phone: '13800138003',
      status: 'resolved',
      resolution: '已确认温度异常记录，安排重新配送并对配送车辆进行检修。',
      resolved_at: formatDateTime(yesterday),
      created_at: formatDateTime(yesterday)
    },
    {
      id: 2,
      complaint_no: `COMP-${formatDate(today)}-001`,
      store_id: 1,
      complaint_date: formatDate(today),
      dish_id: 4,
      batch_id: null,
      complaint_type: 'delivery',
      description: '今日配送米饭数量不足，少送10份。',
      reporter: '张经理',
      reporter_phone: '13800138001',
      status: 'pending',
      resolution: null,
      resolved_at: null,
      created_at: formatDateTime(today)
    },
  ];

  db.nextIds = {
    stores: 4,
    dishes: 6,
    batches: 7,
    samples: 7,
    deliveries: 8,
    temperature_anomalies: 2,
    complaints: 3
  };

  saveDB();
  console.log('样例数据已初始化');
}

loadDB();
initSampleData();

function getDishById(id) {
  return db.dishes.find(d => d.id === id);
}

function getStoreById(id) {
  return db.stores.find(s => s.id === id);
}

function getBatchById(id) {
  return db.batches.find(b => b.id === id);
}

function hasSample(batchId) {
  return db.samples.some(s => s.batch_id === batchId);
}

function getDeliveriesByBatch(batchId) {
  return db.deliveries.filter(d => d.batch_id === batchId);
}

function enrichBatch(batch) {
  const dish = getDishById(batch.dish_id);
  const deliveries = getDeliveriesByBatch(batch.id);
  const completedDeliveries = deliveries.filter(d => d.status === 'completed');

  return {
    ...batch,
    dish_name: dish ? dish.name : null,
    category: dish ? dish.category : null,
    min_temp: dish ? dish.min_temp : null,
    max_temp: dish ? dish.max_temp : null,
    has_sample: hasSample(batch.id) ? 1 : 0,
    delivery_count: deliveries.length,
    completed_deliveries: completedDeliveries.length
  };
}

function enrichDelivery(delivery) {
  const batch = getBatchById(delivery.batch_id);
  const dish = batch ? getDishById(batch.dish_id) : null;
  const store = getStoreById(delivery.store_id);

  return {
    ...delivery,
    batch_no: batch ? batch.batch_no : null,
    dish_name: dish ? dish.name : null,
    min_temp: dish ? dish.min_temp : null,
    max_temp: dish ? dish.max_temp : null,
    store_name: store ? store.name : null,
    address: store ? store.address : null
  };
}

function enrichAnomaly(anomaly) {
  const delivery = db.deliveries.find(d => d.id === anomaly.delivery_id);
  if (!delivery) return anomaly;

  const batch = getBatchById(delivery.batch_id);
  const dish = batch ? getDishById(batch.dish_id) : null;
  const store = getStoreById(delivery.store_id);

  return {
    ...anomaly,
    batch_id: batch ? batch.id : null,
    batch_no: batch ? batch.batch_no : null,
    store_id: store ? store.id : null,
    store_name: store ? store.name : null,
    dish_name: dish ? dish.name : null
  };
}

function enrichComplaint(complaint) {
  const store = getStoreById(complaint.store_id);
  const dish = getDishById(complaint.dish_id);
  const batch = complaint.batch_id ? getBatchById(complaint.batch_id) : null;

  return {
    ...complaint,
    store_name: store ? store.name : null,
    dish_name: dish ? dish.name : null,
    batch_no: batch ? batch.batch_no : null
  };
}

app.get('/api/stores', (req, res) => {
  res.json(db.stores.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')));
});

app.get('/api/dishes', (req, res) => {
  res.json(db.dishes.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh')));
});

app.post('/api/batches', (req, res) => {
  const { batch_no, dish_id, production_date, production_time, quantity, unit, responsible_person, notes } = req.body;

  if (!batch_no || !dish_id || !production_date || !production_time) {
    return res.status(400).json({ error: '批次号、菜品、生产日期和时间为必填项' });
  }

  const existing = db.batches.find(b => b.batch_no === batch_no);
  if (existing) {
    return res.status(400).json({ error: '批次号已存在' });
  }

  const newBatch = {
    id: db.nextIds.batches++,
    batch_no,
    dish_id,
    production_date,
    production_time,
    quantity: quantity !== undefined ? parseFloat(quantity) : 0,
    unit: unit || '份',
    responsible_person: responsible_person || null,
    status: 'created',
    notes: notes || null,
    created_at: new Date().toISOString()
  };

  db.batches.push(newBatch);
  saveDB();

  res.json({ id: newBatch.id, message: '批次创建成功' });
});

app.get('/api/batches', (req, res) => {
  const { date, status } = req.query;

  let batches = [...db.batches];

  if (date) {
    batches = batches.filter(b => b.production_date === date);
  }

  if (status) {
    batches = batches.filter(b => b.status === status);
  }

  batches.sort((a, b) => {
    if (a.production_date !== b.production_date) {
      return b.production_date.localeCompare(a.production_date);
    }
    return b.production_time.localeCompare(a.production_time);
  });

  res.json(batches.map(enrichBatch));
});

app.get('/api/batches/:id', (req, res) => {
  const batchId = parseInt(req.params.id);
  const batch = db.batches.find(b => b.id === batchId);

  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const dish = getDishById(batch.dish_id);
  const enrichedBatch = {
    ...batch,
    dish_name: dish ? dish.name : null,
    category: dish ? dish.category : null,
    min_temp: dish ? dish.min_temp : null,
    max_temp: dish ? dish.max_temp : null,
    shelf_life_hours: dish ? dish.shelf_life_hours : null,
    has_sample: hasSample(batchId) ? 1 : 0
  };

  const samples = db.samples.filter(s => s.batch_id === batchId);
  const deliveries = db.deliveries.filter(d => d.batch_id === batchId).map(d => enrichDelivery(d));
  const anomalies = db.temperature_anomalies.filter(ta => {
    const delivery = db.deliveries.find(d => d.id === ta.delivery_id);
    return delivery && delivery.batch_id === batchId;
  }).map(a => enrichAnomaly(a));

  res.json({ batch: enrichedBatch, samples, deliveries, anomalies });
});

app.post('/api/samples', (req, res) => {
  const { batch_id, sample_weight, storage_location, sampler, notes } = req.body;

  if (!batch_id || sample_weight === undefined || !storage_location) {
    return res.status(400).json({ error: '批次ID、留样重量和存放位置为必填项' });
  }

  const weight = parseFloat(sample_weight);
  if (weight <= 0) {
    return res.status(400).json({ error: '留样重量必须大于0' });
  }

  const newSample = {
    id: db.nextIds.samples++,
    batch_id: parseInt(batch_id),
    sample_weight: weight,
    storage_location,
    sampler: sampler || null,
    status: 'stored',
    destroyed_at: null,
    notes: notes || null,
    sample_time: new Date().toISOString()
  };

  db.samples.push(newSample);
  saveDB();

  res.json({ id: newSample.id, message: '留样记录成功' });
});

app.post('/api/deliveries', (req, res) => {
  const { batch_id, store_id, delivery_quantity, notes } = req.body;

  if (!batch_id || !store_id || delivery_quantity === undefined) {
    return res.status(400).json({ error: '批次ID、门店ID和配送数量为必填项' });
  }

  const qty = parseFloat(delivery_quantity);
  if (qty <= 0) {
    return res.status(400).json({ error: '配送数量必须大于0' });
  }

  const newDelivery = {
    id: db.nextIds.deliveries++,
    batch_id: parseInt(batch_id),
    store_id: parseInt(store_id),
    delivery_quantity: qty,
    dispatched_at: null,
    arrived_at: null,
    transport_temp: null,
    received_by: null,
    signature: null,
    status: 'pending',
    notes: notes || null
  };

  db.deliveries.push(newDelivery);

  const batch = db.batches.find(b => b.id === parseInt(batch_id));
  if (batch && batch.status === 'created') {
    batch.status = 'in_progress';
  }

  saveDB();

  res.json({ id: newDelivery.id, message: '配送记录创建成功' });
});

app.put('/api/deliveries/:id/complete', (req, res) => {
  const deliveryId = parseInt(req.params.id);
  const { transport_temp, received_by, signature, notes } = req.body;

  const delivery = db.deliveries.find(d => d.id === deliveryId);
  if (!delivery) {
    return res.status(404).json({ error: '配送记录不存在' });
  }

  if (!hasSample(delivery.batch_id)) {
    return res.status(400).json({ error: '未留样的批次不能标记已配送完成！请先完成留样登记。' });
  }

  const batch = db.batches.find(b => b.id === delivery.batch_id);
  const dish = batch ? getDishById(batch.dish_id) : null;

  if (transport_temp !== null && transport_temp !== undefined && transport_temp !== '') {
    const temp = parseFloat(transport_temp);
    if (dish && (temp < dish.min_temp || temp > dish.max_temp)) {
      return res.status(400).json({
        error: '温度异常！请先记录温度异常并填写处理意见后再完成配送。',
        temp_anomaly: true,
        recorded_temp: temp,
        min_temp: dish.min_temp,
        max_temp: dish.max_temp
      });
    }
    delivery.transport_temp = temp;
  }

  delivery.status = 'completed';
  delivery.arrived_at = new Date().toISOString();
  delivery.received_by = received_by || null;
  delivery.signature = signature || '已签收';
  if (notes) delivery.notes = notes;

  const allDeliveries = getDeliveriesByBatch(delivery.batch_id);
  const allCompleted = allDeliveries.every(d => d.status === 'completed');

  if (batch) {
    batch.status = allCompleted ? 'delivered' : 'in_progress';
  }

  saveDB();

  res.json({ message: '配送完成' });
});

app.post('/api/temperature-anomalies', (req, res) => {
  const { delivery_id, recorded_temp, min_temp, max_temp, handling_opinion, handled_by } = req.body;

  if (!delivery_id || recorded_temp === undefined || !min_temp || !max_temp) {
    return res.status(400).json({ error: '配送ID、记录温度和温度范围为必填项' });
  }

  const recordedTemp = parseFloat(recorded_temp);
  const anomaly_type = recordedTemp < min_temp ? 'under_temp' : 'over_temp';

  if (!handling_opinion || !handling_opinion.trim()) {
    return res.status(400).json({ error: '温度异常必须填写处理意见！' });
  }

  const newAnomaly = {
    id: db.nextIds.temperature_anomalies++,
    delivery_id: parseInt(delivery_id),
    recorded_temp: recordedTemp,
    min_temp: parseFloat(min_temp),
    max_temp: parseFloat(max_temp),
    anomaly_type,
    handled: 1,
    handling_opinion,
    handled_by: handled_by || null,
    handled_at: new Date().toISOString(),
    anomaly_time: new Date().toISOString()
  };

  db.temperature_anomalies.push(newAnomaly);
  saveDB();

  res.json({ id: newAnomaly.id, message: '温度异常记录成功' });
});

app.get('/api/temperature-anomalies', (req, res) => {
  const anomalies = db.temperature_anomalies
    .slice()
    .sort((a, b) => new Date(b.anomaly_time) - new Date(a.anomaly_time))
    .map(enrichAnomaly);

  res.json(anomalies);
});

app.post('/api/complaints', (req, res) => {
  const { store_id, complaint_date, dish_id, batch_id, complaint_type, description, reporter, reporter_phone } = req.body;

  if (!store_id || !complaint_date || !dish_id || !description) {
    return res.status(400).json({ error: '门店、投诉日期、菜品和描述为必填项' });
  }

  let validBatch = null;
  if (batch_id) {
    const batch = db.batches.find(b => b.id === parseInt(batch_id) && b.dish_id === parseInt(dish_id));

    if (!batch) {
      return res.status(400).json({ error: '投诉只能关联到对应日期和菜品的批次！批次与菜品不匹配。' });
    }

    const complaintDate = new Date(complaint_date);
    const productionDate = new Date(batch.production_date);
    const diffDays = Math.floor((complaintDate - productionDate) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || diffDays > 7) {
      return res.status(400).json({ error: '投诉只能关联到7天内的对应批次！' });
    }

    validBatch = parseInt(batch_id);
  }

  const newComplaint = {
    id: db.nextIds.complaints++,
    complaint_no: `COMP-${complaint_date}-${String(Date.now()).slice(-4)}`,
    store_id: parseInt(store_id),
    complaint_date,
    dish_id: parseInt(dish_id),
    batch_id: validBatch,
    complaint_type: complaint_type || 'other',
    description,
    reporter: reporter || null,
    reporter_phone: reporter_phone || null,
    status: 'pending',
    resolution: null,
    resolved_at: null,
    created_at: new Date().toISOString()
  };

  db.complaints.push(newComplaint);
  saveDB();

  res.json({ id: newComplaint.id, complaint_no: newComplaint.complaint_no, message: '投诉记录成功' });
});

app.get('/api/complaints', (req, res) => {
  const complaints = db.complaints
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(enrichComplaint);

  res.json(complaints);
});

app.put('/api/complaints/:id/resolve', (req, res) => {
  const complaintId = parseInt(req.params.id);
  const { resolution } = req.body;

  if (!resolution || !resolution.trim()) {
    return res.status(400).json({ error: '必须填写处理方案' });
  }

  const complaint = db.complaints.find(c => c.id === complaintId);
  if (!complaint) {
    return res.status(404).json({ error: '投诉不存在' });
  }

  complaint.status = 'resolved';
  complaint.resolution = resolution;
  complaint.resolved_at = new Date().toISOString();

  saveDB();

  res.json({ message: '投诉已处理' });
});

app.get('/api/traceability/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const itemId = parseInt(id);

  if (type === 'complaint') {
    const complaint = db.complaints.find(c => c.id === itemId);
    if (!complaint) {
      return res.status(404).json({ error: '投诉不存在' });
    }

    const enriched = enrichComplaint(complaint);
    const result = { complaint: enriched };

    if (complaint.batch_id) {
      result.samples = db.samples.filter(s => s.batch_id === complaint.batch_id);
      result.deliveries = db.deliveries.filter(d => d.batch_id === complaint.batch_id).map(d => enrichDelivery(d));
      result.anomalies = db.temperature_anomalies.filter(ta => {
        const delivery = db.deliveries.find(d => d.id === ta.delivery_id);
        return delivery && delivery.batch_id === complaint.batch_id;
      });
    }

    res.json(result);

  } else if (type === 'batch') {
    const batch = db.batches.find(b => b.id === itemId);
    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const dish = getDishById(batch.dish_id);
    res.json({
      batch: {
        ...batch,
        dish_name: dish ? dish.name : null,
        code: dish ? dish.code : null,
        category: dish ? dish.category : null,
        min_temp: dish ? dish.min_temp : null,
        max_temp: dish ? dish.max_temp : null,
        shelf_life_hours: dish ? dish.shelf_life_hours : null
      },
      samples: db.samples.filter(s => s.batch_id === itemId),
      deliveries: db.deliveries.filter(d => d.batch_id === itemId).map(d => enrichDelivery(d)),
      anomalies: db.temperature_anomalies.filter(ta => {
        const delivery = db.deliveries.find(d => d.id === ta.delivery_id);
        return delivery && delivery.batch_id === itemId;
      }),
      complaints: db.complaints.filter(c => c.batch_id === itemId).map(enrichComplaint)
    });
  } else {
    res.status(400).json({ error: '无效的追溯类型' });
  }
});

app.get('/api/export/traceability/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const itemId = parseInt(id);

  let report = '';

  if (type === 'complaint') {
    const complaint = db.complaints.find(c => c.id === itemId);
    if (!complaint) {
      return res.status(404).send('投诉不存在');
    }

    const store = getStoreById(complaint.store_id);
    const dish = getDishById(complaint.dish_id);
    const batch = complaint.batch_id ? db.batches.find(b => b.id === complaint.batch_id) : null;
    const batchDish = batch ? getDishById(batch.dish_id) : null;

    report = `==============================================\n`;
    report += `       餐饮追溯报告 - 投诉追溯\n`;
    report += `==============================================\n\n`;
    report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `\n----------------------------------------------\n`;
    report += `【投诉信息】\n`;
    report += `----------------------------------------------\n`;
    report += `投诉编号: ${complaint.complaint_no}\n`;
    report += `投诉门店: ${store ? store.name : '未知'} (${store ? store.address : '未填写'})\n`;
    report += `投诉日期: ${complaint.complaint_date}\n`;
    report += `投诉类型: ${getComplaintTypeText(complaint.complaint_type)}\n`;
    report += `投诉人: ${complaint.reporter || '未填写'} (${complaint.reporter_phone || '无电话'})\n`;
    report += `投诉描述: ${complaint.description}\n`;
    report += `当前状态: ${complaint.status === 'resolved' ? '已处理' : '待处理'}\n`;
    if (complaint.resolution) {
      report += `处理方案: ${complaint.resolution}\n`;
    }

    if (batch && batchDish) {
      report += `\n----------------------------------------------\n`;
      report += `【关联批次信息】\n`;
      report += `----------------------------------------------\n`;
      report += `批次号: ${batch.batch_no}\n`;
      report += `菜品名称: ${batchDish.name} (${batchDish.code})\n`;
      report += `菜品分类: ${batchDish.category}\n`;
      report += `生产日期: ${batch.production_date} ${batch.production_time}\n`;
      report += `生产数量: ${batch.quantity} ${batch.unit}\n`;
      report += `负责人: ${batch.responsible_person || '未填写（边界值：负责人缺失）'}\n`;
      report += `温度要求: ${batchDish.min_temp}°C ~ ${batchDish.max_temp}°C\n`;

      const samples = db.samples.filter(s => s.batch_id === batch.id);
      if (samples.length > 0) {
        report += `\n----------------------------------------------\n`;
        report += `【留样记录】\n`;
        report += `----------------------------------------------\n`;
        samples.forEach((s, idx) => {
          report += `\n留样 ${idx + 1}:\n`;
          report += `  留样重量: ${s.sample_weight}g\n`;
          report += `  存放位置: ${s.storage_location}\n`;
          report += `  留样时间: ${formatDateTime(s.sample_time)}\n`;
          report += `  留样人: ${s.sampler || '未填写'}\n`;
          report += `  状态: ${s.status === 'destroyed' ? '已销毁' : '保存中'}\n`;
          if (s.destroyed_at) {
            report += `  销毁时间: ${formatDateTime(s.destroyed_at)}\n`;
          }
          if (s.notes) {
            report += `  备注: ${s.notes}\n`;
          }
        });
      }

      const deliveries = db.deliveries.filter(d => d.batch_id === batch.id);
      if (deliveries.length > 0) {
        report += `\n----------------------------------------------\n`;
        report += `【配送记录】\n`;
        report += `----------------------------------------------\n`;
        deliveries.forEach((d, idx) => {
          const delStore = getStoreById(d.store_id);
          report += `\n配送 ${idx + 1}:\n`;
          report += `  目的门店: ${delStore ? delStore.name : '未知'}\n`;
          report += `  配送数量: ${d.delivery_quantity}\n`;
          const statusMap = { pending: '待配送', in_transit: '运输中', completed: '已完成' };
          report += `  状态: ${statusMap[d.status] || d.status}\n`;
          if (d.dispatched_at) report += `  发货时间: ${formatDateTime(d.dispatched_at)}\n`;
          if (d.arrived_at) report += `  到达时间: ${formatDateTime(d.arrived_at)}\n`;
          if (d.transport_temp !== null && d.transport_temp !== undefined) {
            report += `  配送温度: ${d.transport_temp}°C\n`;
            if (d.transport_temp < batchDish.min_temp || d.transport_temp > batchDish.max_temp) {
              report += `  ⚠️ 温度异常！范围要求: ${batchDish.min_temp}°C ~ ${batchDish.max_temp}°C\n`;
            }
          }
          if (d.received_by) report += `  签收人: ${d.received_by}\n`;
          if (d.notes) report += `  备注: ${d.notes}\n`;
        });

        const anomalies = db.temperature_anomalies.filter(ta => {
          const delivery = db.deliveries.find(d => d.id === ta.delivery_id);
          return delivery && delivery.batch_id === batch.id;
        });

        if (anomalies.length > 0) {
          report += `\n----------------------------------------------\n`;
          report += `【温度异常记录】\n`;
          report += `----------------------------------------------\n`;
          anomalies.forEach((a, idx) => {
            report += `\n异常 ${idx + 1}:\n`;
            report += `  异常时间: ${formatDateTime(a.anomaly_time)}\n`;
            report += `  记录温度: ${a.recorded_temp}°C\n`;
            report += `  允许范围: ${a.min_temp}°C ~ ${a.max_temp}°C\n`;
            report += `  异常类型: ${a.anomaly_type === 'over_temp' ? '温度超限（过高）' : '温度超限（过低）'}\n`;
            report += `  处理意见: ${a.handling_opinion || '未填写'}\n`;
            report += `  处理人: ${a.handled_by || '未填写'}\n`;
            report += `  状态: ${a.handled ? '已处理' : '待处理'}\n`;
          });
        }
      }
    } else {
      report += `\n----------------------------------------------\n`;
      report += `⚠️ 该投诉暂未关联到具体批次，无法追溯完整链路。\n`;
      report += `   请在投诉详情中关联对应批次。\n`;
      report += `----------------------------------------------\n`;
    }

    report += `\n==============================================\n`;
    report += `         报告结束\n`;
    report += `==============================================\n`;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="traceability_report_${type}_${id}.txt"`);
  res.send(report);
});

function getComplaintTypeText(type) {
  const map = {
    quality: '质量问题',
    delivery: '配送问题',
    quantity: '数量问题',
    temperature: '温度问题',
    other: '其他'
  };
  return map[type] || type;
}

function formatDateTime(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

app.get('/api/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const todayBatches = db.batches.filter(b => b.production_date === today).length;
  const pendingDeliveries = db.deliveries.filter(d => d.status === 'pending').length;
  const inTransit = db.deliveries.filter(d => d.status === 'in_transit').length;
  const completedDeliveries = db.deliveries.filter(d => d.status === 'completed').length;
  const pendingAnomalies = db.temperature_anomalies.filter(a => !a.handled).length;
  const pendingComplaints = db.complaints.filter(c => c.status === 'pending').length;
  const withoutSamples = db.batches.filter(b => !hasSample(b.id)).length;

  res.json({
    total_batches: db.batches.length,
    today_batches: todayBatches,
    pending_deliveries: pendingDeliveries,
    in_transit: inTransit,
    completed_deliveries: completedDeliveries,
    pending_anomalies: pendingAnomalies,
    pending_complaints: pendingComplaints,
    without_samples: withoutSamples
  });
});

app.listen(PORT, () => {
  console.log(`餐饮中央厨房留样台系统已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
});
