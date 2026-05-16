import express from 'express';
import cors from 'cors';
import secretsRoutes from './routes/secrets';
import replacementsRoutes from './routes/replacements';
import errorsRoutes from './routes/errors';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 17735;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'secret-lineage-api' });
});

app.use('/api/secrets', secretsRoutes);
app.use('/api/replacements', replacementsRoutes);
app.use('/api/errors', errorsRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '资源不存在',
      details: {
        path: req.path,
        method: req.method,
      },
    },
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     Secret 引用血缘 API 服务已启动                         ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:17735                          ║
║  健康检查: http://localhost:17735/health                     ║
║  API 文档: 请查看 README.md                                 ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
