const express = require('express');
const cors = require('cors');

const strainsRouter = require('./routes/strains');
const isolationRulesRouter = require('./routes/isolation-rules');
const cagesRouter = require('./routes/cages');
const animalsRouter = require('./routes/animals');
const allocationsRouter = require('./routes/allocations');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '高校实验动物笼位分配API系统',
    version: '1.0.0',
    endpoints: {
      strains: '/api/strains',
      isolationRules: '/api/isolation-rules',
      cages: '/api/cages',
      animals: '/api/animals',
      allocations: '/api/allocations',
      reports: '/api/reports'
    },
    status: 'running'
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/strains', strainsRouter);
app.use('/api/isolation-rules', isolationRulesRouter);
app.use('/api/cages', cagesRouter);
app.use('/api/animals', animalsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/reports', reportsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path
  });
});

app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: error.message
  });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  高校实验动物笼位分配API系统`);
  console.log(`  服务已启动: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`  可用接口:`);
  console.log(`    GET  /                     - 系统信息`);
  console.log(`    GET  /health               - 健康检查`);
  console.log(`    GET  /api/strains          - 品系列表`);
  console.log(`    POST /api/strains          - 创建品系`);
  console.log(`    GET  /api/isolation-rules  - 隔离规则列表`);
  console.log(`    POST /api/isolation-rules  - 创建隔离规则`);
  console.log(`    GET  /api/cages            - 笼位列表`);
  console.log(`    POST /api/cages            - 创建笼位`);
  console.log(`    GET  /api/animals          - 动物列表`);
  console.log(`    POST /api/animals          - 创建动物`);
  console.log(`    GET  /api/allocations      - 分配记录列表`);
  console.log(`    POST /api/allocations      - 创建分配记录`);
  console.log(`    GET  /api/reports/dashboard    - 看板数据`);
  console.log(`    GET  /api/reports/allocation-summary - 分配汇总`);
  console.log(`    GET  /api/reports/cage-utilization - 笼位利用率`);
  console.log(`    GET  /api/reports/strain-isolation-compliance - 合规检查`);
  console.log(`========================================`);
});

module.exports = app;
