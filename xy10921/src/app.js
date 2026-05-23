const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const prescriptionController = require('./controllers/prescriptionController');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/api/prescriptions', prescriptionController.createPrescription);
app.get('/api/prescriptions', prescriptionController.searchPrescriptions);
app.get('/api/prescriptions/:id', prescriptionController.getPrescription);
app.get('/api/prescriptions/no/:no', prescriptionController.getPrescriptionByNo);
app.put('/api/prescriptions/:id/status', prescriptionController.updateStatus);
app.post('/api/prescriptions/:id/review', prescriptionController.addPharmacistReview);
app.post('/api/prescriptions/:id/return', prescriptionController.addReturnRecord);
app.post('/api/prescriptions/:id/exchange', prescriptionController.createExchangeRequest);
app.post('/api/exchanges/:exchangeId/approve', prescriptionController.approveExchange);
app.put('/api/prescriptions/:id/correction', prescriptionController.manualCorrection);
app.get('/api/reports/retention', prescriptionController.generateReport);
app.get('/api/reports/retention/export', prescriptionController.exportReport);
app.get('/api/exceptions', prescriptionController.getExceptions);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`药店处方留存API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
