const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadDB, saveDB } = require('./models/db');
const { createMaterial } = require('./models/material');
const { createMeetingMinutes } = require('./models/meetingMinutes');
const { createCollision } = require('./models/collision');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const op = req.headers['x-operator'];
  if (op) {
    try {
      req.operator = decodeURIComponent(op);
    } catch (e) {
      req.operator = op;
    }
  } else {
    req.operator = '系统';
  }
  delete req.headers['x-operator'];
  req.headers['x-operator'] = req.operator;
  next();
});

app.get('/api/health', (req, res) => {
  const db = loadDB();
  res.json({
    code: 0,
    data: {
      status: 'ok',
      version: db.meta.version,
      lastUpdated: db.meta.lastUpdated,
      counts: {
        materials: db.materials.length,
        meetingMinutes: db.meetingMinutes.length,
        collisionPoints: db.collisionPoints.length
      }
    },
    message: '服务正常，状态已持久化到磁盘'
  });
});

app.post('/api/bootstrap', (req, res) => {
  const db = loadDB();
  const operator = req.headers['x-operator'] || '系统';

  const mat1 = createMaterial({
    materialNo: 'RZ-001',
    name: 'A栋南侧遮阳板铝合金型材',
    category: '铝合金型材',
    quantity: 320,
    unit: '根',
    specification: '6063-T5 壁厚2.0mm',
    status: 'pending',
    source: '示例数据-1号会议',
    reviewer: operator,
    remarks: '待碰撞复核'
  }, operator);

  const mat2 = createMaterial({
    materialNo: 'RZ-002',
    name: 'B栋西向Low-E中空玻璃',
    category: '玻璃',
    quantity: 0,
    unit: '㎡',
    specification: '',
    status: 'need_supplement',
    source: '示例数据-材料追踪',
    reviewer: operator,
    reviewConclusion: '缺少数量与规格参数',
    remarks: '需补充数量与规格'
  }, operator);

  const mat3 = createMaterial({
    materialNo: 'RZ-003',
    name: 'C栋屋面挑檐钢结构件',
    category: '钢结构',
    quantity: 48,
    unit: '件',
    specification: 'Q345B 焊接H型钢',
    status: 'pending',
    source: '示例数据'
  }, operator);

  const minutes = createMeetingMinutes({
    title: '2026年6月第一周结构复核例会',
    meetingDate: '2026-06-03',
    location: '结构专业会议室',
    attendees: ['老叶', '张工', '李工'],
    source: '示例导入',
    rawFields: { '会议主题': '结构复核', '日期': '2026-06-03' },
    items: [
      {
        '编号': 'RZ-001',
        '问题描述': 'A栋3层/轴C-5与暖通风管穿过遮阳板主龙骨',
        '责任人': '老叶',
        '要求时间': '2026-06-10',
        '处理状态': '待处理'
      },
      {
        'materialId': 'RZ-003',
        '碰撞描述': 'C栋屋面钢结构与幕墙埋件位置冲突，埋件偏位30mm',
        'owner': '老叶',
        'deadline': '2026-06-15'
      }
    ]
  }, operator);

  const item0 = minutes.items[0];
  const item1 = minutes.items[1];

  const col1 = createCollision({
    materialId: mat1.id,
    materialNo: 'RZ-001',
    buildingId: 'A栋',
    floor: '3',
    axisX: 'C',
    axisY: '5',
    type: '结构-暖通碰撞',
    severity: 'critical',
    description: '暖通风管穿过遮阳板主龙骨，需调整龙骨走向',
    originalQuote: 'A栋3层/轴C-5与暖通风管穿过遮阳板主龙骨',
    screenshot: null,
    cameraView: { eye: [120.5, 45.2, 30.1] },
    modelRef: 'A-03-S-001 / Revit',
    sourceMinutesId: minutes.id,
    sourceItemId: item0.itemId,
    sourceRef: `${minutes.title} · 第${item0.index}条`,
    assignedTo: '老叶',
    processingStatus: '待处理'
  }, operator);

  const col2 = createCollision({
    materialId: mat3.id,
    materialNo: 'RZ-003',
    buildingId: 'C栋',
    floor: '屋面层',
    axisX: 'J',
    axisY: '2-3',
    type: '埋件偏位',
    severity: 'warning',
    description: '幕墙埋件偏位30mm，需复核焊缝长度是否满足',
    originalQuote: 'C栋屋面钢结构与幕墙埋件位置冲突，埋件偏位30mm',
    cameraView: null,
    modelRef: 'C-RF-S-012',
    sourceMinutesId: minutes.id,
    sourceItemId: item1.itemId,
    sourceRef: `${minutes.title} · 第${item1.index}条`,
    assignedTo: '老叶',
    processingStatus: '待处理'
  }, operator);

  const db2 = loadDB();
  const m0idx = db2.meetingMinutes.findIndex(m => m.id === minutes.id);
  if (m0idx > -1) {
    const i0idx0 = db2.meetingMinutes[m0idx].items.findIndex(i => i.itemId === item0.itemId);
    if (i0idx0 > -1) {
      db2.meetingMinutes[m0idx].items[i0idx0].linkedMaterialId = mat1.id;
    }
    const i0idx1 = db2.meetingMinutes[m0idx].items.findIndex(i => i.itemId === item1.itemId);
    if (i0idx1 > -1) {
      db2.meetingMinutes[m0idx].items[i0idx1].linkedMaterialId = mat3.id;
    }
    saveDB(db2);
  }

  res.json({
    code: 0,
    message: '示例数据初始化完成',
    data: {
      materialsCreated: 3,
      minutesCreated: 1,
      collisionsCreated: 2
    }
  });
});

app.use('/api/materials', require('./routes/materials'));
app.use('/api/meeting-minutes', require('./routes/meetingMinutes'));
app.use('/api/collisions', require('./routes/collisions'));
app.use('/api/summary', require('./routes/summary'));

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`日照体量材料追踪 - 后端服务已启动: http://localhost:${PORT}`);
  console.log(`数据持久化目录: ${path.resolve(__dirname, '..', 'data')}`);
});
