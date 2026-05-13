const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

let db = {
  memberPackages: [],
  courseSchedules: [],
  waitlistQueue: [],
  transferHistory: [],
  coachLeaves: [],
  consumptionBalance: [],
  auditLogs: [],
  idempotencyKeys: {}
};

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      db = JSON.parse(data);
    } catch (e) {
      console.log('数据文件加载失败，使用默认数据');
      initSampleData();
    }
  } else {
    initSampleData();
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function initSampleData() {
  const coaches = [
    { id: 'coach_001', name: '张教练', phone: '13800138001' },
    { id: 'coach_002', name: '李教练', phone: '13800138002' },
    { id: 'coach_003', name: '王教练', phone: '13800138003' }
  ];

  const members = [
    { id: 'member_001', name: '会员A', phone: '13900139001' },
    { id: 'member_002', name: '会员B', phone: '13900139002' },
    { id: 'member_003', name: '会员C', phone: '13900139003' },
    { id: 'member_004', name: '会员D', phone: '13900139004' }
  ];

  const courses = [
    { id: 'course_001', name: '瑜伽初级班', duration: 60, capacity: 10 },
    { id: 'course_002', name: '动感单车', duration: 45, capacity: 15 },
    { id: 'course_003', name: '普拉提', duration: 60, capacity: 8 }
  ];

  db.memberPackages = members.map(member => ({
    id: `pkg_${member.id}`,
    memberId: member.id,
    memberName: member.name,
    memberPhone: member.phone,
    packageName: '季度通用课包',
    totalCount: 30,
    usedCount: Math.floor(Math.random() * 15),
    validFrom: moment().subtract(1, 'month').format('YYYY-MM-DD'),
    validTo: moment().add(2, 'months').format('YYYY-MM-DD'),
    status: 'active',
    createdAt: moment().subtract(1, 'month').format(),
    updatedAt: moment().format()
  }));

  db.courseSchedules = [];
  for (let i = 0; i < 14; i++) {
    const course = courses[i % courses.length];
    const coach = coaches[i % coaches.length];
    const date = moment().add(i, 'days').format('YYYY-MM-DD');
    const startTime = ['09:00', '14:00', '19:00'][i % 3];
    const endTime = moment(startTime, 'HH:mm').add(course.duration, 'minutes').format('HH:mm');
    
    db.courseSchedules.push({
      id: `sched_${uuidv4().slice(0, 8)}`,
      courseId: course.id,
      courseName: course.name,
      coachId: coach.id,
      coachName: coach.name,
      date: date,
      startTime: startTime,
      endTime: endTime,
      capacity: course.capacity,
      enrolledCount: Math.floor(Math.random() * course.capacity),
      status: i === 5 ? 'cancelled' : 'scheduled',
      createdAt: moment().format(),
      updatedAt: moment().format()
    });
  }

  db.waitlistQueue = [
    {
      id: `wait_${uuidv4().slice(0, 8)}`,
      memberId: members[0].id,
      memberName: members[0].name,
      memberPhone: members[0].phone,
      scheduleId: db.courseSchedules[0].id,
      courseName: db.courseSchedules[0].courseName,
      courseDate: db.courseSchedules[0].date,
      courseTime: db.courseSchedules[0].startTime,
      position: 1,
      status: 'waiting',
      priority: 'normal',
      createdAt: moment().subtract(2, 'hours').format(),
      updatedAt: moment().subtract(2, 'hours').format()
    },
    {
      id: `wait_${uuidv4().slice(0, 8)}`,
      memberId: members[1].id,
      memberName: members[1].name,
      memberPhone: members[1].phone,
      scheduleId: db.courseSchedules[0].id,
      courseName: db.courseSchedules[0].courseName,
      courseDate: db.courseSchedules[0].date,
      courseTime: db.courseSchedules[0].startTime,
      position: 2,
      status: 'waiting',
      priority: 'vip',
      createdAt: moment().subtract(1, 'hours').format(),
      updatedAt: moment().subtract(1, 'hours').format()
    }
  ];

  db.coachLeaves = [
    {
      id: `leave_${uuidv4().slice(0, 8)}`,
      coachId: coaches[0].id,
      coachName: coaches[0].name,
      leaveDate: moment().add(5, 'days').format('YYYY-MM-DD'),
      reason: '身体不适',
      status: 'approved',
      handledBy: '管理员',
      createdAt: moment().subtract(1, 'day').format(),
      updatedAt: moment().subtract(1, 'day').format()
    }
  ];

  db.consumptionBalance = db.memberPackages.map(pkg => ({
    id: `bal_${pkg.id}`,
    memberId: pkg.memberId,
    memberName: pkg.memberName,
    packageId: pkg.id,
    totalCount: pkg.totalCount,
    usedCount: pkg.usedCount,
    remainingCount: pkg.totalCount - pkg.usedCount,
    lastConsumption: moment().subtract(Math.floor(Math.random() * 7), 'days').format(),
    createdAt: moment().format(),
    updatedAt: moment().format()
  }));

  db.transferHistory = [
    {
      id: `trans_${uuidv4().slice(0, 8)}`,
      type: 'waitlist_to_enrolled',
      memberId: members[2].id,
      memberName: members[2].name,
      fromScheduleId: db.courseSchedules[1].id,
      fromCourseName: db.courseSchedules[1].courseName,
      fromDate: db.courseSchedules[1].date,
      toScheduleId: db.courseSchedules[2].id,
      toCourseName: db.courseSchedules[2].courseName,
      toDate: db.courseSchedules[2].date,
      status: 'completed',
      reason: '会员主动调课',
      handledBy: '系统自动',
      createdAt: moment().subtract(3, 'days').format(),
      timeline: [
        {
          time: moment().subtract(3, 'days').subtract(2, 'hours').format(),
          action: '发起调课申请',
          operator: '会员C',
          reason: '时间冲突',
          details: '从动感单车调至普拉提'
        },
        {
          time: moment().subtract(3, 'days').subtract(1, 'hour').format(),
          action: '系统审核通过',
          operator: '系统',
          reason: '目标课程有空位',
          details: '自动完成调课'
        }
      ]
    }
  ];

  db.auditLogs = [];
  db.idempotencyKeys = {};
  
  saveData();
}

function checkIdempotency(key) {
  if (db.idempotencyKeys[key]) {
    return { isDuplicate: true, result: db.idempotencyKeys[key] };
  }
  return { isDuplicate: false };
}

function recordIdempotency(key, result) {
  db.idempotencyKeys[key] = result;
  saveData();
}

function createAuditLog(entityType, entityId, action, operator, before, after, reason) {
  const log = {
    id: `audit_${uuidv4().slice(0, 8)}`,
    entityType,
    entityId,
    action,
    operator,
    before,
    after,
    reason,
    createdAt: moment().format()
  };
  db.auditLogs.push(log);
  saveData();
  return log;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: moment().format() });
});

