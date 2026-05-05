const express = require('express');
const app = express();

const PORT = 9000;

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok',
    port: PORT,
    message: '服务器运行正常'
  });
});

app.get('/', (req, res) => {
  res.send(`<h1>服务器运行在端口 ${PORT}</h1>
    <p>注意: README 中说的是 8080，但实际使用的是 ${PORT}</p>
    <p><a href="/api/status">查看状态 API</a></p>`);
});

app.listen(PORT, () => {
  console.log(`🚀 服务器已启动，监听端口 ${PORT}`);
  console.log(`   访问 http://localhost:${PORT}`);
  console.log(`   状态 API: http://localhost:${PORT}/api/status`);
});
