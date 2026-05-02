const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const ordersRouter = require('./routes/orders');
const techniciansRouter = require('./routes/technicians');
const csvRouter = require('./routes/csv');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '手机维修店工单系统 API 运行正常' });
});

app.use('/api/orders', ordersRouter);
app.use('/api/technicians', techniciansRouter);
app.use('/api/csv', csvRouter);

app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 文档：
    GET  /api/health                - 健康检查
    GET  /api/orders                - 获取工单列表（支持 date, technician_id, status 筛选）
    GET  /api/orders/:id            - 获取工单详情
    POST /api/orders                - 创建工单
    PUT  /api/orders/:id            - 更新工单
    PUT  /api/orders/:id/status     - 更新工单状态
    POST /api/orders/:id/notes      - 添加备注
    GET  /api/technicians           - 获取维修师傅列表
    POST /api/technicians           - 创建维修师傅
    PUT  /api/technicians/:id       - 更新维修师傅
    DELETE /api/technicians/:id     - 删除维修师傅
    GET  /api/csv/export/today      - 导出当日工单 CSV
    POST /api/csv/import            - 导入工单 CSV
  `);
});
