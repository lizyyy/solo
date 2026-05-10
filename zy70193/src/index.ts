import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import prisma from './prisma';
import projectsRouter from './routes/projects';
import questionsRouter from './routes/questions';
import clarificationsRouter from './routes/clarifications';
import addendumsRouter from './routes/addendums';
import archivesRouter from './routes/archives';
import adminRouter from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: '招标澄清问答 API 系统',
    version: '1.0.0',
    description: '统一留痕管理供应商提问、澄清发布和补遗文件',
    endpoints: {
      projects: '/api/projects',
      questions: '/api/questions',
      clarifications: '/api/clarifications',
      addendums: '/api/addendums',
      archives: '/api/archives',
      admin: '/api/admin',
    },
    documentation: {
      quickStart: [
        '1. POST /api/projects - 创建项目',
        '2. POST /api/projects/:id/sections - 创建标段',
        '3. POST /api/questions/suppliers - 创建供应商',
        '4. POST /api/questions - 供应商提交问题',
        '5. POST /api/questions/:id/answer - 答复问题',
        '6. POST /api/clarifications - 创建澄清版本',
        '7. POST /api/clarifications/:id/items - 添加问题到澄清',
        '8. POST /api/clarifications/:id/publish - 发布澄清',
        '9. POST /api/addendums - 上传补遗文件',
        '10. POST /api/addendums/:id/confirm - 供应商确认补遗',
        '11. POST /api/archives - 生成归档报告',
      ],
      traceability: [
        'GET /api/questions/:id - 查看问题及关联的澄清版本',
        'GET /api/clarifications/:id - 查看澄清及包含的所有问题明细',
        'GET /api/addendums/:id - 查看补遗及供应商确认情况',
        'GET /api/archives/:id/export - 导出完整归档报告（含所有明细）',
        'GET /api/admin/audit?projectId=xxx - 查看项目完整审计轨迹',
      ],
      backgroundJobs: [
        'GET /api/admin/jobs/pending - 查看待处理/失败任务',
        'POST /api/admin/jobs/:id/retry - 重置失败任务',
        'POST /api/admin/jobs/:id/execute - 手动执行任务',
        'POST /api/admin/jobs/execute-all - 执行所有待处理任务',
      ],
    },
  });
});

app.use('/api/projects', projectsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/clarifications', clarificationsRouter);
app.use('/api/addendums', addendumsRouter);
app.use('/api/archives', archivesRouter);
app.use('/api/admin', adminRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: '接口不存在',
    message: '请访问 / 查看可用接口列表',
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message,
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    app.listen(PORT, () => {
      console.log(`\n🚀 招标澄清问答 API 系统已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`\n📚 快速开始:`);
      console.log(`   GET  http://localhost:${PORT}              - 查看接口文档`);
      console.log(`   GET  http://localhost:${PORT}/health       - 健康检查`);
      console.log(`   POST http://localhost:${PORT}/api/projects - 创建项目`);
      console.log(`\n📖 访问根路径 / 查看完整的接口说明和使用指南`);
    });
  } catch (error) {
    console.error('❌ 启动失败:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  console.log('🔄 正在关闭服务...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🔄 正在关闭服务...');
  await prisma.$disconnect();
  process.exit(0);
});
