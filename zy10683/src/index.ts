import express from 'express';
import { config, validateConfig } from './config';
import attachmentRoutes from './routes/attachmentRoutes';

const app = express();
const PORT = config.port;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/attachments', attachmentRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '电子合同服务附件缺失补传 API 运行正常',
    timestamp: new Date().toISOString(),
    storage: config.storageType,
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用电子合同服务附件缺失补传 API',
    version: '1.0.0',
    endpoints: {
      'GET /api/attachments/list': '获取附件列表（支持筛选）',
      'GET /api/attachments/detail/:id': '获取附件详情',
      'GET /api/attachments/history/:attachmentItemId': '获取历史记录',
      'POST /api/attachments/upload': '上传附件',
      'POST /api/attachments/validate': '校验附件',
      'POST /api/attachments/archive': '手动归档',
      'GET /api/attachments/export': '导出附件数据',
      'GET /api/attachments/stats': '获取状态统计',
    },
    filters: {
      startDate: '开始日期 (YYYY-MM-DD)',
      endDate: '结束日期 (YYYY-MM-DD)',
      status: '状态 (pending_upload|uploaded|validation_failed|archived)',
      responsiblePerson: '负责人',
      businessObject: '业务对象',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 服务器启动成功！`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API 文档: http://localhost:${PORT}/\n`);

  const configWarnings = validateConfig();
  if (configWarnings.length > 0) {
    console.log('⚠️  配置提示:');
    configWarnings.forEach((warning) => console.log(`  - ${warning}`));
    console.log('');
  }
});
