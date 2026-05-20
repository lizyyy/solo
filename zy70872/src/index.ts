import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '院线运营后端服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`院线运营后端服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`=================================`);
  console.log('');
  console.log('API 接口说明:');
  console.log('');
  console.log('【批次管理】');
  console.log('  POST /api/batches           - 创建新批次');
  console.log('  GET  /api/batches           - 获取批次列表');
  console.log('  GET  /api/batches/:id       - 获取批次详情');
  console.log('');
  console.log('【数据上传】');
  console.log('  POST /api/batches/:id/showtimes   - 上传场次CSV');
  console.log('  POST /api/batches/:id/boxoffice   - 上传票房JSON');
  console.log('');
  console.log('【记录处理】');
  console.log('  POST /api/records/:id/approve     - 标记单条记录通过');
  console.log('  POST /api/records/:id/return      - 退回单条记录修改');
  console.log('  POST /api/batches/:id/approve     - 批量通过整个批次');
  console.log('');
  console.log('【查询功能】');
  console.log('  GET  /api/records                 - 查询记录（支持多条件）');
  console.log('  GET  /api/records/:id             - 获取单条记录详情');
  console.log('');
  console.log('【导出功能】');
  console.log('  GET  /api/export                  - 导出记录（CSV/JSON）');
  console.log('');
  console.log('【合同管理】');
  console.log('  POST /api/contracts               - 创建影片合同');
  console.log('  GET  /api/contracts               - 获取合同列表');
  console.log('');
  console.log('【统计信息】');
  console.log('  GET  /api/statistics/boundary     - 获取边界情况统计');
  console.log('');
  console.log('=================================');
});

export default app;
