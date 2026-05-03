const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = require('./src/storage');
const apiRoutes = require('./src/api');

app.use('/api', apiRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await storage.initDatabase();
    console.log('数据库初始化成功');
    
    app.listen(PORT, () => {
      console.log(`签到凭证演练台已启动: http://localhost:${PORT}`);
      console.log('可用页面:');
      console.log(`  - 首页: http://localhost:${PORT}`);
      console.log(`  - 签发凭证: http://localhost:${PORT}/issue.html`);
      console.log(`  - 入场核验: http://localhost:${PORT}/verify.html`);
      console.log(`  - 异常复核: http://localhost:${PORT}/review.html`);
      console.log(`  - 导出报告: http://localhost:${PORT}/export.html`);
    });
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}

startServer();
