const express = require('express');
const cors = require('cors');
const fs = require('fs');

const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const batchesRoute = require('./routes/batches');
const recordsRoute = require('./routes/records');
const queryRoute = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/batches', batchesRoute);
app.use('/api/records', recordsRoute);
app.use('/api/query', queryRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`4S店车辆追踪系统已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log('');
    console.log('API 接口说明:');
    console.log('  批次管理:');
    console.log('    POST /api/batches          - 创建批次');
    console.log('    GET  /api/batches          - 批次列表');
    console.log('    GET  /api/batches/:id      - 批次详情');
    console.log('    POST /api/batches/:id/process  - 标记处理');
    console.log('    POST /api/batches/:id/return   - 退回修改');
    console.log('    POST /api/batches/:id/import/borrow-return  - 导入借还CSV');
    console.log('    POST /api/batches/:id/import/vehicles       - 导入车辆JSON');
    console.log('    POST /api/batches/:id/import/violations     - 导入违章回执');
    console.log('');
    console.log('  记录处理:');
    console.log('    POST /api/records/return/:id         - 处理还车');
    console.log('    POST /api/records/violation/:id/handle  - 处理违章');
    console.log('');
    console.log('  查询导出:');
    console.log('    GET  /api/query/history              - 历史查询');
    console.log('    GET  /api/query/mileage-tracking/:vin  - 里程追溯');
    console.log('    GET  /api/query/exceptions           - 异常记录');
    console.log('    GET  /api/query/operations           - 操作日志');
    console.log('    GET  /api/query/export               - 导出CSV');
    console.log('    GET  /api/query/audit-trail/:type/:id  - 审计追踪');
  });
}

module.exports = app;