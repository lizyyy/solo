import express from 'express';
import cors from 'cors';
import coursesRouter from './routes/courses';
import studentsRouter from './routes/students';
import enrollmentsRouter from './routes/enrollments';
import transfersRouter from './routes/transfers';
import exportRouter from './routes/export';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '小学课后服务选课台后端服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/courses', coursesRouter);
app.use('/api/students', studentsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api', exportRouter);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '未找到该接口，请检查URL是否正确',
  });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  小学课后服务选课台后端服务已启动`);
  console.log(`  运行端口: ${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
