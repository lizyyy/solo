const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

let vaccineRecords = [];
let changeHistory = [];

const petBreeds = ['金毛', '泰迪', '布偶猫', '英短猫', '拉布拉多', '哈士奇'];
const vaccineBatches = ['VAC2024001', 'VAC2024002', 'VAC2024003', 'VAC2024004'];
const abnormalReactions = ['发热', '呕吐', '无反应', '局部红肿', '食欲下降', '精神萎靡'];
const followUpResults = ['良好', '需复诊', '恢复中', '未联系', '已康复', '需观察'];
const handlers = ['张医生', '李护士', '王兽医', '赵助理'];

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function initSampleData() {
  const sampleData = [
    {
      id: generateId(),
      petName: '旺财',
      petBreed: '金毛',
      vaccineBatch: 'VAC2024001',
      intervalDays: 21,
      abnormalReaction: '无反应',
      appointmentReminder: '2024-02-20',
      followUpResult: '良好',
      handler: '张医生',
      createdAt: '2024-01-20T10:00:00',
      updatedAt: '2024-01-20T10:00:00'
    },
    {
      id: generateId(),
      petName: '豆豆',
      petBreed: '泰迪',
      vaccineBatch: 'VAC2024001',
      intervalDays: 21,
      abnormalReaction: '发热',
      appointmentReminder: '2024-02-22',
      followUpResult: '恢复中',
      handler: '李护士',
      createdAt: '2024-01-22T14:30:00',
      updatedAt: '2024-01-22T14:30:00'
    },
    {
      id: generateId(),
      petName: '咪咪',
      petBreed: '布偶猫',
      vaccineBatch: 'VAC2024002',
      intervalDays: 28,
      abnormalReaction: '局部红肿',
      appointmentReminder: '2024-02-25',
      followUpResult: '需复诊',
      handler: '王兽医',
      createdAt: '2024-01-25T09:15:00',
      updatedAt: '2024-01-25T09:15:00'
    },
    {
      id: generateId(),
      petName: '肥仔',
      petBreed: '英短猫',
      vaccineBatch: 'VAC2024002',
      intervalDays: 28,
      abnormalReaction: '无反应',
      appointmentReminder: '2024-02-28',
      followUpResult: '良好',
      handler: '张医生',
      createdAt: '2024-01-28T16:45:00',
      updatedAt: '2024-01-28T16:45:00'
    },
    {
      id: generateId(),
      petName: '拉K',
      petBreed: '拉布拉多',
      vaccineBatch: 'VAC2024003',
      intervalDays: 14,
      abnormalReaction: '呕吐',
      appointmentReminder: '2024-02-10',
      followUpResult: '已康复',
      handler: '赵助理',
      createdAt: '2024-01-10T11:20:00',
      updatedAt: '2024-01-10T11:20:00'
    },
    {
      id: generateId(),
      petName: '哈哈',
      petBreed: '哈士奇',
      vaccineBatch: 'VAC2024003',
      intervalDays: 14,
      abnormalReaction: '食欲下降',
      appointmentReminder: '2024-02-12',
      followUpResult: '需观察',
      handler: '李护士',
      createdAt: '2024-01-12T13:50:00',
      updatedAt: '2024-01-12T13:50:00'
    }
  ];
  vaccineRecords = sampleData;
}

initSampleData();

app.get('/api/vaccines', (req, res) => {
  const { search, petBreed, batchNo } = req.query;
  let result = [...vaccineRecords];

  if (search) {
    result = result.filter(r => 
      r.petName.includes(search) || 
      r.petBreed.includes(search) || 
      r.vaccineBatch.includes(search)
    );
  }

  if (petBreed) {
    result = result.filter(r => r.petBreed === petBreed);
  }

  if (batchNo) {
    result = result.filter(r => r.vaccineBatch === batchNo);
  }

  res.json(result);
});

app.get('/api/vaccines/:id', (req, res) => {
  const record = vaccineRecords.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: '疫苗记录不存在' });
  }
  res.json(record);
});

app.post('/api/vaccines/validate', (req, res) => {
  const { batchNo, petBreed } = req.body;
  
  if (!batchNo || !petBreed) {
    return res.status(400).json({ error: '批次号和宠物品种不能为空' });
  }

  const validBatch = vaccineBatches.includes(batchNo);
  const validBreed = petBreeds.includes(petBreed);

  res.json({
    valid: validBatch && validBreed,
    batchValid: validBatch,
    breedValid: validBreed,
    message: validBatch && validBreed ? '校验通过' : '校验失败'
  });
});

