const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
=============================================
🏋️ 健身房私教课消课API服务已启动
📍 服务地址: http://localhost:${PORT}
📡 API根路径: http://localhost:${PORT}/api
✅ 健康检查: http://localhost:${PORT}/api/health
=============================================
  `);
});
