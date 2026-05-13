const express = require('express');
const router = express.Router();
const makeupService = require('./services/makeupService');
const exportService = require('./services/exportService');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/consultants', async (req, res) => {
  try {
    const consultants = await makeupService.getAllConsultants();
    res.json({ success: true, data: consultants });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await makeupService.getAllProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const customers = await makeupService.getAllCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await makeupService.getSessions(req.query);
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const logs = await makeupService.getOperationLogs(req.query);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const result = await makeupService.createMakeupSession(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sessions/:id/override', async (req, res) => {
  try {
    const result = await makeupService.manualOverride(req.params.id, req.body.notes, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const result = await makeupService.createOrder(req.body.sessionId, req.body.amount, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orders/:id/review', async (req, res) => {
  try {
    const result = await makeupService.reviewOrder(req.params.id, req.body.status, req.body.notes, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/customers/:id/allergy', async (req, res) => {
  try {
    const result = await makeupService.updateCustomerAllergy(req.params.id, req.body.allergies, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/sessions', async (req, res) => {
  try {
    const workbook = await exportService.exportSessions(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sessions.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/logs', async (req, res) => {
  try {
    const workbook = await exportService.exportLogs(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=logs.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/sessions', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const results = [];
    for (const row of data) {
      const result = await makeupService.createMakeupSession({
        requestId: row.requestId || uuidv4(),
        customerId: row.customerId,
        consultantId: row.consultantId,
        productId: row.productId,
        date: row.date,
        operator: 'import'
      });
      results.push({ row, result });
    }
    
    res.json({ success: true, imported: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/success', async (req, res) => {
  try {
    const result = await makeupService.createMakeupSession({
      requestId: 'demo-success-' + Date.now(),
      customerId: 'cust-001',
      consultantId: 'cons-001',
      productId: 'prod-001',
      date: new Date().toISOString().split('T')[0],
      operator: 'demo'
    });
    res.json({ success: true, demoType: 'success', result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/blocked', async (req, res) => {
  try {
    const result = await makeupService.createMakeupSession({
      requestId: 'demo-blocked-' + Date.now(),
      customerId: 'cust-002',
      consultantId: 'cons-001',
      productId: 'prod-002',
      date: new Date().toISOString().split('T')[0],
      operator: 'demo'
    });
    res.json({ success: true, demoType: 'blocked', result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/manual', async (req, res) => {
  try {
    const sessionResult = await makeupService.createMakeupSession({
      requestId: 'demo-manual-' + Date.now(),
      customerId: 'cust-002',
      consultantId: 'cons-001',
      productId: 'prod-002',
      date: new Date().toISOString().split('T')[0],
      operator: 'demo'
    });
    
    if (sessionResult.blocked) {
      const overrideResult = await makeupService.manualOverride(
        sessionResult.session.id,
        '客户签署知情同意书，人工通过',
        'demo-manager'
      );
      res.json({ success: true, demoType: 'manual', sessionResult, overrideResult });
    } else {
      res.json({ success: true, demoType: 'manual', note: '未触发拦截，直接成功', sessionResult });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/demo/duplicate', async (req, res) => {
  try {
    const requestId = 'demo-duplicate-' + Date.now();
    
    const result1 = await makeupService.createMakeupSession({
      requestId: requestId,
      customerId: 'cust-001',
      consultantId: 'cons-001',
      productId: 'prod-001',
      date: new Date().toISOString().split('T')[0],
      operator: 'demo'
    });
    
    const result2 = await makeupService.createMakeupSession({
      requestId: requestId,
      customerId: 'cust-001',
      consultantId: 'cons-001',
      productId: 'prod-001',
      date: new Date().toISOString().split('T')[0],
      operator: 'demo'
    });
    
    res.json({ success: true, demoType: 'duplicate', firstRequest: result1, secondRequest: result2 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
