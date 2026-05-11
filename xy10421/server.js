const express = require('express');
const complaintsRouter = require('./routes/complaints');
const statisticsRouter = require('./routes/statistics');

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: '客诉赔偿额度 API',
    version: '1.0.0',
    endpoints: [
      'POST   /api/complaints              - 创建投诉',
      'GET    /api/complaints/:id          - 查询投诉详情',
      'POST   /api/complaints/:id/calculate - 试算赔偿额度',
      'POST   /api/complaints/:id/submit   - 提交赔偿方案',
      'POST   /api/complaints/:id/approve  - 主管审批',
      'POST   /api/complaints/:id/close    - 结案',
      'GET    /api/statistics              - 统计查询'
    ]
  });
});

app.use('/api/complaints', complaintsRouter);
app.use('/api/statistics', statisticsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`API 服务器运行在 http://localhost:${PORT}`);
  console.log('');
  console.log('示例数据:');
  console.log('  订单: ORD001(1000元), ORD002(500元), ORD003(2000元), ORD004(800元)');
  console.log('  客服: AGENT001(张三), AGENT002(李四), SUP001(王主管-审批权限)');
  console.log('');
  console.log('问题等级规则:');
  console.log('  P1(低级): 最高10%, 自动通过');
  console.log('  P2(中级): 最高20%, 自动通过');
  console.log('  P3(高级): 最高50%, 需主管审批');
  console.log('  累计上限: 同一订单累计不超过订单金额50%');
});