app.get('/api/member-packages', (req, res) => {
  res.json({ success: true, data: db.memberPackages });
});

app.get('/api/course-schedules', (req, res) => {
  res.json({ success: true, data: db.courseSchedules });
});

app.get('/api/waitlist', (req, res) => {
  const { scheduleId, status } = req.query;
  let data = [...db.waitlistQueue];
  if (scheduleId) data = data.filter(w => w.scheduleId === scheduleId);
  if (status) data = data.filter(w => w.status === status);
  data.sort((a, b) => a.position - b.position);
  res.json({ success: true, data });
});

app.post('/api/waitlist', (req, res) => {
  const { idempotencyKey, memberId, scheduleId, priority = 'normal', operator } = req.body;
  
  if (idempotencyKey) {
    const check = checkIdempotency(idempotencyKey);
    if (check.isDuplicate) {
      return res.json({ success: true, data: check.result, isDuplicate: true });
    }
  }

  const member = db.memberPackages.find(m => m.memberId === memberId);
  const schedule = db.courseSchedules.find(s => s.id === scheduleId);
  
  if (!member || !schedule) {
    return res.status(400).json({ success: false, message: '会员或课程不存在' });
  }

  const existing = db.waitlistQueue.find(
    w => w.memberId === memberId && w.scheduleId === scheduleId && w.status === 'waiting'
  );
  if (existing) {
    return res.status(400).json({ success: false, message: '已在候补队列中' });
  }

  const maxPosition = Math.max(0, ...db.waitlistQueue
    .filter(w => w.scheduleId === scheduleId && w.status === 'waiting')
    .map(w => w.position));

  const waitlistItem = {
    id: `wait_${uuidv4().slice(0, 8)}`,
    memberId,
    memberName: member.memberName,
    memberPhone: member.memberPhone,
    scheduleId,
    courseName: schedule.courseName,
    courseDate: schedule.date,
    courseTime: schedule.startTime,
    position: maxPosition + 1,
    status: 'waiting',
    priority,
    timeline: [{
      time: moment().format(),
      action: '加入候补队列',
      operator: operator || member.memberName,
      reason: '主动申请',
      details: `队列位置: ${maxPosition + 1}`
    }],
    createdAt: moment().format(),
    updatedAt: moment().format()
  };

  db.waitlistQueue.push(waitlistItem);
  createAuditLog('waitlist', waitlistItem.id, 'create', operator || member.memberName, null, waitlistItem, '加入候补队列');
  
  if (idempotencyKey) {
    recordIdempotency(idempotencyKey, waitlistItem);
  } else {
    saveData();
  }

  res.json({ success: true, data: waitlistItem });
});

