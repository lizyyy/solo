const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = require('./database/db');
const linenRoutes = require('./routes/linen');
const handoverRoutes = require('./routes/handover');
const factoryRoutes = require('./routes/factory');
const damageRoutes = require('./routes/damage');
const compensationRoutes = require('./routes/compensation');
const inventoryRoutes = require('./routes/inventory');
const reportRoutes = require('./routes/report');

app.use('/api/linen', linenRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/factory', factoryRoutes);
app.use('/api/damage', damageRoutes);
app.use('/api/compensation', compensationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/report', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '酒店布草洗涤追踪系统后端运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;