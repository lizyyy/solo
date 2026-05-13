const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const xlsx = require('xlsx');
const dataStore = require('./models');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

const deduplicationCache = new Map();

app.get('/api/meetings', (req, res) => {
  res.json({ success: true, data: dataStore.meetings });
});

app.get('/api/meetings/:id', (req, res) => {
  const meeting = dataStore.meetings.find(m => m.id === req.params.id);
  if (!meeting) {
    return res.status(404).json({ success: false, message: '会议不存在' });
  }
  res.json({ success: true, data: meeting });
});

app.put('/api/meetings/:id', (req, res) => {
  const index = dataStore.meetings.findIndex(m => m.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '会议不存在' });
  }
  
  const oldValues = { ...dataStore.meetings[index] };
  const newValues = { ...dataStore.meetings[index], ...req.body, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'), previousValues: oldValues };
  
  dataStore.meetings[index] = newValues;
  
  dataStore.logOperation('update', req.params.id, 'meeting', req.body.operator || '系统', oldValues, newValues, '修改会议信息');
  
  res.json({ success: true, data: dataStore.meetings[index] });
});

app.get('/api/meetings/:id/visitors', (req, res) => {
  const visitors = dataStore.visitors.filter(v => v.meetingId === req.params.id);
  res.json({ success: true, data: visitors });
});

app.post('/api/visitors', (req, res) => {
  const visitor = {
    id: uuidv4(),
    ...req.body,
    verified: false,
    createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    previousValues: null
  };
  dataStore.visitors.push(visitor);
  
  dataStore.logOperation('create', visitor.id, 'visitor', req.body.operator || '系统', null, visitor, '添加访客');
  
  res.json({ success: true, data: visitor });
});

app.put('/api/visitors/:id', (req, res) => {
  const index = dataStore.visitors.findIndex(v => v.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '访客不存在' });
  }
  
  const oldValues = { ...dataStore.visitors[index] };
  const newValues = { ...dataStore.visitors[index], ...req.body, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'), previousValues: oldValues };
  
  dataStore.visitors[index] = newValues;
  
  dataStore.logOperation('update', req.params.id, 'visitor', req.body.operator || '系统', oldValues, newValues, '修改访客信息');
  
  res.json({ success: true, data: dataStore.visitors[index] });
});

app.get('/api/meetings/:id/meal-rules', (req, res) => {
  const rules = dataStore.mealRules.find(r => r.meetingId === req.params.id);
  res.json({ success: true, data: rules || null });
});

app.put('/api/meal-rules/:id', (req, res) => {
  const index = dataStore.mealRules.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '餐标规则不存在' });
  }
  
  const oldValues = { ...dataStore.mealRules[index] };
  const newValues = { ...dataStore.mealRules[index], ...req.body, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss'), previousValues: oldValues };
  
  dataStore.mealRules[index] = newValues;
  
  dataStore.logOperation('update', req.params.id, 'mealRule', req.body.operator || '系统', oldValues, newValues, '修改餐标规则');
  
  res.json({ success: true, data: dataStore.mealRules[index] });
});

app.post('/api/order-changes', (req, res) => {
  const { meetingId, visitorId, changeType, reason, operator } = req.body;
  
  const meeting = dataStore.meetings.find(m => m.id === meetingId);
  if (!meeting) {
    return res.status(404).json({ success: false, message: '会议不存在' });
  }
  
  const mealRule = dataStore.mealRules.find(r => r.meetingId === meetingId);
  const deadlineHours = mealRule ? mealRule.deadlineHours : 24;
  
  const meetingDateTime = moment(`${meeting.date} ${meeting.startTime}`);
  const now = moment();
  const hoursDiff = meetingDateTime.diff(now, 'hours');
  
  if (hoursDiff < deadlineHours) {
    return res.status(400).json({ 
      success: false, 
      message: `距离会议开始不足${deadlineHours}小时，无法变更订餐`,
      code: 'DEADLINE_PASSED'
    });
  }
  
  const visitor = dataStore.visitors.find(v => v.id === visitorId);
  if (visitor && changeType === 'remove_meal' && visitor.verified) {
    return res.status(400).json({ 
      success: false, 
      message: '该访客已领餐，无法取消订餐',
      code: 'ALREADY_VERIFIED'
    });
  }
  
  const change = {
    id: uuidv4(),
    meetingId,
    visitorId,
    changeType,
    reason,
    operator,
    status: 'approved',
    createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
  };
  
  dataStore.orderChanges.push(change);
  
  if (visitor) {
    const oldValues = { ...visitor };
    visitor.hasMeal = changeType !== 'remove_meal';
    visitor.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    visitor.previousValues = oldValues;
    
    dataStore.logOperation('update', visitorId, 'visitor', operator, oldValues, visitor, `订餐变更: ${changeType}`);
  }
  
  res.json({ success: true, data: change });
});

