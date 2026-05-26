/**
 * 物业装修审批系统 - 入口文件
 */

const express = require('express');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'property-decoration-approval',
    version: '1.0.0',
    description: '物业装修验收、违规扣款和押金退还审批系统',
    endpoints: {
      health: 'GET /api/health',
      decoration: {
        upload: 'POST /api/decoration/upload',
        process: 'POST /api/decoration/process',
        list: 'GET /api/decoration',
        detail: 'GET /api/decoration/:id'
      },
      inspection: {
        upload: 'POST /api/inspection/upload',
        add: 'POST /api/inspection'
      },
      rules: {
        upload: 'POST /api/rules/upload',
        list: 'GET /api/rules',
        add: 'POST /api/rules'
      },
      approval: {
        process: 'POST /api/approval/process',
        deduction: 'POST /api/approval/deduction'
      },
      refund: {
        create: 'POST /api/refund/create',
        confirm: 'POST /api/refund/confirm/:id',
        trace: 'GET /api/refund/:id/trace',
        list: 'GET /api/refund'
      },
      stats: 'GET /api/stats',
      batch: 'GET /api/batch/:fingerprint'
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n  物业装修审批系统已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 文档: http://localhost:${PORT}/`);
  console.log(`\n  快速开始:`);
  console.log(`  1. npm run test  - 运行示例数据演示`);
  console.log(`  2. curl http://localhost:${PORT}/api/health  - 健康检查\n`);
});

module.exports = app;
