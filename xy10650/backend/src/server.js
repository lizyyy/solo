const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '工地安全整改罚款管理系统运行正常' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 服务器启动成功!`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API前缀: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
  console.log(`使用说明:`);
  console.log(`  1. npm run seed    - 生成演示数据`);
  console.log(`  2. npm run dev     - 开发模式启动`);
  console.log(`  3. npm start       - 生产模式启动`);
  console.log(`\nAPI文档:`);
  console.log(`  GET  /api/hazards          - 获取隐患列表`);
  console.log(`  POST /api/hazards          - 创建隐患`);
  console.log(`  GET  /api/hazards/:id      - 获取隐患详情`);
  console.log(`  GET  /api/fines            - 获取罚款列表`);
  console.log(`  GET  /api/teams            - 获取班组列表`);
  console.log(`  GET  /api/logs             - 获取操作日志`);
  console.log(`  GET  /api/export/hazards   - 导出隐患数据`);
  console.log(`\n查看完整文档请访问 README.md\n`);
});