const express = require('express');
const cors = require('cors');
require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`门店试妆过敏禁忌管理系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API文档:`);
  console.log(`  GET  /api/consultants     - 获取顾问列表`);
  console.log(`  GET  /api/products        - 获取产品列表`);
  console.log(`  GET  /api/customers       - 获取客户列表`);
  console.log(`  GET  /api/sessions        - 获取试妆项目列表`);
  console.log(`  GET  /api/logs            - 获取操作日志`);
  console.log(`  POST /api/sessions        - 创建试妆项目`);
  console.log(`  POST /api/demo/success    - 演示成功路径`);
  console.log(`  POST /api/demo/blocked    - 演示拦截路径`);
  console.log(`  POST /api/demo/manual     - 演示人工修正路径`);
  console.log(`  POST /api/demo/duplicate  - 演示重复提交路径`);
});
