const express = require('express');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    message: '滑翔伞飞行窗口 API 已启动',
    docs: '访问 GET /api 查看接口列表'
  });
});

app.listen(PORT, () => {
  console.log(`\n`);
  console.log('========================================');
  console.log('  滑翔伞飞行窗口 API 服务已启动');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  接口文档: http://localhost:${PORT}/api`);
  console.log('========================================');
  console.log('\n  使用说明:');
  console.log('  1. 访问 GET /api 查看所有接口');
  console.log('  2. 访问 GET /api/demo/success-case 查看顺利样例步骤');
  console.log('  3. 访问 GET /api/demo/failure-cases 查看拦截样例');
  console.log('\n');
});
