const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const db = require('./database');

const residentsRoutes = require('./routes/residents');
const deliveryRoutes = require('./routes/delivery');
const pointsRoutes = require('./routes/points');
const exchangeRoutes = require('./routes/exchange');
const complaintsRoutes = require('./routes/complaints');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/residents', residentsRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', details: err.message });
});

app.listen(PORT, () => {
  console.log(`垃圾分类积分台后端服务运行在端口 ${PORT}`);
});
