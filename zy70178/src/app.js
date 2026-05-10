const express = require('express');
const taxRulesRouter = require('./routes/taxRules');
const contractsRouter = require('./routes/contracts');
const approvalsRouter = require('./routes/approvals');
const exportsRouter = require('./routes/exports');
const TaxRuleService = require('./services/TaxRuleService');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: '合同价税分离 API 服务',
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '合同价税分离 API 服务',
    version: '1.0.0',
    description: '可反复验收的合同价税分离服务 - 解决合同金额修改后税率、含税价和不含税价重算错误问题',
    endpoints: {
      health: 'GET /health',
      taxRules: {
        list: 'GET /api/tax-rules',
        create: 'POST /api/tax-rules',
        active: 'GET /api/tax-rules/active',
        applicable: 'GET /api/tax-rules/applicable?industry=xxx',
        get: 'GET /api/tax-rules/:id',
        update: 'PUT /api/tax-rules/:id',
        initDefaults: 'POST /api/tax-rules/init/defaults'
      },
      contracts: {
        create: 'POST /api/contracts',
        getById: 'GET /api/contracts/:id',
        getByNo: 'GET /api/contracts/no/:contractNo',
        versions: 'GET /api/contracts/:contractId/versions',
        updateAmount: 'POST /api/contracts/:contractId/amount',
        updateTaxRate: 'POST /api/contracts/:contractId/tax-rate',
        report: 'GET /api/contracts/:contractId/report',
        recalculate: {
          taxRule: 'POST /api/contracts/:contractId/recalculate/tax-rule',
          amount: 'POST /api/contracts/:contractId/recalculate/amount',
          preview: 'POST /api/contracts/:contractId/recalculate/preview'
        },
        verify: 'GET /api/contracts/:contractId/verify'
      },
      approvals: {
        create: 'POST /api/approvals',
        pending: 'GET /api/approvals/pending',
        get: 'GET /api/approvals/:id',
        approve: 'POST /api/approvals/:id/approve',
        reject: 'POST /api/approvals/:id/reject',
        byContract: 'GET /api/approvals/contract/:contractId'
      },
      exports: {
        finance: 'GET /api/exports/contracts/:contractId/finance?format=json|text',
        history: 'GET /api/exports/contracts/:contractId/history?format=json|text',
        taxSummary: 'GET /api/exports/tax-summary?startDate=&endDate=&format=json|text'
      }
    },
    businessFeatures: [
      '合同版本管理 - 每次变更生成新版本，可追溯',
      '税率规则管理 - 后台规则可配置、可复查',
      '价税自动拆分 - 关键公式可验证、可测试',
      '变更审批流程 - 变更需审批后才能生效',
      '历史重算功能 - 支持税率调整后批量重算',
      '财务导出 - 支持 JSON 和文本格式，数字可核对'
    ]
  });
});

app.use('/api/tax-rules', taxRulesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/approvals', approvalsRouter);
app.use('/api/exports', exportsRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

TaxRuleService.initializeDefaultRules();

module.exports = app;
