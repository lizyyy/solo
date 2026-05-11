const express = require('express');
const cors = require('cors');
const services = require('./memoryStore');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/orders', (req, res) => {
  try {
    const result = services.createOrder(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/orders', (req, res) => {
  try {
    const { status, item_type, keyword } = req.query;
    const orders = services.listOrders({ status, item_type, keyword });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = services.getOrderDetail(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/renew', (req, res) => {
  try {
    const result = services.processRenewal(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/return', (req, res) => {
  try {
    const result = services.markReturned(req.params.id);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/inspect', (req, res) => {
  try {
    const result = services.recordInspection(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/deduction', (req, res) => {
  try {
    const result = services.createDeduction(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/deductions/:id/approve', (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = services.approveDeduction(req.params.id, approved_by);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/refund', (req, res) => {
  try {
    const result = services.createRefund(req.params.id, req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/refunds/:id/approve', (req, res) => {
  try {
    const { approved_by } = req.body;
    const result = services.approveRefund(req.params.id, approved_by);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/refunds/:id/reject', (req, res) => {
  try {
    const { reject_reason, rejected_by } = req.body;
    const result = services.rejectRefund(req.params.id, reject_reason, rejected_by);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/approvals/pending', (req, res) => {
  try {
    const result = services.getPendingApprovals();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/transactions', (req, res) => {
  try {
    const result = services.getAllTransactions();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/reports/balance', (req, res) => {
  try {
    const result = services.getDepositBalanceReport();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/seed', (req, res) => {
  try {
    const result = services.seedSampleData();
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`租赁押金冻结台后端服务已启动: http://localhost:${PORT}`);
});
