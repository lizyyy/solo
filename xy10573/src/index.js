const express = require('express');
const fs = require('fs');
const path = require('path');
const { initDB } = require('./db');
const services = require('./services');
const rules = require('./rules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
initDB();

function withIdempotency(req, res, endpoint, handler) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (idempotencyKey) {
    const existing = rules.checkIdempotency(idempotencyKey, endpoint);
    if (existing.exists) {
      return res.json({ ...existing.response, _idempotent: true, _cached: true });
    }
  }

  const result = handler();
  
  if (idempotencyKey && result) {
    rules.saveIdempotency(idempotencyKey, endpoint, req.body, result);
  }
  
  return res.json(result);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pet-boarding-api', version: '1.0.0', time: new Date().toISOString() });
});

app.get('/api/rooms', (req, res) => {
  res.json(services.getRooms());
});

app.get('/api/rooms/:roomId/availability', (req, res) => {
  const { start, end } = req.query;
  res.json(services.getRoomAvailability(req.params.roomId, start, end));
});

app.get('/api/addons', (req, res) => {
  res.json(services.getAddOns());
});

app.get('/api/pets', (req, res) => {
  res.json(services.getPets());
});

app.post('/api/bookings', (req, res) => {
  withIdempotency(req, res, '/api/bookings', () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.createBooking(req.body, operator);
  });
});

app.get('/api/bookings/calendar', (req, res) => {
  const { start, end } = req.query;
  res.json(services.getBookingCalendar(start, end));
});

app.get('/api/bookings/:bookingId', (req, res) => {
  res.json(services.getBookingDetail(req.params.bookingId));
});

app.get('/api/bookings/:bookingId/history', (req, res) => {
  res.json(services.getBookingHistory(req.params.bookingId));
});

app.post('/api/bookings/:bookingId/confirm', (req, res) => {
  withIdempotency(req, res, `/api/bookings/${req.params.bookingId}/confirm`, () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.confirmBooking(req.params.bookingId, operator);
  });
});

app.post('/api/bookings/:bookingId/checkin', (req, res) => {
  withIdempotency(req, res, `/api/bookings/${req.params.bookingId}/checkin`, () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.checkInBooking(req.params.bookingId, req.body, operator);
  });
});

app.post('/api/bookings/:bookingId/checkout', (req, res) => {
  withIdempotency(req, res, `/api/bookings/${req.params.bookingId}/checkout`, () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.checkOutBooking(req.params.bookingId, req.body, operator);
  });
});

app.post('/api/bookings/:bookingId/cancel', (req, res) => {
  withIdempotency(req, res, `/api/bookings/${req.params.bookingId}/cancel`, () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.cancelBooking(req.params.bookingId, req.body, operator);
  });
});

app.post('/api/bookings/:bookingId/addons', (req, res) => {
  withIdempotency(req, res, `/api/bookings/${req.params.bookingId}/addons`, () => {
    const operator = req.headers['x-operator'] || 'api';
    return services.addAddOn(req.params.bookingId, req.body, operator);
  });
});

app.post('/api/bookings/:bookingId/feeding-plans', (req, res) => {
  const operator = req.headers['x-operator'] || 'api';
  res.json(services.createFeedingPlan(req.params.bookingId, req.body, operator));
});

app.post('/api/bookings/:bookingId/feeding-records', (req, res) => {
  const operator = req.headers['x-operator'] || 'api';
  res.json(services.recordFeeding(req.params.bookingId, req.body, operator));
});

app.post('/api/bookings/:bookingId/care-logs', (req, res) => {
  const operator = req.headers['x-operator'] || 'api';
  res.json(services.addCareLog(req.params.bookingId, req.body, operator));
});

app.post('/api/bookings/:bookingId/transport', (req, res) => {
  const operator = req.headers['x-operator'] || 'api';
  res.json(services.createTransport(req.params.bookingId, req.body, operator));
});

app.post('/api/bookings/:bookingId/payment', (req, res) => {
  const operator = req.headers['x-operator'] || 'api';
  res.json(services.updatePayment(req.params.bookingId, req.body, operator));
});

app.post('/api/bookings/:bookingId/correction', (req, res) => {
  const operator = req.headers['x-operator'] || 'staff';
  res.json(services.manualCorrection(req.params.bookingId, req.body, operator));
});

app.get('/api/reports/operations', (req, res) => {
  const { start, end } = req.query;
  res.json(services.getOperationReport(start, end));
});

app.get('/api/reports/export', (req, res) => {
  const { start, end, type = 'json' } = req.query;
  const report = services.getOperationReport(start, end);
  
  if (!report.success) {
    return res.json(report);
  }

  if (type === 'csv') {
    const data = report.data;
    let csv = '数据类型,时间范围,数值\n';
    csv += `总预约数,${data.date_range.start} ~ ${data.date_range.end},${data.summary.total_bookings}\n`;
    csv += `已完成,${data.date_range.start} ~ ${data.date_range.end},${data.summary.completed_bookings}\n`;
    csv += `已取消,${data.date_range.start} ~ ${data.date_range.end},${data.summary.cancelled_bookings}\n`;
    csv += `总收入,${data.date_range.start} ~ ${data.date_range.end},${data.summary.total_revenue}\n`;
    csv += `总退款,${data.date_range.start} ~ ${data.date_range.end},${data.summary.total_refund}\n`;
    csv += `净收入,${data.date_range.start} ~ ${data.date_range.end},${data.summary.net_revenue}\n`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=operation_report.csv');
    res.send('\uFEFF' + csv);
  } else {
    res.json(report);
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  宠物寄养预约 API 已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
  console.log(`可用接口:`);
  console.log(`  GET  /api/health                          - 健康检查`);
  console.log(`  GET  /api/rooms                           - 查询房型列表`);
  console.log(`  GET  /api/rooms/:id/availability          - 房型可用性`);
  console.log(`  GET  /api/addons                          - 加购服务列表`);
  console.log(`  GET  /api/pets                            - 宠物档案列表`);
  console.log(`  POST /api/bookings                        - 创建预约`);
  console.log(`  GET  /api/bookings/calendar               - 预约日历`);
  console.log(`  GET  /api/bookings/:id                    - 预约详情`);
  console.log(`  GET  /api/bookings/:id/history            - 操作历史`);
  console.log(`  POST /api/bookings/:id/confirm            - 确认预约`);
  console.log(`  POST /api/bookings/:id/checkin            - 办理入住`);
  console.log(`  POST /api/bookings/:id/checkout           - 办理退房`);
  console.log(`  POST /api/bookings/:id/cancel             - 取消预约`);
  console.log(`  POST /api/bookings/:id/addons             - 添加加购`);
  console.log(`  POST /api/bookings/:id/feeding-plans      - 创建喂养计划`);
  console.log(`  POST /api/bookings/:id/feeding-records    - 记录喂养`);
  console.log(`  POST /api/bookings/:id/care-logs          - 添加照护记录`);
  console.log(`  POST /api/bookings/:id/transport          - 接送服务`);
  console.log(`  POST /api/bookings/:id/payment            - 更新付款`);
  console.log(`  POST /api/bookings/:id/correction         - 人工修正`);
  console.log(`  GET  /api/reports/operations              - 运营报告`);
  console.log(`  GET  /api/reports/export                  - 导出报告`);
  console.log(`\n`);
});

module.exports = app;