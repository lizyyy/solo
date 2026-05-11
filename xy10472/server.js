const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const store = require('./src/store');
const budgetService = require('./src/budgetService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', (req, res) => {
  try {
    const data = budgetService.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/activities', (req, res) => {
  try {
    const activities = store.getActivities();
    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/activities', (req, res) => {
  try {
    const activity = store.createActivity(req.body);
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/activities/:id', (req, res) => {
  try {
    const activity = store.updateActivity(req.params.id, req.body);
    if (!activity) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/activities/:id', (req, res) => {
  try {
    store.deleteActivity(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/channels', (req, res) => {
  try {
    const channels = store.getChannels();
    res.json({ success: true, data: channels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/spends', (req, res) => {
  try {
    const spends = store.getSpendRecords();
    res.json({ success: true, data: spends });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/spends/import', (req, res) => {
  try {
    const result = budgetService.importSpend(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/adjustments', (req, res) => {
  try {
    const requests = store.getAdjustmentRequests();
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/adjustments', (req, res) => {
  try {
    const { activityId, adjustmentType, requestedAmount, reason } = req.body;
    const result = budgetService.requestAdjustment(activityId, adjustmentType, requestedAmount, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/adjustments/:id/approve', (req, res) => {
  try {
    const result = budgetService.approveAdjustment(req.params.id, true);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/adjustments/:id/reject', (req, res) => {
  try {
    const result = budgetService.approveAdjustment(req.params.id, false);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/refunds', (req, res) => {
  try {
    const refunds = store.getRefunds();
    res.json({ success: true, data: refunds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/refunds', (req, res) => {
  try {
    const result = budgetService.processRefund(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/approval-history', (req, res) => {
  try {
    const history = store.getApprovalHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/export/reconciliation', (req, res) => {
  try {
    const data = budgetService.exportSpendReconciliation();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    store.resetData();
    res.json({ success: true, message: '数据已重置' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`  广告预算封顶台已启动`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});