app.put('/api/vaccines/:id', (req, res) => {
  const index = vaccineRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '疫苗记录不存在' });
  }

  const oldRecord = { ...vaccineRecords[index] };
  const { petBreed, vaccineBatch, intervalDays, abnormalReaction, appointmentReminder, followUpResult, handler } = req.body;

  const changes = [];
  
  if (petBreed && petBreed !== oldRecord.petBreed) {
    changes.push({
      field: 'petBreed',
      fieldName: '宠物品种',
      oldValue: oldRecord.petBreed,
      newValue: petBreed
    });
  }
  
  if (vaccineBatch && vaccineBatch !== oldRecord.vaccineBatch) {
    changes.push({
      field: 'vaccineBatch',
      fieldName: '疫苗批次',
      oldValue: oldRecord.vaccineBatch,
      newValue: vaccineBatch
    });
  }
  
  if (intervalDays && intervalDays !== oldRecord.intervalDays) {
    changes.push({
      field: 'intervalDays',
      fieldName: '接种间隔',
      oldValue: oldRecord.intervalDays,
      newValue: intervalDays
    });
  }

  if (changes.length > 0) {
    changeHistory.push({
      id: generateId(),
      recordId: oldRecord.id,
      petName: oldRecord.petName,
      changes,
      handler: handler || '未知',
      changeTime: new Date().toISOString()
    });
  }

  vaccineRecords[index] = {
    ...oldRecord,
    petBreed: petBreed || oldRecord.petBreed,
    vaccineBatch: vaccineBatch || oldRecord.vaccineBatch,
    intervalDays: intervalDays || oldRecord.intervalDays,
    abnormalReaction: abnormalReaction || oldRecord.abnormalReaction,
    appointmentReminder: appointmentReminder || oldRecord.appointmentReminder,
    followUpResult: followUpResult || oldRecord.followUpResult,
    handler: handler || oldRecord.handler,
    updatedAt: new Date().toISOString()
  };

  res.json(vaccineRecords[index]);
});

app.post('/api/vaccines/:id/abnormal', (req, res) => {
  const index = vaccineRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '疫苗记录不存在' });
  }

  const { status, handler } = req.body;
  vaccineRecords[index].abnormalReaction = status || vaccineRecords[index].abnormalReaction;
  vaccineRecords[index].handler = handler || vaccineRecords[index].handler;
  vaccineRecords[index].updatedAt = new Date().toISOString();

  res.json(vaccineRecords[index]);
});

app.post('/api/vaccines/:id/reminder', (req, res) => {
  const index = vaccineRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '疫苗记录不存在' });
  }

  const { reminderDate, handler } = req.body;
  vaccineRecords[index].appointmentReminder = reminderDate || vaccineRecords[index].appointmentReminder;
  vaccineRecords[index].handler = handler || vaccineRecords[index].handler;
  vaccineRecords[index].updatedAt = new Date().toISOString();

  res.json(vaccineRecords[index]);
});

app.get('/api/statistics', (req, res) => {
  const total = vaccineRecords.length;
  const abnormalCount = vaccineRecords.filter(r => r.abnormalReaction !== '无反应').length;
  const pendingFollowUp = vaccineRecords.filter(r => r.followUpResult === '需观察' || r.followUpResult === '恢复中').length;
  
  const batchStats = {};
  vaccineBatches.forEach(batch => {
    batchStats[batch] = vaccineRecords.filter(r => r.vaccineBatch === batch).length;
  });

  res.json({
    total,
    abnormalCount,
    pendingFollowUp,
    batchStats
  });
});

app.get('/api/history', (req, res) => {
  res.json(changeHistory);
});

app.get('/api/report', (req, res) => {
  const { handler, startTime, endTime } = req.query;
  let result = [...changeHistory];

  if (handler) {
    result = result.filter(h => h.handler === handler);
  }

  if (startTime) {
    result = result.filter(h => new Date(h.changeTime) >= new Date(startTime));
  }

  if (endTime) {
    result = result.filter(h => new Date(h.changeTime) <= new Date(endTime));
  }

  res.json(result);
});

app.get('/api/options', (req, res) => {
  res.json({
    petBreeds,
    vaccineBatches,
    abnormalReactions,
    followUpResults,
    handlers
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
