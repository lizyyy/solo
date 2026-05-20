import express from 'express';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       4S店试驾车对账服务已启动                                 ║
║                                                               ║
║       服务地址: http://localhost:${PORT}                      ║
║       API文档:  http://localhost:${PORT}/api/health           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
