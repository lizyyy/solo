const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const reservationRoutes = require('./routes/reservationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '维修工单备件预占 API 服务运行正常', timestamp: new Date().toISOString() });
});

app.use('/api', reservationRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  维修工单备件预占 API 服务`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
});