const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '药品库存接口台服务正常', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`药品库存接口台后端服务运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`API文档前缀: /api/inventory`);
});
