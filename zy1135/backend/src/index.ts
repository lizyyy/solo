import express from 'express';
import cors from 'cors';
import gameRoutes from './routes/gameRoutes';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.use('/api', gameRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '鲁滨逊漂流记游戏服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  鲁滨逊漂流记生存游戏`);
  console.log(`  后端服务已启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`========================================\n`);
  console.log(`API 端点:`);
  console.log(`  POST   /api/games                - 创建新游戏`);
  console.log(`  GET    /api/games/:id            - 获取游戏状态`);
  console.log(`  POST   /api/games/:id/action     - 执行行动`);
  console.log(`  POST   /api/games/:id/end-turn   - 结束当天`);
  console.log(`  POST   /api/games/:id/event-choice - 处理事件选择`);
  console.log(`  GET    /api/games/:id/export/:format - 导出日志 (markdown/html/json)`);
  console.log(`\n`);
});

export default app;
