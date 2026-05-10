const express = require('express');
const app = express();
app.use(express.json());

const { AllergenRecallService } = require('./service');
const { sampleData } = require('./sample-data');

const service = new AllergenRecallService();

console.log('正在初始化样例数据...');
sampleData.allergenRules.forEach(rule => service.addAllergenRule(rule));
sampleData.skuBatches.forEach(batch => service.addSkuBatch(batch));
sampleData.orders.forEach(order => service.addOrder(order));
sampleData.inventory.forEach(item => service.addInventory(item));
console.log('样例数据初始化完成。\n');

app.post('/api/recall/initiate', (req, res) => {
  const { ruleId, batchId, reason } = req.body;
  try {
    const result = service.initiateRecall(ruleId, batchId, reason);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/recall/retry', (req, res) => {
  const { recallId } = req.body;
  try {
    const result = service.retryRecall(recallId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/recall/:recallId', (req, res) => {
  const recall = service.getRecall(req.params.recallId);
  if (recall) {
    res.json(recall);
  } else {
    res.status(404).json({ error: '召回记录不存在' });
  }
});

app.get('/api/recalls', (req, res) => {
  res.json(service.getAllRecalls());
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = service.getOrder(req.params.orderId);
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ error: '订单不存在' });
  }
});

app.get('/api/inventory/:skuId/:batchId', (req, res) => {
  const inventory = service.getInventory(req.params.skuId, req.params.batchId);
  if (inventory) {
    res.json(inventory);
  } else {
    res.status(404).json({ error: '库存记录不存在' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`食品过敏源召回 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`可用接口:`);
  console.log(`  POST /api/recall/initiate - 发起召回`);
  console.log(`  POST /api/recall/retry    - 重试召回`);
  console.log(`  GET  /api/recall/:id      - 查询召回记录`);
  console.log(`  GET  /api/recalls         - 查询所有召回`);
  console.log(`  GET  /api/orders/:id      - 查询订单`);
  console.log(`  GET  /api/inventory/:sku/:batch - 查询库存\n`);
});

module.exports = { app, service };
