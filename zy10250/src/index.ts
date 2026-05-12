import express from 'express';
import {
  processOfflineSync,
  cancelOrder,
  getBatchList,
  getBatchDetail,
  getInventoryList,
  getExceptionList,
  getOrderDetail
} from './service';
import { ApiResponse } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.post('/api/offline/sync', async (req, res) => {
  try {
    const result = await processOfflineSync(req.body);
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '同步处理完成',
      data: result
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.post('/api/order/:orderNo/cancel', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { reason } = req.body;
    const result = await cancelOrder(orderNo, reason || '手动撤销');
    const response: ApiResponse = {
      success: result.success,
      code: result.success ? 'SUCCESS' : 'FAILED',
      message: result.message
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.get('/api/batch', async (req, res) => {
  try {
    const batches = await getBatchList();
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: batches
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.get('/api/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await getBatchDetail(batchId);
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: result
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await getInventoryList();
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: inventory
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.get('/api/exception', async (req, res) => {
  try {
    const { batchId } = req.query;
    const exceptions = await getExceptionList(batchId as string | undefined);
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: exceptions
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.get('/api/order/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const order = await getOrderDetail(orderNo);
    const response: ApiResponse = {
      success: true,
      code: 'SUCCESS',
      message: '查询成功',
      data: order
    };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      code: 'SYSTEM_ERROR',
      message: error.message
    };
    res.status(500).json(response);
  }
});

app.listen(PORT, () => {
  console.log(`零售收银离线补单API服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API接口列表:');
  console.log('  POST /api/offline/sync    - 离线数据同步');
  console.log('  POST /api/order/:orderNo/cancel - 撤销订单');
  console.log('  GET  /api/batch           - 查询同步批次列表');
  console.log('  GET  /api/batch/:batchId  - 查询批次详情');
  console.log('  GET  /api/inventory       - 查询库存');
  console.log('  GET  /api/exception       - 查询异常单');
  console.log('  GET  /api/order/:orderNo  - 查询订单详情');
  console.log('');
});

export default app;
