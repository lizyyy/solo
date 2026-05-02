const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`物业寄存管理系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`数据目录: ${path.join(__dirname, '..', 'data')}`);
});
