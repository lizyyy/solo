const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const devicesRoutes = require('./routes/devices');
const ordersRoutes = require('./routes/orders');
const flowRoutes = require('./routes/flow');
const exceptionsRoutes = require('./routes/exceptions');
const reportsRoutes = require('./routes/reports');
const repairsRoutes = require('./routes/repairs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/devices', devicesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/flow', flowRoutes);
app.use('/api/exceptions', exceptionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/repairs', repairsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '景区讲解器管理系统后端服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
