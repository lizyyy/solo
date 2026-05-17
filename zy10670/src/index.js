const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

async function start() {
  try {
    await initDB();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
========================================
  园区能耗系统异常电表复核 API
  服务已启动
  端口: ${PORT}
  健康检查: http://localhost:${PORT}/api/health
========================================
      `);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();
