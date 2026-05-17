import express from 'express';
import bodyParser from 'body-parser';
import { config } from './config';
import grayReleaseRoutes from './routes/grayRelease';

const app = express();
const PORT = config.port;

const configErrors = config.getMissingConfigMessage();
if (configErrors) {
  console.error('\n⚠️  配置错误警告:');
  console.error(configErrors);
  console.error('\n请设置正确的环境变量后重新启动。\n');
}

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use('/api/gray-release', grayReleaseRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: config.env === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log('\n🚀 企业微信机器人消息模板灰度发布 API 已启动');
  console.log(`📍 服务地址: http://${config.host}:${PORT}`);
  console.log(`📊 健康检查: http://${config.host}:${PORT}/health`);
  console.log(`🌍 环境: ${config.env}`);
  console.log('\n📖 API 端点:');
  console.log('  GET    /api/gray-release              - 获取记录列表');
  console.log('  GET    /api/gray-release/:id          - 获取记录详情');
  console.log('  GET    /api/gray-release/:id/history  - 获取历史记录');
  console.log('  POST   /api/gray-release              - 创建记录');
  console.log('  PUT    /api/gray-release/:id          - 更新记录');
  console.log('  POST   /api/gray-release/:id/start-gray  - 开始灰度');
  console.log('  POST   /api/gray-release/:id/full-release - 全量发布');
  console.log('  POST   /api/gray-release/:id/rollback - 回退发布');
  console.log('  POST   /api/gray-release/batch-import - 批量导入');
  console.log('  GET    /api/gray-release/export/csv   - 导出CSV');
  console.log('  GET    /api/gray-release/export/json  - 导出JSON');
  console.log('  POST   /api/gray-release/check-conflicts - 检查冲突');
  console.log('\n');
});
