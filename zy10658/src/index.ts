import express from 'express';
import cors from 'cors';
import { router } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', router);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '数据看板服务指标口径变更公告 API'
  });
});

app.listen(PORT, () => {
  console.log(`
===============================================
🚀 数据看板服务指标口径变更公告 API
📅 启动时间: ${new Date().toLocaleString('zh-CN')}
🌐 服务地址: http://localhost:${PORT}
📋 API 前缀: http://localhost:${PORT}/api
===============================================

API 接口列表:
  GET  /api/announcements        - 查询公告列表（支持筛选）
  GET  /api/announcements/:id    - 查询公告详情
  GET  /api/announcements/:id/history - 查询公告历史记录
  POST /api/announcements        - 创建公告
  PUT  /api/announcements/:id    - 更新公告
  POST /api/announcements/:id/status - 更新状态
  GET  /api/export/announcements - 导出公告CSV
  GET  /api/export/fields        - 查询导出字段
  GET  /api/import/errors        - 查询导入错误记录
  GET  /api/statuses             - 查询所有状态枚举
  GET  /health                   - 健康检查

测试数据说明:
  1. 完整流转公告: DAU口径升级（草稿→待确认→已发布）
  2. 冲突记录公告: 订单转化率口径调整（待人工处理）
  3. 导入坏行记录: 第3行数据错误样例

状态枚举: 草稿、待确认、已发布、已撤回、待人工处理
  `);
});
