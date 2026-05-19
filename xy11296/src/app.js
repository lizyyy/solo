const express = require('express');
const cors = require('cors');
const path = require('path');

const cleaningRoutes = require('./routes/cleaning');
const rulesRoutes = require('./routes/rules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({
    name: '民宿保洁管理系统',
    version: '1.0.0',
    description: '缺图拦截、超时扣分、返工结算管理系统',
    endpoints: {
      cleaning: '/api/cleaning',
      rules: '/api/rules',
      docs: '/api/docs'
    }
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    '保洁记录管理': {
      'POST /api/cleaning': '创建保洁记录',
      'GET /api/cleaning': '查询保洁记录（支持筛选）',
      'GET /api/cleaning/:id': '获取单条记录详情',
      'PUT /api/cleaning/:id': '更新保洁记录',
      'POST /api/cleaning/:id/audit': '审核记录',
      'POST /api/cleaning/:id/rework': '创建返工记录',
      'GET /api/cleaning/:id/audit-logs': '获取记录审计日志'
    },
    '数据导出': {
      'GET /api/cleaning/export/csv': '导出CSV文件',
      'GET /api/cleaning/export/data': '获取导出数据'
    },
    '规则管理': {
      'GET /api/rules': '获取所有规则',
      'PUT /api/rules/:id': '更新规则配置'
    },
    '筛选参数': {
      cleaner_name: '按保洁员姓名筛选',
      status: '按状态筛选 (passed/blocked/pending/audited)',
      exception_type: '按异常类型筛选 (missing_photos/timeout/rework)',
      start_date: '开始日期',
      end_date: '结束日期',
      room_number: '按房间号筛选'
    }
  });
});

app.use('/api/cleaning', cleaningRoutes);
app.use('/api/rules', rulesRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║      民宿保洁管理系统启动成功！                            ║
║                                                          ║
║      服务地址: http://localhost:${PORT}                      ║
║      API文档:  http://localhost:${PORT}/api/docs              ║
║                                                          ║
║      首次运行请执行: npm run init-db                     ║
║      导入样例数据请执行: node scripts/seed-data.js        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});
