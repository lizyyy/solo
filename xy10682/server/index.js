const express = require('express');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

let meterRecords = require('./data/mockData');
let versionHistory = require('./data/versionHistory');
let nextId = 101;

app.get('/api/records', (req, res) => {
  const { meterNo, customerName, status, responsiblePerson, startDate, endDate } = req.query;
  
  let filtered = [...meterRecords];
  
  if (meterNo) {
    filtered = filtered.filter(r => r.meterNo.includes(meterNo));
  }
  if (customerName) {
    filtered = filtered.filter(r => r.customerName.includes(customerName));
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }
  if (responsiblePerson) {
    filtered = filtered.filter(r => r.responsiblePerson === responsiblePerson);
  }
  if (startDate) {
    filtered = filtered.filter(r => new Date(r.readingDate) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(r => new Date(r.readingDate) <= new Date(endDate));
  }
  
  res.json(filtered);
});

app.get('/api/records/:id', (req, res) => {
  const record = meterRecords.find(r => r.id === parseInt(req.params.id));
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

app.post('/api/records/:id/verify', (req, res) => {
  const { id } = req.params;
  const { 
    newReading, 
    newEstimateFlag, 
    newAbnormalThreshold,
    reviewer,
    reviewNotes 
  } = req.body;
  
  const recordIndex = meterRecords.findIndex(r => r.id === parseInt(id));
  if (recordIndex === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const oldRecord = { ...meterRecords[recordIndex] };
  
  const version = {
    id: Date.now(),
    recordId: parseInt(id),
    before: {
      reading: oldRecord.currentReading,
      estimateFlag: oldRecord.estimateFlag,
      abnormalThreshold: oldRecord.abnormalThreshold,
      feeDifference: oldRecord.feeDifference
    },
    after: {
      reading: newReading,
      estimateFlag: newEstimateFlag,
      abnormalThreshold: newAbnormalThreshold,
      feeDifference: calculateFeeDifference(newReading, oldRecord.lastReading, oldRecord.tierPricing)
    },
    operator: reviewer,
    operationTime: new Date().toISOString()
  };
  
  versionHistory.push(version);
  
  meterRecords[recordIndex] = {
    ...oldRecord,
    currentReading: newReading,
    estimateFlag: newEstimateFlag,
    abnormalThreshold: newAbnormalThreshold,
    status: 'verified',
    reviewedBy: reviewer,
    reviewNotes: reviewNotes,
    reviewTime: new Date().toISOString(),
    feeDifference: version.after.feeDifference,
    usage: newReading - oldRecord.lastReading
  };
  
  res.json(meterRecords[recordIndex]);
});

app.post('/api/records/:id/photos', upload.single('photo'), (req, res) => {
  const { id } = req.params;
  const recordIndex = meterRecords.findIndex(r => r.id === parseInt(id));
  
  if (recordIndex === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }
  
  const photoUrl = `/uploads/${req.file.filename}`;
  meterRecords[recordIndex].reviewPhotos = meterRecords[recordIndex].reviewPhotos || [];
  meterRecords[recordIndex].reviewPhotos.push(photoUrl);
  
  res.json({ photoUrl, record: meterRecords[recordIndex] });
});

app.get('/api/statistics', (req, res) => {
  const stats = {
    total: meterRecords.length,
    pending: meterRecords.filter(r => r.status === 'pending').length,
    verified: meterRecords.filter(r => r.status === 'verified').length,
    abnormal: meterRecords.filter(r => r.isAbnormal).length,
    totalFeeDifference: meterRecords.reduce((sum, r) => sum + r.feeDifference, 0)
  };
  res.json(stats);
});

app.get('/api/records/:id/history', (req, res) => {
  const history = versionHistory.filter(v => v.recordId === parseInt(req.params.id));
  res.json(history);
});

app.get('/api/export', (req, res) => {
  const { responsiblePerson, startDate, endDate, format = 'xlsx' } = req.query;
  
  let data = [...meterRecords];
  
  if (responsiblePerson) {
    data = data.filter(r => r.responsiblePerson === responsiblePerson);
  }
  if (startDate) {
    data = data.filter(r => new Date(r.readingDate) >= new Date(startDate));
  }
  if (endDate) {
    data = data.filter(r => new Date(r.readingDate) <= new Date(endDate));
  }
  
  const exportData = data.map(r => ({
    '水表编号': r.meterNo,
    '客户名称': r.customerName,
    '抄表日期': r.readingDate,
    '上月读数': r.lastReading,
    '当前读数': r.currentReading,
    '用水量': r.usage,
    '估抄标记': r.estimateFlag ? '是' : '否',
    '异常状态': r.isAbnormal ? '异常' : '正常',
    '异常阈值': r.abnormalThreshold,
    '收费差异': r.feeDifference,
    '状态': r.status === 'pending' ? '待复核' : '已复核',
    '责任人': r.responsiblePerson,
    '复核人': r.reviewedBy || '',
    '复核时间': r.reviewTime || ''
  }));
  
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(exportData);
  xlsx.utils.book_append_sheet(wb, ws, '复核记录');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=water-meter-review.xlsx');
  res.send(buffer);
});

app.get('/api/responsible-persons', (req, res) => {
  const persons = [...new Set(meterRecords.map(r => r.responsiblePerson))];
  res.json(persons);
});

function calculateFeeDifference(current, last, tierPricing) {
  const usage = current - last;
  let actualFee = 0;
  let remaining = usage;
  
  for (const tier of tierPricing) {
    if (remaining <= 0) break;
    const tierUsage = Math.min(remaining, tier.limit || Infinity);
    actualFee += tierUsage * tier.price;
    remaining -= tierUsage;
  }
  
  const estimatedFee = usage * tierPricing[0].price;
  return Math.round((actualFee - estimatedFee) * 100) / 100;
}

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