app.post('/api/waitlist/:id/advance', (req, res) => {
  const { id } = req.params;
  const { operator, reason, idempotencyKey } = req.body;

  if (idempotencyKey) {
    const check = checkIdempotency(idempotencyKey);
    if (check.isDuplicate) {
      return res.json({ success: true, data: check.result, isDuplicate: true });
    }
  }

  const waitItem = db.waitlistQueue.find(w => w.id === id);
  if (!waitItem) {
    return res.status(404).json({ success: false, message: '候补记录不存在' });
  }

  const beforeState = { ...waitItem };
  const schedule = db.courseSchedules.find(s => s.id === waitItem.scheduleId);
  
  if (!schedule) {
    return res.status(400).json({ success: false, message: '课程排期不存在' });
  }

  if (schedule.enrolledCount >= schedule.capacity) {
    return res.status(400).json({ success: false, message: '课程已满，无法推进候补' });
  }

  const balance = db.consumptionBalance.find(b => b.memberId === waitItem.memberId);
  if (!balance || balance.remainingCount <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: '消课余额不足，需要人工处理',
      needManual: true
    });
  }

  waitItem.status = 'advanced';
  waitItem.updatedAt = moment().format();
  waitItem.timeline.push({
    time: moment().format(),
    action: '候补成功，转为报名',
    operator: operator || '系统',
    reason: reason || '课程有空位',
    details: '从候补队列转为正式报名'
  });

  schedule.enrolledCount += 1;
  schedule.updatedAt = moment().format();

  balance.usedCount += 1;
  balance.remainingCount -= 1;
  balance.updatedAt = moment().format();

  const sameScheduleWaiters = db.waitlistQueue
    .filter(w => w.scheduleId === waitItem.scheduleId && w.status === 'waiting')
    .sort((a, b) => a.position - b.position);
  sameScheduleWaiters.forEach((w, idx) => {
    w.position = idx + 1;
  });

  const transferRecord = {
    id: `trans_${uuidv4().slice(0, 8)}`,
    type: 'waitlist_to_enrolled',
    memberId: waitItem.memberId,
    memberName: waitItem.memberName,
    toScheduleId: schedule.id,
    toCourseName: schedule.courseName,
    toDate: schedule.date,
    status: 'completed',
    reason: '候补成功',
    handledBy: operator || '系统',
    timeline: waitItem.timeline,
    createdAt: moment().format()
  };
  db.transferHistory.push(transferRecord);

  createAuditLog('waitlist', id, 'advance', operator || '系统', beforeState, waitItem, reason || '候补成功');
  
  if (idempotencyKey) {
    recordIdempotency(idempotencyKey, waitItem);
  } else {
    saveData();
  }

  res.json({ success: true, data: waitItem });
});

