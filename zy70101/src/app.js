const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./db/init');

const metersRouter = require('./routes/meters');
const tenantsRouter = require('./routes/tenants');
const rulesRouter = require('./routes/rules');
const billsRouter = require('./routes/bills');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      timestamp: new Date().toISOString(),
      storage: 'SQLite (data/energy.db)',
      description: '园区能耗分摊服务运行中，重启后历史数据可查'
    }
  });
});

app.use('/api/meters', metersRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/bills', billsRouter);
app.use('/api/export', exportRouter);

app.get('/api/status-machine', (req, res) => {
  const { BILL_STATUS, STATUS_DESCRIPTIONS, describeAvailableTransitions } = require('./services/billStateMachine');
  
  const transitions = {};
  Object.keys(BILL_STATUS).forEach(key => {
    const status = BILL_STATUS[key];
    transitions[status] = {
      description: STATUS_DESCRIPTIONS[status],
      can_go_to: describeAvailableTransitions(status)
    };
  });
  
  res.json({
    success: true,
    data: {
      description: '账单状态机定义',
      states: transitions,
      retry_guide: {
        recalculation_failed: [
          '1. 调用 GET /api/bills/failed/recalculation 查看所有失败的账单',
          '2. 查看每个账单的 error_message 定位问题',
          '3. 修复数据问题（缺少读数、缺少规则等）',
          '4. 直接调用 POST /api/bills/:id/recalculate 重试',
          '5. 或调用 POST /api/bills/:id/request-recalculation 先标记为待重算'
        ]
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    detail: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║             园区能耗分摊服务启动成功                             ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  健康检查: GET /health                                          ║
║  状态机说明: GET /api/status-machine                            ║
╠═══════════════════════════════════════════════════════════════╣
║  API 列表:                                                      ║
║  POST /api/meters                    - 新增电表                 ║
║  GET  /api/meters                    - 电表列表                 ║
║  POST /api/meters/:id/readings       - 录入电表读数             ║
║  POST /api/tenants                   - 新增租户                 ║
║  POST /api/tenants/:id/area-change   - 变更租户面积             ║
║  POST /api/rules                     - 新增分摊规则             ║
║  GET  /api/rules/active              - 当前生效规则             ║
║  POST /api/bills/generate            - 生成账单                 ║
║  POST /api/bills/:id/submit          - 提交待确认               ║
║  POST /api/bills/:id/confirm         - 确认账单                 ║
║  POST /api/bills/:id/dispute         - 提出异议                 ║
║  POST /api/bills/:id/resolve-dispute - 处理异议                 ║
║  POST /api/bills/:id/recalculate     - 重算账单                 ║
║  GET  /api/bills/failed/recalculation - 重算失败列表            ║
║  GET  /api/export/bill/:id           - 导出单个账单             ║
║  GET  /api/export/period/:period     - 导出周期汇总             ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
