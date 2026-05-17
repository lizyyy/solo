const express = require('express');
const cors = require('cors');
const service = require('./service');
const { initTestData } = require('./test-data');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

initTestData();

app.get('/api/prices', (req, res) => {
  const result = service.listPrices(req.query);
  res.json(result);
});

app.get('/api/prices/:id', (req, res) => {
  const result = service.getPriceDetail(req.params.id);
  if (!result.success) {
    res.status(404).json(result);
  } else {
    res.json(result);
  }
});

app.get('/api/prices/:id/history', (req, res) => {
  const result = service.getPriceHistory(req.params.id);
  if (!result.success) {
    res.status(404).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/prices/:id/status', (req, res) => {
  const { toStatus, reasonCode, operator, remark } = req.body;
  const result = service.transitionStatus(
    req.params.id,
    toStatus,
    reasonCode,
    operator,
    remark
  );
  if (!result.success) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

app.post('/api/prices', (req, res) => {
  const result = service.createPrice(req.body);
  res.json(result);
});

app.post('/api/prices/import', (req, res) => {
  const { records, operator } = req.body;
  const result = service.batchImport(records, operator);
  res.json(result);
});

app.get('/api/prices/export', (req, res) => {
  const result = service.exportPrices(req.query);
  res.json(result);
});

app.post('/api/cart/validate', (req, res) => {
  const { customerId, items } = req.body;
  const result = service.validateCartOrder(customerId, items);
  res.json(result);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'B2B报价系统客户专属价失效API服务运行正常' });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           B2B报价系统客户专属价失效API服务                      ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  健康检查: http://localhost:${PORT}/api/health                  ║
╠═══════════════════════════════════════════════════════════════╣
║  API接口:                                                      ║
║  GET    /api/prices              - 价格列表                     ║
║  GET    /api/prices/:id          - 价格详情                     ║
║  GET    /api/prices/:id/history  - 价格历史                     ║
║  POST   /api/prices/:id/status   - 状态流转                     ║
║  POST   /api/prices              - 创建价格                     ║
║  POST   /api/prices/import       - 批量导入                     ║
║  GET    /api/prices/export       - 导出数据                     ║
║  POST   /api/cart/validate       - 购物车校验                   ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});