app.post('/api/waitlist/:id/correct', (req, res) => {
  const { id } = req.params;
  const { operator, reason, newStatus, newPosition } = req.body;

  const waitItem = db.waitlistQueue.find(w => w.id === id);
  if (!waitItem) {
    return res.status(404).json({ success: false, message: '候补记录不存在' });
  }

  const beforeState = JSON.parse(JSON.stringify(waitItem));

  if (newStatus) waitItem.status = newStatus;
  if (newPosition !== undefined) waitItem.position = newPosition;
  
  waitItem.updatedAt = moment().format();
  waitItem.timeline.push({
    time: moment().format(),
    action: '状态修正',
    operator: operator || '管理员',
    reason: reason || '人工修正',
    details: `状态: ${waitItem.status}, 位置: ${waitItem.position}`
  });

  createAuditLog('waitlist', id, 'correct', operator || '管理员', beforeState, waitItem, reason || '人工修正');
  saveData();

  res.json({ success: true, data: waitItem });
});

app.get('/api/transfer-history', (req, res) => {
  const { memberId, handledBy, startDate, endDate } = req.query;
  let data = [...db.transferHistory];
  
  if (memberId) data = data.filter(t => t.memberId === memberId);
  if (handledBy) data = data.filter(t => t.handledBy === handledBy);
  if (startDate) data = data.filter(t => t.createdAt >= startDate);
  if (endDate) data = data.filter(t => t.createdAt <= endDate + 'T23:59:59');
  
  res.json({ success: true, data });
});

app.get('/api/coach-leaves', (req, res) => {
  res.json({ success: true, data: db.coachLeaves });
});

app.post('/api/coach-leaves', (req, res) => {
  const { coachId, leaveDate, reason, operator } = req.body;
  
  const existingLeave = db.coachLeaves.find(
    l => l.coachId === coachId && l.leaveDate === leaveDate
  );
  if (existingLeave) {
    return res.status(400).json({ success: false, message: '该日期已有请假记录' });
  }

  const coachNames = { 'coach_001': '张教练', 'coach_002': '李教练', 'coach_003': '王教练' };
  
  const leave = {
    id: `leave_${uuidv4().slice(0, 8)}`,
    coachId,
    coachName: coachNames[coachId] || '未知教练',
    leaveDate,
    reason,
    status: 'pending',
    handledBy: operator || '管理员',
    createdAt: moment().format(),
    updatedAt: moment().format()
  };

  db.coachLeaves.push(leave);
  
  const affectedSchedules = db.courseSchedules.filter(
    s => s.coachId === coachId && s.date === leaveDate && s.status === 'scheduled'
  );
  
  affectedSchedules.forEach(schedule => {
    const waiters = db.waitlistQueue.filter(
      w => w.scheduleId === schedule.id && w.status === 'waiting'
    );
    waiters.forEach(waiter => {
      waiter.timeline.push({
        time: moment().format(),
        action: '课程异常提醒',
        operator: '系统',
        reason: `教练请假: ${reason}`,
        details: `教练${leave.coachName}于${leaveDate}请假，课程可能受影响`
      });
      waiter.updatedAt = moment().format();
    });
  });

  createAuditLog('coachLeave', leave.id, 'create', operator || '管理员', null, leave, reason);
  saveData();

  res.json({ success: true, data: leave, affectedSchedules: affectedSchedules.length });
});

app.get('/api/consumption-balance', (req, res) => {
  res.json({ success: true, data: db.consumptionBalance });
});

