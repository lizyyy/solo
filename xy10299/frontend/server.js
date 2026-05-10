const express = require('express');
const path = require('path');
const app = express();
const PORT = 3003;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  市集共享冷柜占用结算台`);
  console.log(`========================================`);
  console.log(`前端地址: http://localhost:${PORT}`);
  console.log(`后端地址: http://localhost:3001`);
  console.log(`请确保后端服务已启动`);
  console.log(`========================================`);
});