app.post('/api/meal-verifications', (req, res) => {
  const { meetingId, visitorId, operator, callbackId } = req.body;
  
  if (callbackId) {
    if (deduplicationCache.has(callbackId)) {
      return res.json({ 
        success: true, 
        data: deduplicationCache.get(callbackId),
        message: '重复回调，已跳过处理'
      });
    }
  }
  
  const visitor = dataStore.visitors.find(v => v.id === visitorId);
  if (!visitor) {
    return res.status(404).json({ success: false, message: '访客不存在' });
  }
  
  if (visitor.verified) {
    return res.status(400).json({ 
      success: false, 
      message: '该访客已领餐，请勿重复核销',
      code: 'ALREADY_VERIFIED'
    });
  }
  
  const verification = {
    id: uuidv4(),
    meetingId,
    visitorId,
    visitorName: visitor.name,
    operator,
    verifiedAt: moment().format('YYYY-MM-DD HH:mm:ss'),
    callbackId
  };
  
  dataStore.mealVerifications.push(verification);
  
  const oldValues = { ...visitor };
  visitor.verified = true;
  visitor.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
  visitor.previousValues = oldValues;
  
  dataStore.logOperation('verify', visitorId, 'visitor', operator, oldValues, visitor, '领餐核销');
  
  if (callbackId) {
    deduplicationCache.set(callbackId, verification);
  }
  
  res.json({ success: true, data: verification });
});

app.get('/api/meetings/:id/expense-summary', (req, res) => {
  const meetingId = req.params.id;
  const visitors = dataStore.visitors.filter(v => v.meetingId === meetingId);
  const mealRule = dataStore.mealRules.find(r => r.meetingId === meetingId);
  
  const price = mealRule ? mealRule.standardPrice : 50;
  
  const totalExpected = visitors.filter(v => v.hasMeal).length * price;
  const totalVerified = visitors.filter(v => v.verified).length * price;
  const totalUnverified = visitors.filter(v => v.hasMeal && !v.verified).length * price;
  
  const summary = {
    id: uuidv4(),
    meetingId,
    totalVisitors: visitors.length,
    totalWithMeal: visitors.filter(v => v.hasMeal).length,
    totalVerified: visitors.filter(v => v.verified).length,
    totalUnverified: visitors.filter(v => v.hasMeal && !v.verified).length,
    pricePerPerson: price,
    totalExpected,
    totalVerifiedAmount: totalVerified,
    totalUnverifiedAmount: totalUnverified,
    calculatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
  };
  
  res.json({ success: true, data: summary });
});

app.get('/api/meetings/:id/timeline', (req, res) => {
  const meetingId = req.params.id;
  const timeline = [];
  
  const meeting = dataStore.meetings.find(m => m.id === meetingId);
  if (meeting) {
    timeline.push({
      id: meeting.id,
      type: 'meeting_created',
      title: '会议创建',
      time: meeting.createdAt,
      operator: meeting.organizer,
      description: `创建会议: ${meeting.title}`
    });
  }
  
  const visitors = dataStore.visitors.filter(v => v.meetingId === meetingId);
  visitors.forEach(visitor => {
    timeline.push({
      id: visitor.id,
      type: 'visitor_added',
      title: '访客添加',
      time: visitor.createdAt,
      operator: '系统',
      description: `添加访客: ${visitor.name}`
    });
  });
  
  const changes = dataStore.orderChanges.filter(c => c.meetingId === meetingId);
  changes.forEach(change => {
    timeline.push({
      id: change.id,
      type: 'order_change',
      title: '订餐变更',
      time: change.createdAt,
      operator: change.operator,
      description: change.reason
    });
  });
  
  const verifications = dataStore.mealVerifications.filter(v => v.meetingId === meetingId);
  verifications.forEach(verification => {
    timeline.push({
      id: verification.id,
      type: 'meal_verified',
      title: '领餐核销',
      time: verification.verifiedAt,
      operator: verification.operator,
      description: `${verification.visitorName} 领餐`
    });
  });
  
  timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
  
  res.json({ success: true, data: timeline });
});

app.get('/api/operation-logs', (req, res) => {
  let logs = [...dataStore.operationLogs];
  
  if (req.query.operator) {
    logs = logs.filter(l => l.operator === req.query.operator);
  }
  
  if (req.query.startTime) {
    logs = logs.filter(l => l.timestamp >= req.query.startTime);
  }
  
  if (req.query.endTime) {
    logs = logs.filter(l => l.timestamp <= req.query.endTime);
  }
  
  res.json({ success: true, data: logs });
});

app.get('/api/report/:meetingId', (req, res) => {
  const meetingId = req.params.meetingId;
  const meeting = dataStore.meetings.find(m => m.id === meetingId);
  if (!meeting) {
    return res.status(404).json({ success: false, message: '会议不存在' });
  }
  
  const visitors = dataStore.visitors.filter(v => v.meetingId === meetingId);
  const mealRule = dataStore.mealRules.find(r => r.meetingId === meetingId);
  const changes = dataStore.orderChanges.filter(c => c.meetingId === meetingId);
  const verifications = dataStore.mealVerifications.filter(v => v.meetingId === meetingId);
  const logs = dataStore.operationLogs.filter(l => l.entityType === 'meeting' || l.entityType === 'visitor' || l.entityType === 'mealRule');
  
  const reportData = {
    meeting,
    visitors,
    mealRule,
    changes,
    verifications,
    logs,
    generatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
  };
  
  res.json({ success: true, data: reportData });
});

app.post('/api/review', (req, res) => {
  const { meetingId, operator, reviewNotes } = req.body;
  
  const meeting = dataStore.meetings.find(m => m.id === meetingId);
  if (!meeting) {
    return res.status(404).json({ success: false, message: '会议不存在' });
  }
  
  const oldValues = { ...meeting };
  meeting.status = 'reviewed';
  meeting.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
  meeting.previousValues = oldValues;
  
  dataStore.logOperation('review', meetingId, 'meeting', operator, oldValues, meeting, `复核完成: ${reviewNotes}`);
  
  res.json({ success: true, data: meeting });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});