const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const db = require('./database');
const workOrdersRouter = require('./routes/workOrders');
const sparePartsRouter = require('./routes/spareParts');
const dashboardRouter = require('./routes/dashboard');

app.use('/api/work-orders', workOrdersRouter);
app.use('/api/spare-parts', sparePartsRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
});
