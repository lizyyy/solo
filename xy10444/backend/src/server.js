require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const materialsRouter = require('./routes/materials');
const workOrdersRouter = require('./routes/workOrders');
const settlementsRouter = require('./routes/settlements');
const dashboardRouter = require('./routes/dashboard');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '社区维修材料核销台API运行正常' });
});

app.use('/api/materials', materialsRouter);
app.use('/api/work-orders', workOrdersRouter);
app.use('/api/settlements', settlementsRouter);
app.use('/api/dashboard', dashboardRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`API地址: http://localhost:${PORT}/api`);
});
