const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.initDatabase();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.resolve(__dirname, '../dist')));

app.get('/api/declarations', async (req, res) => {
  try {
    const filters = {
      customer_name: req.query.customer_name,
      port: req.query.port,
      status: req.query.status
    };
    const declarations = await db.getDeclarations(filters);
    res.json(declarations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/declarations/:id', async (req, res) => {
  try {
    const declaration = await db.getDeclarationById(req.params.id);
    if (!declaration) {
      return res.status(404).json({ error: '委托单不存在' });
    }
    
    const [documents, payment, inspection, statusLogs] = await Promise.all([
      db.getDocumentsByDeclarationId(req.params.id),
      db.getPaymentByDeclarationId(req.params.id),
      db.getInspectionByDeclarationId(req.params.id),
      db.getStatusLogsByDeclarationId(req.params.id)
    ]);
    
    res.json({
      declaration,
      documents,
      payment,
      inspection,
      statusLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/declarations', async (req, res) => {
  try {
    const { bill_of_lading, customer_name, port, next_responsible, notes } = req.body;
    
    if (!bill_of_lading || !customer_name || !port) {
      return res.status(400).json({ error: '提单号、客户名称、口岸为必填项' });
    }
    
    const result = await db.createDeclaration({
      bill_of_lading,
      customer_name,
      port,
      next_responsible,
      notes
    });
    
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/declarations/:id', async (req, res) => {
  try {
    const { customer_name, port, next_responsible, notes } = req.body;
    
    if (!customer_name || !port) {
      return res.status(400).json({ error: '客户名称、口岸为必填项' });
    }
    
    const result = await db.updateDeclaration(req.params.id, {
      customer_name,
      port,
      next_responsible,
      notes
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/declarations/:id/status', async (req, res) => {
  try {
    const { status, reason, changed_by } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: '状态为必填项' });
    }
    
    const validStatuses = ['pending', 'documents_checking', 'supplement_requested', 
                           'inspection', 'payment_pending', 'released', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    const result = await db.updateDeclarationStatus(req.params.id, status, reason, changed_by);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/declarations/:id/documents/:documentType', async (req, res) => {
  try {
    const { received, missing_reason } = req.body;
    
    const result = await db.updateDocument(req.params.id, req.params.documentType, {
      received,
      missing_reason
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/declarations/:id/payment', async (req, res) => {
  try {
    const { amount, paid, payment_method, notes } = req.body;
    
    if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
      return res.status(400).json({ error: '金额必须为非负数' });
    }
    
    const result = await db.createOrUpdatePayment(req.params.id, {
      amount,
      paid,
      payment_method,
      notes
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/declarations/:id/inspection', async (req, res) => {
  try {
    const { inspection_type, result: inspectionResult, returned, returned_reason, inspector, inspection_date, notes } = req.body;
    
    const result = await db.createOrUpdateInspection(req.params.id, {
      inspection_type,
      result: inspectionResult,
      returned,
      returned_reason,
      inspector,
      inspection_date,
      notes
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/filters', async (req, res) => {
  try {
    const [customers, ports] = await Promise.all([
      db.getDistinctCustomers(),
      db.getDistinctPorts()
    ]);
    
    res.json({ customers, ports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`口岸报关资料进度台服务已启动: http://localhost:${PORT}`);
});
