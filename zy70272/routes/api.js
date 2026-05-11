const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');

const models = require('../models');
const weatherService = require('../services/weather');
const schedulingService = require('../services/scheduling');
const equipmentService = require('../services/equipment');
const flightService = require('../services/flight');

const { coaches, students, equipment, weatherData, LEVELS } = models;

router.get('/', (req, res) => {
  res.json({
    name: '滑翔伞飞行窗口 API',
    version: '1.0.0',
    description: '根据风向、教练、学员等级和装备状态判断飞行窗口的业务工具',
    endpoints: {
      reference: {
        'GET /api/weather': '获取天气窗口',
        'GET /api/coaches': '获取教练列表',
        'GET /api/students': '获取学员列表',
        'GET /api/equipment': '获取装备列表'
      },
      query: {
        'GET /api/weather/windows?date=&level=': '查询某日期某学员等级的可飞窗口',
        'GET /api/coaches/available?date=&timeSlot=&level=': '查询某时段可用的教练'
      },
      workflow: {
        'POST /api/flights': '创建飞行申请',
        'POST /api/flights/:id/weather': '天气窗口检查',
        'POST /api/flights/:id/coach': '教练排班检查',
        'POST /api/flights/:id/equipment': '装备检查',
        'POST /api/flights/:id/submit': '提交审批',
        'POST /api/flights/:id/approve': '审批通过',
        'POST /api/flights/:id/reject': '审批拒绝',
        'POST /api/flights/:id/review': '人工复核',
        'POST /api/flights/:id/complete': '完成飞行并提交安全报告'
      },
      query_and_report: {
        'GET /api/flights': '查询所有飞行申请（可按status过滤）',
        'GET /api/flights/:id': '查询单个飞行申请详情',
        'GET /api/reports/safety': '导出安全报表'
      }
    }
  });
});

router.get('/weather', (req, res) => {
  res.json({ success: true, data: weatherData });
});

router.get('/weather/windows', (req, res) => {
  const { date, level } = req.query;
  
  if (!level || !LEVELS[level.toUpperCase()]) {
    return res.status(400).json({
      success: false,
      error: '缺少或无效的学员等级参数 level',
      validLevels: Object.values(LEVELS)
    });
  }

  const result = weatherService.getWeatherWindows(date, level);
  res.json({ success: true, data: result });
});

router.get('/coaches', (req, res) => {
  res.json({ success: true, data: coaches });
});

router.get('/coaches/available', (req, res) => {
  const { date, timeSlot, level } = req.query;
  
  if (!date || !timeSlot || !level) {
    return res.status(400).json({
      success: false,
      error: '缺少必填参数',
      required: ['date', 'timeSlot', 'level']
    });
  }

  const result = schedulingService.getAvailableCoaches(date, timeSlot, level);
  res.json({ success: true, data: result });
});

router.get('/students', (req, res) => {
  res.json({ success: true, data: students });
});

router.get('/equipment', (req, res) => {
  res.json({ success: true, data: equipment });
});

