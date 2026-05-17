import express from 'express';
import router from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   FeatureFlag 命中解释 API 服务已启动                          ║
╠══════════════════════════════════════════════════════════════╣
║   服务地址: http://localhost:${PORT}                            ║
║   健康检查: http://localhost:${PORT}/api/health                ║
║   启动时间: ${new Date().toISOString()}                        ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
