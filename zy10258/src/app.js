const express = require('express');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

app.listen(PORT, () => {
  console.log(`快递驿站异常件赔付 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('API 接口列表:');
  console.log('  POST /api/packages/in-stock          - 包裹入库');
  console.log('  POST /api/packages/pickup            - 包裹取件');
  console.log('  GET  /api/packages/:waybill_no/history - 查询包裹历史记录');
  console.log('  POST /api/exceptions/report          - 异常上报');
  console.log('  POST /api/exceptions/confirm-responsibility - 责任确认');
  console.log('  POST /api/exceptions/close         - 关闭异常');
  console.log('  POST /api/exceptions/compensate      - 赔付');
  console.log('  GET  /api/exceptions              - 异常列表');
  console.log('  POST /api/reports/daily            - 日报统计');
  console.log('  GET  /api/reports/history          - 操作历史记录');
});

module.exports = app;
