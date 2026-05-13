const express = require('express');
const cors = require('cors');
const path = require('path');

require('./database/init');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.operator = req.headers['x-operator-id'] || 'system';
  req.operatorName = req.headers['x-operator-name'] || '系统用户';
  next();
});

const CustomerAddressService = require('./services/CustomerAddressService');
const DeliveryService = require('./services/DeliveryService');
const BucketReturnService = require('./services/BucketReturnService');
const DamageSeizureService = require('./services/DamageSeizureService');
const BalanceService = require('./services/BalanceService');
const OperationLogService = require('./services/OperationLogService');
const ExportService = require('./services/ExportService');
const BucketValidationService = require('./services/BucketValidationService');

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '桶装水押桶月结系统 API 运行正常' });
});

app.post('/api/customer-addresses', async (req, res) => {
  try {
    const result = await CustomerAddressService.create(
      req.body, 
      req.operator, 
      req.operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/customer-addresses/:id', async (req, res) => {
  try {
    const result = await CustomerAddressService.update(
      parseInt(req.params.id),
      req.body,
      req.operator,
      req.operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/customer-addresses', (req, res) => {
  const result = CustomerAddressService.list(req.query);
  res.json({ success: true, ...result });
});

app.get('/api/customer-addresses/:id', (req, res) => {
  const result = CustomerAddressService.getById(parseInt(req.params.id));
  res.json({ success: true, data: result });
});

app.post('/api/deliveries', async (req, res) => {
  const result = await DeliveryService.createDelivery(
    req.body,
    req.operator,
    req.operatorName
  );
  res.json(result);
});

app.get('/api/deliveries', async (req, res) => {
  const result = await DeliveryService.listDeliveries(req.query);
  res.json({ success: true, ...result });
});

app.get('/api/deliveries/:deliveryNo', async (req, res) => {
  const result = await DeliveryService.getDelivery(req.params.deliveryNo);
  res.json({ success: true, data: result });
});

app.post('/api/bucket-returns', async (req, res) => {
  const result = await BucketReturnService.createReturn(
    req.body,
    req.operator,
    req.operatorName
  );
  res.json(result);
});

app.post('/api/bucket-returns/:returnNo/review', async (req, res) => {
  try {
    const result = await BucketReturnService.reviewReturn(
      req.params.returnNo,
      req.body.action,
      req.operator,
      req.operatorName,
      req.body.remarks
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/bucket-returns', async (req, res) => {
  const result = await BucketReturnService.listReturns(req.query);
  res.json({ success: true, ...result });
});

app.get('/api/bucket-returns/:returnNo', async (req, res) => {
  const result = await BucketReturnService.getReturn(req.params.returnNo);
  res.json({ success: true, data: result });
});

app.post('/api/damage-seizures', async (req, res) => {
  try {
    const result = await DamageSeizureService.createSeizure(
      req.body,
      req.operator,
      req.operatorName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/damage-seizures/:seizureNo', async (req, res) => {
  try {
    const result = await DamageSeizureService.updateSeizure(
      req.params.seizureNo,
      req.body.data,
      req.operator,
      req.operatorName,
      req.body.changeReason
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/damage-seizures', async (req, res) => {
  const result = await DamageSeizureService.listSeizures(req.query);
  res.json({ success: true, ...result });
});

app.get('/api/damage-seizures/:seizureNo', async (req, res) => {
  const result = await DamageSeizureService.getSeizure(req.params.seizureNo);
  res.json({ success: true, data: result });
});

app.get('/api/balances', (req, res) => {
  const result = BalanceService.getAllBalances(req.query);
  res.json({ success: true, data: result });
});

app.get('/api/balances/:customerAddressId', (req, res) => {
  const result = BalanceService.getBalance(parseInt(req.params.customerAddressId));
  res.json({ success: true, data: result });
});

app.get('/api/operation-logs', (req, res) => {
  const result = OperationLogService.getLogs(req.query);
  res.json({ success: true, ...result });
});

app.get('/api/timeline/:module/:recordId', (req, res) => {
  const result = OperationLogService.getTimeline(req.params.module, parseInt(req.params.recordId));
  res.json({ success: true, data: result });
});

app.post('/api/validate/bucket-code', (req, res) => {
  const result = BucketValidationService.validateBucketCode(req.body.bucketCode);
  res.json({ success: true, ...result });
});

app.get('/api/export/damage-seizures', (req, res) => {
  const csv = ExportService.exportDamageSeizures(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=damage-seizures.csv');
  res.send('\uFEFF' + csv);
});

app.get('/api/export/balances', (req, res) => {
  const csv = ExportService.exportBalances(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=balances.csv');
  res.send('\uFEFF' + csv);
});

app.get('/api/export/operation-logs', (req, res) => {
  const csv = ExportService.exportOperationLogs(req.query);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=operation-logs.csv');
  res.send('\uFEFF' + csv);
});

app.listen(PORT, () => {
  console.log(`桶装水押桶月结系统 API 服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
