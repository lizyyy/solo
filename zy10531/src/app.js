const express = require('express');
const cors = require('cors');
const vendorRoutes = require('./routes/vendorRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '供应商资料校验API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/vendors', vendorRoutes);

app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`
==========================================
  供应商资料校验API已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
==========================================
  `);
});
