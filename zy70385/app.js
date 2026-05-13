const express = require('express');
const compressionRoutes = require('./routes/compression');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/compression', compressionRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API响应压缩策略管理系统运行中', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
