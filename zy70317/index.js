const express = require('express');
const { initializeTables } = require('./database');
const services = require('./services');
const models = require('./models');

const app = express();
const PORT = 3001;

app.use(express.json());

app.post('/api/orders', async (req, res) => {
  try {
    const { order_no, amount } = req.body;
    if (!order_no || amount == null) {
      return res.status(400).json({ error: 'order_no 和 amount 必填' });
    }
    const order = await services.createBusinessOrder(order_no, amount);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:order_no/pay', async (req, res) => {
  try {
    const order = await services.simulatePaymentComplete(req.params.order_no);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:order_no/cancel', async (req, res) => {
  try {
    await models.cancelOrder(req.params.order_no);
    const order = await models.getOrder(req.params.order_no);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/accounting-flows', async (req, res) => {
  try {
    const { order_no, amount, flow_no } = req.body;
    if (!order_no || amount == null) {
      return res.status(400).json({ error: 'order_no 和 amount 必填' });
    }
    const flow = await services.writeAccountingFlow(order_no, amount, flow_no);
    res.status(201).json({ success: true, data: flow });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/orders/:order_no', async (req, res) => {
  try {
    const order = await models.getOrder(req.params.order_no);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    const flows = await models.getFlowsByOrderNo(req.params.order_no);
    res.json({ success: true, data: { order, flows } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/reconciliation/scan', async (req, res) => {
  try {
    const result = await services.runReconciliationScan();
    res.json({
      success: true,
      data: {
        scan: result.scan,
        diff_count: result.diffs.length,
        diffs: result.diffs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reconciliation/diffs', async (req, res) => {
  try {
    const { status, order_no } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (order_no) filters.order_no = order_no;
    
    const diffs = await models.getDiffs(filters);
    res.json({ success: true, data: diffs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reconciliation/diffs/:diff_id', async (req, res) => {
  try {
    const detail = await services.getDiffDetail(req.params.diff_id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '对账差异不存在' });
    }
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/reconciliation/diffs/:diff_id/close', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: '关闭原因必填' });
    }
    const diff = await services.closeDiff(req.params.diff_id, reason);
    res.json({ success: true, data: diff });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/reconciliation/diffs/:diff_id/compensation-history', async (req, res) => {
  try {
    const history = await models.getCompensationHistory(req.params.diff_id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/compensation/tasks/:task_id/execute', async (req, res) => {
  try {
    const result = await services.executeCompensation(req.params.task_id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/compensation/tasks/:task_id/retry', async (req, res) => {
  try {
    const result = await services.retryCompensation(req.params.task_id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/compensation/tasks', async (req, res) => {
  try {
    const { diff_id } = req.query;
    const { db } = require('./database');
    
    let tasks;
    if (diff_id) {
      tasks = await models.getTasksByDiffId(diff_id);
    } else {
      tasks = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM compensation_tasks ORDER BY created_at DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/financial/summary', async (req, res) => {
  try {
    const summary = await services.getFinancialSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

(async () => {
  try {
    await initializeTables();
    app.listen(PORT, () => {
      console.log(`账务流水补偿系统服务运行在 http://localhost:${PORT}`);
      console.log('API 端点:');
      console.log('  POST /api/orders                  - 创建业务订单');
      console.log('  POST /api/orders/:order_no/pay    - 模拟支付完成');
      console.log('  POST /api/orders/:order_no/cancel - 取消订单');
      console.log('  POST /api/accounting-flows        - 写账务流水');
      console.log('  GET  /api/orders/:order_no        - 查询订单及流水');
      console.log('  POST /api/reconciliation/scan     - 执行对账扫描');
      console.log('  GET  /api/reconciliation/diffs    - 查询对账差异列表');
      console.log('  GET  /api/reconciliation/diffs/:diff_id - 查询差异详情');
      console.log('  POST /api/reconciliation/diffs/:diff_id/close - 关闭差异');
      console.log('  POST /api/compensation/tasks/:task_id/execute - 执行补偿');
      console.log('  POST /api/compensation/tasks/:task_id/retry   - 重试补偿');
      console.log('  GET  /api/compensation/tasks      - 查询补偿任务');
      console.log('  GET  /api/financial/summary       - 财务对账汇总');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
})();
