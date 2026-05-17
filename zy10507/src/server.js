const express = require('express');
const { initDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`工单升级时限 API 服务运行在 http://localhost:${PORT}`);
      console.log('');
      console.log('API 端点概览:');
      console.log('  POST   /api/tickets              - 创建工单');
      console.log('  GET    /api/tickets              - 工单列表');
      console.log('  GET    /api/tickets/:number      - 工单详情');
      console.log('  POST   /api/tickets/:number/advance  - 推进节点');
      console.log('  POST   /api/tickets/:number/escalate - 升级工单');
      console.log('  POST   /api/tickets/:number/remind   - 催办提醒');
      console.log('  POST   /api/tickets/:number/exception - 异常处理');
      console.log('  POST   /api/tickets/:number/correct  - 人工修正');
      console.log('  POST   /api/tickets/:number/resolve  - 结单');
      console.log('  POST   /api/sla/check            - 批量SLA检查');
      console.log('  GET    /api/export/tickets       - 导出工单');
      console.log('  GET    /api/export/escalations   - 导出升级记录');
      console.log('  GET    /api/export/tickets/:number - 导出单工单');
      console.log('  GET    /api/config               - 配置信息');
      console.log('  GET    /health                   - 健康检查');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
