import express from 'express';
import trainingRoutes from './routes/training.routes';
import registrationRoutes from './routes/registration.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/trainings', trainingRoutes);
app.use('/api/registrations', registrationRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: '培训资格审核API服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`培训资格审核API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:`);
  console.log(`  POST /api/trainings - 创建培训`);
  console.log(`  GET /api/trainings - 获取所有培训`);
  console.log(`  GET /api/trainings/:id - 获取培训详情`);
  console.log(`  POST /api/registrations - 创建报名`);
  console.log(`  GET /api/registrations/:id - 获取报名详情`);
  console.log(`  GET /api/registrations/report/:trainingId - 获取培训报告`);
  console.log(`  GET /api/registrations/export/:trainingId - 导出培训报告CSV`);
});

export default app;