router.post('/flights', (req, res) => {
  const result = flightService.createFlightRequest(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

router.post('/flights/:id/weather', (req, res) => {
  const { weatherId } = req.body;
  if (!weatherId) {
    return res.status(400).json({
      success: false,
      error: '缺少 weatherId 参数'
    });
  }
  
  const result = flightService.checkWeatherWindow(req.params.id, weatherId);
  if (!result.success && !result.needsReview) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/coach', (req, res) => {
  const { coachId } = req.body;
  if (!coachId) {
    return res.status(400).json({
      success: false,
      error: '缺少 coachId 参数'
    });
  }
  
  const result = flightService.checkCoachSchedule(req.params.id, coachId);
  if (!result.success && !result.needsReview) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/equipment', (req, res) => {
  const { equipmentIds } = req.body;
  if (!equipmentIds || !Array.isArray(equipmentIds)) {
    return res.status(400).json({
      success: false,
      error: '缺少或无效的 equipmentIds 参数（应为数组）'
    });
  }
  
  const result = flightService.checkEquipmentSelection(req.params.id, equipmentIds);
  if (!result.success && !result.needsReview) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/submit', (req, res) => {
  const result = flightService.submitForApproval(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/approve', (req, res) => {
  const { approver, notes } = req.body;
  if (!approver) {
    return res.status(400).json({
      success: false,
      error: '缺少 approver 参数（审批人）'
    });
  }
  
  const result = flightService.approveFlight(req.params.id, approver, notes);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/reject', (req, res) => {
  const { approver, reason } = req.body;
  if (!approver || !reason) {
    return res.status(400).json({
      success: false,
      error: '缺少 approver 或 reason 参数'
    });
  }
  
  const result = flightService.rejectFlight(req.params.id, approver, reason);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/review', (req, res) => {
  const { reviewer, decision, corrections } = req.body;
  if (!reviewer || !decision) {
    return res.status(400).json({
      success: false,
      error: '缺少 reviewer 或 decision 参数',
      validDecisions: ['approve', 'reject']
    });
  }
  
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({
      success: false,
      error: 'decision 必须是 approve 或 reject'
    });
  }
  
  const result = flightService.manualReview(req.params.id, reviewer, decision, corrections);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/flights/:id/complete', (req, res) => {
  const result = flightService.completeFlight(req.params.id, req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/flights', (req, res) => {
  const { status } = req.query;
  const result = flightService.getAllFlightRequests(status);
  res.json({ success: true, data: result });
});

router.get('/flights/:id', (req, res) => {
  const result = flightService.getFlightRequest(req.params.id);
  if (!result) {
    return res.status(404).json({
      success: false,
      error: '飞行申请不存在'
    });
  }
  res.json({ success: true, data: result });
});

router.get('/reports/safety', (req, res) => {
  const { startDate, endDate } = req.query;
  const result = flightService.exportSafetyReports(startDate, endDate);
  res.json(result);
});

router.get('/demo/success-case', (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  
  res.json({
    description: '顺利样例：钱中间(intermediate) → 今日上午 → 张明(advanced) → Alpha-1/备份伞S-1/头盔H-1',
    steps: [
      { method: 'POST', url: '/api/flights', body: { studentId: 's2', date: today, timeSlot: 'morning' } },
      { method: 'POST', url: '/api/flights/:id/weather', body: { weatherId: 'w1' } },
      { method: 'POST', url: '/api/flights/:id/coach', body: { coachId: 'c1' } },
      { method: 'POST', url: '/api/flights/:id/equipment', body: { equipmentIds: ['e1', 'e4', 'e5'] } },
      { method: 'POST', url: '/api/flights/:id/submit', body: {} },
      { method: 'POST', url: '/api/flights/:id/approve', body: { approver: '安全主管' } },
      { method: 'POST', url: '/api/flights/:id/complete', body: { flightDuration: 45, altitude: 800, safetyRating: 'normal' } }
    ]
  });
});

router.get('/demo/failure-cases', (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  
  res.json({
    description: '拦截/待复核样例',
    cases: [
      {
        name: '缺字段',
        method: 'POST',
        url: '/api/flights',
        body: { studentId: 's1' },
        expectation: '缺少 date, timeSlot'
      },
      {
        name: '天气不匹配（赵小白 beginner 申请 w1，要求 intermediate）',
        method: 'POST',
        url: '/api/flights/:id/weather',
        body: { weatherId: 'w1' },
        prerequisite: { studentId: 's1', date: today, timeSlot: 'morning' },
        expectation: '学员等级不足，进入 needs_review'
      },
      {
        name: '教练不可用（王强 c3 上午不可用）',
        method: 'POST',
        url: '/api/flights/:id/coach',
        body: { coachId: 'c3' },
        prerequisite: { studentId: 's2', date: today, timeSlot: 'morning', weatherId: 'w1' },
        expectation: '教练不可用，进入 needs_review'
      },
      {
        name: '装备过期/维护中（选 e3 Gamma-3）',
        method: 'POST',
        url: '/api/flights/:id/equipment',
        body: { equipmentIds: ['e3', 'e4', 'e5'] },
        prerequisite: { studentId: 's2', date: today, timeSlot: 'morning', weatherId: 'w1', coachId: 'c1' },
        expectation: '装备状态为 maintenance，进入 needs_review'
      },
      {
        name: '重复提交（同一学员同时段再次提交）',
        method: 'POST',
        url: '/api/flights',
        body: { studentId: 's2', date: today, timeSlot: 'morning' },
        prerequisite: '先创建一次相同的申请',
        expectation: '返回重复提交错误'
      },
      {
        name: '非法流转（跳过天气检查直接查教练）',
        method: 'POST',
        url: '/api/flights/:id/coach',
        body: { coachId: 'c1' },
        prerequisite: { studentId: 's2', date: today, timeSlot: 'morning' },
        expectation: '非法状态流转错误'
      }
    ]
  });
});

module.exports = router;
