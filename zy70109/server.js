const express = require('express');
const path = require('path');
const fs = require('fs');

const { initDb } = require('./database');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
app.use(express.json());

let contractService = null;
let extraServices = null;

app.get('/', (req, res) => {
  res.json({
    service: '土地流转合同履约 API',
    version: '1.0.0',
    endpoints: {
      contracts: {
        create: 'POST /contracts',
        list: 'GET /contracts',
        get: 'GET /contracts/:id',
        update: 'PUT /contracts/:id',
        versions: 'GET /contracts/:id/versions'
      },
      rent: {
        pay: 'POST /contracts/:id/rent/pay'
      },
      renewal: {
        create: 'POST /contracts/:id/renewals',
        list: 'GET /contracts/:id/renewals',
        approve: 'POST /renewals/:id/approve',
        reject: 'POST /renewals/:id/reject'
      },
      breaches: {
        create: 'POST /contracts/:id/breaches',
        list: 'GET /contracts/:id/breaches',
        resolve: 'POST /breaches/:id/resolve'
      },
      performance: {
        summary: 'GET /performance',
        export: 'GET /contracts/:id/performance/export'
      }
    }
  });
});

app.post('/contracts', async (req, res) => {
  try {
    const result = await contractService.createContract(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/contracts', (req, res) => {
  try {
    const contracts = contractService.listAllContracts();
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/contracts/:id', (req, res) => {
  try {
    const contract = contractService.getContractById(req.params.id);
    if (!contract) return res.status(404).json({ error: '合同不存在' });
    res.json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/contracts/:id', async (req, res) => {
  try {
    const result = await contractService.updateContract(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/contracts/:id/versions', (req, res) => {
  try {
    const versions = contractService.listContractVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/contracts/:id/rent/pay', async (req, res) => {
  try {
    const { plan_id, amount } = req.body;
    const result = await contractService.payRent(req.params.id, plan_id, amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/contracts/:id/renewals', async (req, res) => {
  try {
    const result = await extraServices.createRenewalRequest(req.params.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/contracts/:id/renewals', (req, res) => {
  try {
    const renewals = extraServices.listRenewalRequests(req.params.id);
    res.json(renewals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/renewals/:id/approve', async (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = await extraServices.approveRenewal(req.params.id, approved_by);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/renewals/:id/reject', async (req, res) => {
  try {
    const result = await extraServices.rejectRenewal(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/contracts/:id/breaches', async (req, res) => {
  try {
    const { type, description } = req.body;
    const result = await extraServices.createBreachReminder(req.params.id, type, description);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/contracts/:id/breaches', (req, res) => {
  try {
    const breaches = extraServices.listBreachReminders(req.params.id);
    res.json(breaches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/breaches/:id/resolve', async (req, res) => {
  try {
    const result = await extraServices.resolveBreachReminder(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/performance', (req, res) => {
  try {
    const summary = extraServices.listPerformanceSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/contracts/:id/performance/export', (req, res) => {
  try {
    const data = extraServices.exportPerformance(req.params.id);
    if (!data) return res.status(404).json({ error: '合同不存在' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const startServer = async () => {
  await initDb();
  contractService = require('./contractService');
  extraServices = require('./extraServices');
  
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`土地流转合同履约 API 已启动: http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
