const express = require('express');
const cors = require('cors');
const path = require('path');

const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataStore = require('./dataStore');
const inspectionRoutes = require('./routes/inspections');
const riskRoutes = require('./routes/risk');
const mergeRoutes = require('./routes/merge');
const historyRoutes = require('./routes/history');
const demoRoutes = require('./routes/demo');

app.use('/api/inspections', inspectionRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/merge', mergeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/demo', demoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/status', (req, res) => {
  res.json({
    currentStep: dataStore.getCurrentStep(),
    totalInspections: dataStore.getAllInspections().length,
    pendingMerges: dataStore.getPendingMerges().length,
    highRiskCount: dataStore.getHighRiskCount(),
    history: dataStore.getStatusHistory()
  });
});

dataStore.initDemoData();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
