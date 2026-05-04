const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, closeDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function startServer() {
  try {
    console.log('正在初始化数据库...');
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`陶艺小窑烧成曲线预演工具已启动`);
      console.log(`本地访问地址: http://localhost:${PORT}`);
      console.log(`API地址: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭服务器...');
  closeDatabase();
  process.exit(0);
});

startServer();
