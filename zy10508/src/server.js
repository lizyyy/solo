const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`
========================================
  数据集签收API服务已启动
  服务地址: http://localhost:${PORT}
  API前缀: http://localhost:${PORT}/api
========================================

可用API端点:

健康检查:
GET /api/health

数据集版本:
POST /api/dataset-versions          - 创建数据集版本
POST /api/dataset-versions/:id/publish - 发布数据集版本
GET  /api/dataset-versions          - 查询数据集版本
GET  /api/dataset-versions/:id      - 获取详情
POST /api/dataset-versions/:id/manual-correct - 人工修正

下游项目:
POST /api/downstream-projects       - 创建下游项目
GET  /api/downstream-projects       - 查询下游项目
GET  /api/downstream-projects/:id   - 获取详情

签收管理:
POST /api/acknowledgments           - 创建签收任务
POST /api/acknowledgments/:id/acknowledge - 执行签收
POST /api/acknowledgments/:id/timeout - 标记超时
GET  /api/acknowledgments           - 查询签收任务
GET  /api/acknowledgments/:id       - 获取详情
POST /api/acknowledgments/:id/manual-correct - 人工修正

回退申请:
POST /api/rollback-requests         - 创建回退申请
POST /api/rollback-requests/:id/approve - 审批回退申请
GET  /api/rollback-requests         - 查询回退申请
GET  /api/rollback-requests/:id     - 获取详情

报告与导出:
POST /api/reports/acknowledgment/:datasetVersionId - 生成报告
GET  /api/reports/:id               - 获取报告
GET  /api/export/acknowledgment/:datasetVersionId - 导出数据

操作日志:
GET  /api/operation-logs/:entityType/:entityId - 查询实体操作日志
GET  /api/operation-logs/failed    - 查询所有失败操作

使用说明:
- 在请求头中设置 X-Operator 标识操作人
- 示例: curl -H "X-Operator: zhangsan" http://localhost:${PORT}/api/health
  `);
});

module.exports = app;
