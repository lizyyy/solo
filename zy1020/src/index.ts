import express from 'express';
import { router } from './routes';

const PORT = process.env.PORT || 3000;

const app = express();

app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

app.use('/api', router);

app.get('/', (req, res) => {
  res.json({
    name: 'Webhook Replay & Idempotency Simulator',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      templates: {
        list: 'GET /api/templates',
        get: 'GET /api/templates/:id',
        create: 'POST /api/templates',
        update: 'PUT /api/templates/:id',
        delete: 'DELETE /api/templates/:id',
      },
      simulations: {
        list: 'GET /api/simulations',
        get: 'GET /api/simulations/:id',
        create: 'POST /api/simulations',
        deliveries: 'GET /api/simulations/:id/deliveries',
      },
      deliveries: {
        get: 'GET /api/deliveries/:id',
      },
      deadLetters: {
        list: 'GET /api/dead-letters',
        get: 'GET /api/dead-letters/:id',
        replay: 'POST /api/dead-letters/:id/replay',
        replayAll: 'POST /api/dead-letters/replay-all',
      },
      idempotencyLedger: {
        list: 'GET /api/idempotency-ledger',
        get: 'GET /api/idempotency-ledger/:key',
      },
      reports: {
        simulation: 'GET /api/reports/simulations/:id',
        simulationJson: 'GET /api/reports/simulations/:id/json',
        simulationMarkdown: 'GET /api/reports/simulations/:id/markdown',
        full: 'GET /api/reports/full',
        fullJson: 'GET /api/reports/full/json',
        fullMarkdown: 'GET /api/reports/full/markdown',
      },
      signature: {
        test: 'POST /api/signature/test',
        verify: 'POST /api/signature/verify',
      },
      stats: 'GET /api/stats',
    },
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Webhook 回放 & 幂等演练服务`);
  console.log(`========================================`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 前缀: http://localhost:${PORT}/api`);
  console.log(`========================================`);
  console.log(`可用策略:`);
  console.log(`  - normal        正常顺序投递`);
  console.log(`  - out_of_order  乱序投递`);
  console.log(`  - duplicate     重复投递`);
  console.log(`  - delayed       延迟投递`);
  console.log(`  - signature_error  签名错误`);
  console.log(`  - partial_failure  部分失败`);
  console.log(`========================================`);
  console.log(`快速开始:`);
  console.log(`  1. 创建模板: POST /api/templates`);
  console.log(`  2. 发起演练: POST /api/simulations`);
  console.log(`  3. 查看结果: GET /api/simulations/:id`);
  console.log(`  4. 导出报告: GET /api/reports/simulations/:id/markdown`);
  console.log(`========================================\n`);
});
