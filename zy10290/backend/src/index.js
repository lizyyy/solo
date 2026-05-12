const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const activitiesRouter = require('./routes/activities');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/activities', activitiesRouter);
app.use('/api/orders', ordersRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`秒杀补单平台后端服务已启动: http://localhost:${PORT}`);
});
