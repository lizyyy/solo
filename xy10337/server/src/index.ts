import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { initDatabase, insertSampleData } from './database';
import * as services from './services';

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function startServer() {
  await initDatabase();
  insertSampleData();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/nannies', (req, res) => {
    try {
      const nannies = services.getAllNannies();
      res.json(nannies);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/nannies', (req, res) => {
    try {
      const nanny = services.createNanny(req.body);
      res.json(nanny);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/nannies/available', (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: '请提供开始日期和结束日期' });
      }
      const nannies = services.getAvailableNannies(startDate as string, endDate as string);
      res.json(nannies);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/customers', (req, res) => {
    try {
      const customers = services.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/customers', (req, res) => {
    try {
      const customer = services.createCustomer(req.body);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/orders', (req, res) => {
    try {
      const orders = services.getAllOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/orders/:id', (req, res) => {
    try {
      const detail = services.getOrderDetail(parseInt(req.params.id));
      if (!detail) {
        return res.status(404).json({ error: '订单不存在' });
      }
      res.json(detail);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/orders', (req, res) => {
    try {
      const order = services.createOrder(req.body);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    try {
      const order = services.updateOrderStatus(parseInt(req.params.id), req.body.status);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/leaves', (req, res) => {
    try {
      const leave = services.createLeave(req.body);
      res.json(leave);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/leaves/:id/approve', (req, res) => {
    try {
      const leave = services.approveLeave(parseInt(req.params.id));
      res.json(leave);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/replacements', (req, res) => {
    try {
      const replacement = services.createReplacement(req.body);
      res.json(replacement);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/evaluations', (req, res) => {
    try {
      const evaluation = services.createEvaluation(req.body);
      res.json(evaluation);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/orders/:id/settlement', (req, res) => {
    try {
      const settlement = services.calculateSettlement(parseInt(req.params.id));
      res.json(settlement);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/orders/:id/settlement/export', (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const settlement = services.calculateSettlement(orderId);
      const detail = services.getOrderDetail(orderId);

      const data = [
        ['月嫂服务结算单'],
        [''],
        ['订单编号', settlement.orderNo],
        ['客户姓名', settlement.customerName],
        ['月嫂姓名', settlement.nannyName],
        ['服务开始日期', settlement.startDate],
        ['服务结束日期', settlement.endDate],
        [''],
        ['【服务天数明细】'],
        ['总服务天数', settlement.totalDays, '天'],
        ['换人服务天数', settlement.replacementDays, '天'],
        [''],
        ['【费用明细】'],
        ['基础服务天数', settlement.details.baseDays, '天'],
        ['基础服务费用', settlement.details.baseAmount, '元'],
        ['换人服务费用', settlement.details.replacementAmount, '元'],
        ['总金额', settlement.totalAmount, '元'],
        [''],
        ['【结算明细】'],
        ['已收定金', settlement.deposit, '元'],
        ['差评扣款', settlement.deductionAmount, '元'],
        ['待收尾款', settlement.finalAmount, '元'],
        [''],
        ['【备注】'],
        ['换人记录：', detail?.replacements.length || 0, '次'],
        ['评价星级：', detail?.evaluation?.rating || '-', '星'],
        ['扣款原因：', detail?.evaluation?.deductionReason || '无'],
        ['评价内容：', detail?.evaluation?.comment || '无'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '结算单');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=settlement_${settlement.orderNo}.xlsx`);
      res.send(buffer);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/calendar', (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const data = services.getCalendarData(year, month);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
