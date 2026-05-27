import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '市政运维数据整合API',
    version: '1.0.0',
    description: '统一处理路灯告警、人工巡查和维修反馈数据',
    endpoints: {
      health: 'GET /api/health - 健康检查',
      rules: 'GET /api/rules - 获取所有业务规则',
      batches: 'GET /api/batches - 获取所有批次记录',
      batch: 'GET /api/batches/:batchId - 获取单个批次信息',
      upload: 'POST /api/upload/:sourceType - 上传文件处理 (alarm|inspection|maintenance)',
      process: 'POST /api/process/:sourceType - 直接处理JSON数据',
      explain: 'POST /api/explain - 单条记录处理说明'
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║    市政运维数据整合 API 服务已启动                          ║
║                                                            ║
║    服务地址: http://localhost:${PORT}                         ║
║                                                            ║
║    接口说明:                                                ║
║      GET  /api/health          - 健康检查                   ║
║      GET  /api/rules           - 查看业务规则               ║
║      POST /api/upload/:type    - 上传文件处理               ║
║      POST /api/process/:type   - 处理JSON数据               ║
║      POST /api/explain         - 单条记录说明               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
