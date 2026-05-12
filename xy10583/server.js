const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const tripService = require('./services/tripService');
const settlementService = require('./services/settlementService');
const store = require('./data/store');

const app = express();
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function handleError(res, error) {
  console.error('Error:', error.message);
  res.status(400).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '用车调度费用API运行正常',
    timestamp: new Date().toISOString(),
    config: {
      baseRate: config.RATES.BASE_RATE,
      ratePerKm: config.RATES.RATE_PER_KM,
      waitingRate: config.RATES.WAITING_RATE_PER_MINUTE,
      driverCommission: config.RATES.DRIVER_COMMISSION_RATE
    }
  });
});

app.post('/api/trips', (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'] || uuidv4();
    const existing = store.getIdempotentRequest(idempotencyKey);
    
    if (existing) {
      return res.json({
        success: true,
        isDuplicate: true,
        data: existing.response,
        message: '重复请求，返回之前的结果'
      });
    }

    const trip = tripService.createTrip(req.body);
    store.saveIdempotentRequest(idempotencyKey, trip);
    
    res.json({
      success: true,
      data: trip,
      idempotencyKey
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/trips', (req, res) => {
  try {
    const trips = tripService.getAllTrips(req.query);
    res.json({
      success: true,
      data: trips
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/trips/:tripId', (req, res) => {
  try {
    const details = tripService.getTripDetails(req.params.tripId);
    if (!details) {
      return res.status(404).json({
        success: false,
        error: '行程不存在'
      });
    }
    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/dispatch', (req, res) => {
  try {
    const { driverId, driverName } = req.body;
    if (!driverId || !driverName) {
      throw new Error('缺少司机ID或司机姓名');
    }
    const trip = tripService.dispatchDriver(req.params.tripId, driverId, driverName);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/driver-arrive', (req, res) => {
  try {
    const trip = tripService.driverArrive(req.params.tripId);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/start', (req, res) => {
  try {
    const { startTime } = req.body;
    const trip = tripService.startTrip(req.params.tripId, startTime);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/end', (req, res) => {
  try {
    const { endTime, actualDistanceKm } = req.body;
    const trip = tripService.endTrip(req.params.tripId, endTime, actualDistanceKm);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/cancel', (req, res) => {
  try {
    const { cancelledBy, reason } = req.body;
    if (!cancelledBy) {
      throw new Error('缺少取消人信息');
    }
    const trip = tripService.cancelTrip(req.params.tripId, cancelledBy, reason);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/approve-intercity', (req, res) => {
  try {
    const { approved } = req.body;
    if (approved === undefined) {
      throw new Error('缺少审批结果');
    }
    const trip = tripService.approveIntercity(req.params.tripId, approved);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/correct', (req, res) => {
  try {
    const { corrections, operator } = req.body;
    if (!operator) {
      throw new Error('缺少操作者信息');
    }
    if (!corrections || Object.keys(corrections).length === 0) {
      throw new Error('缺少修正内容');
    }
    const trip = settlementService.manualCorrectTrip(req.params.tripId, corrections, operator);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/trips/:tripId/allocate', (req, res) => {
  try {
    const { allocations, operator } = req.body;
    if (!operator) {
      throw new Error('缺少操作者信息');
    }
    if (!allocations || allocations.length === 0) {
      throw new Error('缺少分摊信息');
    }
    const trip = settlementService.allocateToDepartments(req.params.tripId, allocations, operator);
    res.json({
      success: true,
      data: trip
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/settlements', (req, res) => {
  try {
    const { tripId, idempotencyKey, operator } = req.body;
    if (!tripId || !idempotencyKey || !operator) {
      throw new Error('缺少必要参数：tripId, idempotencyKey, operator');
    }

    const result = settlementService.settleTrip(tripId, idempotencyKey, operator);
    
    if (result.isDuplicate) {
      return res.json({
        success: true,
        isDuplicate: true,
        data: result.settlement,
        message: '重复结算请求，返回之前的结果（幂等性保证）'
      });
    }

    res.json({
      success: true,
      data: result.settlement
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/departments/:code/budget', (req, res) => {
  try {
    const { amount } = req.query;
    const budgetInfo = settlementService.checkDepartmentBudget(
      req.params.code,
      amount ? parseFloat(amount) : 0
    );
    res.json({
      success: true,
      data: budgetInfo
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/reports/full', (req, res) => {
  try {
    const report = settlementService.generateFullReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/reports/department/:code', (req, res) => {
  try {
    const report = settlementService.getDepartmentReport(req.params.code);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/reports/driver/:driverId', (req, res) => {
  try {
    const report = settlementService.getDriverIncomeReport(req.params.driverId);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/reset', (req, res) => {
  try {
    store.resetData();
    res.json({
      success: true,
      message: '数据已重置'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.listen(config.PORT, () => {
  console.log(`用车调度费用API已启动，运行在 http://localhost:${config.PORT}`);
  console.log(`健康检查: GET http://localhost:${config.PORT}/api/health`);
});
