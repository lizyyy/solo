import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

initDatabase();

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: 'Livehouse 酒水分成系统',
    version: '1.0.0',
    endpoints: {
      'GET /api/health': '健康检查',
      'GET /api/batches': '获取批次列表',
      'POST /api/batches': '创建新批次',
      'GET /api/batches/:id': '获取批次详情（统一结果）',
      'POST /api/batches/:id/import/sound-engineer': '导入调音师留言',
      'POST /api/batches/:id/import/rehearsal-group': '导入排练群接龙',
      'GET /api/batches/:id/conflicts': '获取冲突证据列表',
      'POST /api/conflicts/:id/resolve': '解决冲突（许老师确认/驳回）',
      'POST /api/batches/:id/calculate': '计算分成',
      'GET /api/batches/:id/revenue': '获取最新分成结果',
      'GET /api/batches/:id/revenue/history': '获取分成计算历史',
      'GET /api/batches/:id/self-check': '运行自检',
      'GET /api/batches/:id/export': '导出批次数据'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Livehouse 酒水分成系统已启动，端口: ${PORT}`);
  console.log(`访问 http://localhost:${PORT} 查看API文档`);
});

export default app;
