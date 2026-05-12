import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'express-async-errors';

import { errorHandler } from './middleware/errorHandler';
import merchantRoutes from './routes/merchant.routes';
import orderRoutes from './routes/order.routes';
import refundRoutes from './routes/refund.routes';
import penaltyRoutes from './routes/penalty.routes';
import appealRoutes from './routes/appeal.routes';
import settlementRoutes from './routes/settlement.routes';
import paymentRoutes from './routes/payment.routes';
import reportRoutes from './routes/report.routes';
import { successResponse } from './utils/response';

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString() }, '服务运行正常');
});

app.get('/api', (req, res) => {
  successResponse(res, {
    name: '商户结算扣罚 API',
    version: '1.0.0',
    description: '平台给商户结算时合并订单、退款、服务费、扣罚和申诉状态的结算平台',
    endpoints: {
      merchants: '/api/merchants',
      orders: '/api/orders',
      refunds: '/api/refunds',
      penalties: '/api/penalties',
      appeals: '/api/appeals',
      settlements: '/api/settlements',
      payments: '/api/payments',
      reports: '/api/reports',
    },
  }, 'API 信息');
});

app.use('/api/merchants', merchantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/penalties', penaltyRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);

app.use(errorHandler);

export default app;
