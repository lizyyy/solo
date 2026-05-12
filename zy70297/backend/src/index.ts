import express from 'express';
import cors from 'cors';
import routes from './routes';
import './seed';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    name: '商户燃气安检整改台 API',
    version: '1.0.0',
    endpoints: {
      merchants: 'GET /api/merchants',
      merchantDetail: 'GET /api/merchants/:id',
      inspections: 'GET /api/inspections',
      createInspection: 'POST /api/inspections',
      tasks: 'GET /api/rectification-tasks',
      taskDetail: 'GET /api/rectification-tasks/:id',
      scheduleReview: 'POST /api/rectification-tasks/:id/schedule-review',
      completeReview: 'POST /api/rectification-tasks/:id/complete-review',
      cutOffGas: 'POST /api/rectification-tasks/:id/cut-off-gas',
      restoreGas: 'POST /api/rectification-tasks/:id/restore-gas',
      reports: 'GET /api/reports',
      health: 'GET /api/health',
    },
    businessRules: {
      rectificationPeriods: {
        hose: '3天（软管问题，危急）',
        alarm: '5天（报警器问题，重要）',
        valve: '7天（阀门问题，一般）',
      },
      gasCutOffRule: '连续2次复查不通过自动停气',
    },
  });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`商户燃气安检整改台 - 后端服务`);
  console.log(`========================================`);
  console.log(`运行端口: ${PORT}`);
  console.log(`API地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`报表: http://localhost:${PORT}/api/reports`);
  console.log(`========================================`);
});
