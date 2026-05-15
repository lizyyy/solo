import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(routes);

app.listen(PORT, () => {
  console.log(`Mock录制回放器服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('API端点:');
  console.log('  POST /api/v1/recorder/submit    - 提交单条记录');
  console.log('  POST /api/v1/recorder/batch     - 批量提交记录');
  console.log('  POST /api/v1/recorder/playback  - 回放录制');
  console.log('  GET  /api/v1/recorder/failed    - 获取所有失败记录');
  console.log('  GET  /api/v1/recorder/failed/:type - 按失败类型查询');
  console.log('  POST /api/v1/export/failed      - 导出失败记录');
  console.log('  GET  /api/v1/audit/pending      - 待确认审计记录');
  console.log('  POST /api/v1/audit/:id/confirm  - 确认审计记录');
  console.log('');
});

export default app;