app.post('/api/consumption-balance/:id/adjust', (req, res) => {
  const { id } = req.params;
  const { operator, reason, adjustment, note } = req.body;

  const balance = db.consumptionBalance.find(b => b.id === id);
  if (!balance) {
    return res.status(404).json({ success: false, message: '余额记录不存在' });
  }

  const beforeState = JSON.parse(JSON.stringify(balance));

  balance.usedCount -= adjustment;
  balance.remainingCount += adjustment;
  balance.updatedAt = moment().format();

  createAuditLog('consumptionBalance', id, 'adjust', operator || '管理员', beforeState, balance, reason || '人工调整');
  saveData();

  res.json({ success: true, data: balance });
});

app.get('/api/audit-logs', (req, res) => {
  res.json({ success: true, data: db.auditLogs });
});

app.get('/api/export/transfer-history', (req, res) => {
  const { handledBy, startDate, endDate, format = 'json' } = req.query;
  let data = [...db.transferHistory];
  
  if (handledBy) data = data.filter(t => t.handledBy === handledBy);
  if (startDate) data = data.filter(t => t.createdAt >= startDate);
  if (endDate) data = data.filter(t => t.createdAt <= endDate + 'T23:59:59');

  if (format === 'csv') {
    const headers = 'ID,类型,会员ID,会员姓名,原课程,新课程,状态,处理人,创建时间\n';
    const rows = data.map(t => 
      `${t.id},${t.type},${t.memberId},${t.memberName},${t.fromCourseName || '-'},${t.toCourseName},${t.status},${t.handledBy},${t.createdAt}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=transfer-history.csv');
    res.send('\ufeff' + headers + rows);
  } else {
    res.json({ success: true, data, exportTime: moment().format() });
  }
});

app.post('/api/batch-import', (req, res) => {
  const { entityType, data, operator } = req.body;
  const results = { success: 0, failed: 0, errors: [] };

  if (entityType === 'memberPackages') {
    data.forEach((item, idx) => {
      try {
        const pkg = {
          id: `pkg_${uuidv4().slice(0, 8)}`,
          ...item,
          status: 'active',
          createdAt: moment().format(),
          updatedAt: moment().format()
        };
        db.memberPackages.push(pkg);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`第${idx + 1}行: ${e.message}`);
      }
    });
  } else if (entityType === 'courseSchedules') {
    data.forEach((item, idx) => {
      try {
        const schedule = {
          id: `sched_${uuidv4().slice(0, 8)}`,
          ...item,
          enrolledCount: 0,
          status: 'scheduled',
          createdAt: moment().format(),
          updatedAt: moment().format()
        };
        db.courseSchedules.push(schedule);
        results.success++;
      } catch (e) {
        results.failed++;
        results.errors.push(`第${idx + 1}行: ${e.message}`);
      }
    });
  }

  createAuditLog(entityType, 'batch', 'import', operator || '管理员', null, { imported: results.success }, '批量导入');
  saveData();

  res.json({ success: true, results });
});

app.get('/api/waitlist/:id/timeline', (req, res) => {
  const { id } = req.params;
  const waitItem = db.waitlistQueue.find(w => w.id === id);
  
  if (!waitItem) {
    return res.status(404).json({ success: false, message: '候补记录不存在' });
  }

  const auditLogs = db.auditLogs.filter(
    log => log.entityType === 'waitlist' && log.entityId === id
  );

  const fullTimeline = [
    ...waitItem.timeline,
    ...auditLogs.map(log => ({
      time: log.createdAt,
      action: log.action,
      operator: log.operator,
      reason: log.reason,
      details: log.after ? JSON.stringify(log.after) : '',
      hasDiff: true,
      before: log.before,
      after: log.after
    }))
  ].sort((a, b) => new Date(a.time) - new Date(b.time));

  res.json({ 
    success: true, 
    data: {
      waitItem,
      timeline: fullTimeline
    }
  });
});

app.delete('/api/reset', (req, res) => {
  initSampleData();
  res.json({ success: true, message: '数据已重置' });
});

loadData();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
