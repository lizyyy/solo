import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { loadData } from './storage';
import {
  createOrder,
  updateOrderInfo,
  callOrder,
  callNextOrder,
  topupOrder,
  refundOrder,
  completeOrder,
  getAllOrders,
  getOrder,
  getActiveOrdersList,
  getQueueOrdersList
} from './service';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

loadData();

app.get('/api/orders', (req, res) => {
  try {
    const orders = getAllOrders();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取订单列表失败' });
  }
});

app.get('/api/orders/active', (req, res) => {
  try {
    const orders = getActiveOrdersList();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取活跃订单失败' });
  }
});

app.get('/api/orders/queue', (req, res) => {
  try {
    const orders = getQueueOrdersList();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取队列订单失败' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取订单失败' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const order = createOrder(req.body);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '创建订单失败' 
    });
  }
});

app.put('/api/orders/:id', (req, res) => {
  try {
    const order = updateOrderInfo(req.params.id, req.body);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新订单失败' 
    });
  }
});

app.post('/api/orders/:id/call', (req, res) => {
  try {
    const order = callOrder(req.params.id);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '叫号失败' 
    });
  }
});

app.post('/api/orders/call-next', (req, res) => {
  try {
    const order = callNextOrder();
    if (!order) {
      return res.json({ success: true, data: null, message: '当前没有待叫号的订单' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '叫号失败' 
    });
  }
});

app.post('/api/orders/:id/topup', (req, res) => {
  try {
    const { amount } = req.body;
    const order = topupOrder(req.params.id, amount);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '补差失败' 
    });
  }
});

app.post('/api/orders/:id/refund', (req, res) => {
  try {
    const order = refundOrder(req.params.id);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '退款失败' 
    });
  }
});

app.post('/api/orders/:id/complete', (req, res) => {
  try {
    const order = completeOrder(req.params.id);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error instanceof Error ? error.message : '完成订单失败' 
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`校园打印店预付队列台已启动: http://localhost:${PORT}`);
});
