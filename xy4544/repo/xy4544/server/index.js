const express = require('express');
const cors = require('cors');
const path = require('path');
require('./database');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sensorRoutes = require('./routes/sensorRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const alarmRoutes = require('./routes/alarmRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const exportRoutes = require('./routes/exportRoutes');
const sampleRoutes = require('./routes/sampleRoutes');

app.use('/api/sensors', sensorRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/sample', sampleRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '邮轮客舱维护工具 API 运行正常' });
});

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api/health`);
});
