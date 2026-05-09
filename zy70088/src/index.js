const express = require('express');
const path = require('path');
const { initDb } = require('./database/init');
const apiRoutes = require('./routes/api');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);
app.use('/export', exportRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '政务热线工单合并服务',
    version: '1.0.0',
    endpoints: {
      'POST /api/complaints': '录入投诉',
      'POST /api/complaints/batch': '批量录入投诉',
      'POST /api/cluster': '执行投诉聚类',
      'GET /api/clusters': '查询聚类结果',
      'POST /api/merge': '合并工单',
      'GET /api/tickets': '查询工单列表',
      'GET /api/tickets/:id': '查询工单详情',
      'POST /api/tickets/:id/assign': '分派部门',
      'POST /api/tickets/:id/reply': '添加答复',
      'POST /api/tickets/:id/supervise': '超时督办',
      'POST /api/tickets/:id/close': '办结工单',
      'POST /api/tickets/:id/withdraw': '撤回工单',
      'GET /api/supervision': '查询超督办列表',
      'GET /api/statistics': '统计数据',
      'GET /api/history/:entityType/:entityId': '查询历史记录',
      'GET /export/tickets.csv': '导出工单数据',
      'GET /export/clusters.csv': '导出聚类数据'
    }
  });
});

function main() {
  console.log('=== 政务热线工单合并服务 ===');
  console.log('正在初始化数据库...');
  
  initDb();
  
  app.listen(PORT, () => {
    console.log(`服务已启动: http://localhost:${PORT}`);
    console.log('');
    console.log('快速验证功能可用:');
    console.log('1. 打开 http://localhost:' + PORT + ' 查看服务信息');
    console.log('2. 运行 npm run init-data 初始化测试数据');
    console.log('3. 运行 npm test 执行功能测试');
    console.log('');
  });
}

main();
