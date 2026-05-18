import express from 'express';
import bodyParser from 'body-parser';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '月子餐配送组月子餐忌口替换API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           月子餐配送组月子餐忌口替换API服务启动成功             ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  健康检查: http://localhost:${PORT}/health                       ║
║  API文档: 请参考 README.md 查看完整的验收流程和调用示例          ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
