const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let volunteers = [];
let positions = [];
let schedules = [];
let exceptions = [];
let idCounter = {
  volunteer: 1,
  position: 1,
  schedule: 1
};

const initializeData = () => {
  volunteers = [
    { id: idCounter.volunteer++, name: '张三', phone: '13800138001', qualifications: ['入口检票', '舞台协助'], status: 'active' },
    { id: idCounter.volunteer++, name: '李四', phone: '13800138002', qualifications: ['入口检票', '补给点服务'], status: 'active' },
    { id: idCounter.volunteer++, name: '王五', phone: '13800138003', qualifications: ['舞台协助'], status: 'active' },
    { id: idCounter.volunteer++, name: '赵六', phone: '13800138004', qualifications: ['入口检票', '舞台协助', '补给点服务'], status: 'active' },
    { id: idCounter.volunteer++, name: '钱七', phone: '13800138005', qualifications: ['补给点服务'], status: 'active' }
  ];

  positions = [
    { id: idCounter.position++, name: '主入口A', area: '入口', requiredQualification: '入口检票', maxVolunteers: 2, status: 'active' },
    { id: idCounter.position++, name: '主入口B', area: '入口', requiredQualification: '入口检票', maxVolunteers: 2, status: 'active' },
    { id: idCounter.position++, name: '主舞台', area: '舞台', requiredQualification: '舞台协助', maxVolunteers: 3, status: 'active' },
    { id: idCounter.position++, name: '电子舞台', area: '舞台', requiredQualification: '舞台协助', maxVolunteers: 2, status: 'active' },
    { id: idCounter.position++, name: '补给点1', area: '补给点', requiredQualification: '补给点服务', maxVolunteers: 2, status: 'active' },
    { id: idCounter.position++, name: '补给点2', area: '补给点', requiredQualification: '补给点服务', maxVolunteers: 2, status: 'active' }
  ];

  schedules = [
    { id: idCounter.schedule++, volunteerId: 1, positionId: 1, date: '2026-05-15', startTime: '09:00', endTime: '12:00', status: 'confirmed' },
    { id: idCounter.schedule++, volunteerId: 1, positionId: 1, date: '2026-05-15', startTime: '13:00', endTime: '16:00', status: 'pending' },
    { id: idCounter.schedule++, volunteerId: 2, positionId: 5, date: '2026-05-15', startTime: '09:00', endTime: '12:00', status: 'confirmed' },
    { id: idCounter.schedule++, volunteerId: 3, positionId: 3, date: '2026-05-15', startTime: '09:00', endTime: '12:00', status: 'confirmed' },
    { id: idCounter.schedule++, volunteerId: 4, positionId: 2, date: '2026-05-15', startTime: '09:00', endTime: '12:00', status: 'pending' }
  ];

  exceptions = [
    { type: 'duplicate', data: { volunteerId: 1, positionId: 1, date: '2026-05-15', startTime: '09:00', endTime: '12:00' }, message: '该志愿者在同一时间已有排班' },
    { type: 'missing_fields', data: { volunteerId: 5, positionId: 6, date: '2026-05-15', startTime: '', endTime: '' }, message: '缺少开始时间和结束时间' },
    { type: 'manual_error', data: { volunteerId: 3, positionId: 5, date: '2026-05-15', startTime: '14:00', endTime: '17:00' }, message: '人工错误：该志愿者没有补给点服务资格' }
  ];
};

const getPosition = (positionId) => positions.find(p => p.id === positionId);
const getVolunteer = (volunteerId) => volunteers.find(v => v.id === volunteerId);

const checkQualification = (volunteer, position) => {
  return volunteer.qualifications.includes(position.requiredQualification);
};

const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const checkScheduleConflict = (volunteerId, date, startTime, endTime, excludeScheduleId = null) => {
  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  return schedules.some(schedule => {
    if (schedule.id === excludeScheduleId) return false;
    if (schedule.volunteerId !== volunteerId || schedule.date !== date) return false;
    if (schedule.status === 'rejected') return false;

    const sStart = parseTime(schedule.startTime);
    const sEnd = parseTime(schedule.endTime);

    return (startMinutes < sEnd && endMinutes > sStart);
  });
};

const checkRestConstraint = (volunteerId, date) => {
  const volunteerSchedules = schedules.filter(
    s => s.volunteerId === volunteerId && s.date === date && s.status !== 'rejected'
  );

  if (volunteerSchedules.length === 0) return { hasEnoughRest: true };

  volunteerSchedules.sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  for (let i = 0; i < volunteerSchedules.length - 1; i++) {
    const currentEnd = parseTime(volunteerSchedules[i].endTime);
    const nextStart = parseTime(volunteerSchedules[i + 1].startTime);
    const restTime = nextStart - currentEnd;

    if (restTime < 60) {
      return {
        hasEnoughRest: false,
        reason: `两个排班之间休息时间不足60分钟（当前：${restTime}分钟）`
      };
    }
  }

  let totalWorkingHours = 0;
  volunteerSchedules.forEach(s => {
    totalWorkingHours += parseTime(s.endTime) - parseTime(s.startTime);
  });
  totalWorkingHours = totalWorkingHours / 60;

  if (totalWorkingHours > 8) {
    return {
      hasEnoughRest: false,
      reason: `当日工作时长超过8小时（当前：${totalWorkingHours.toFixed(1)}小时）`
    };
  }

  return { hasEnoughRest: true };
};

const checkPositionCapacity = (positionId, date, startTime, endTime, excludeScheduleId = null) => {
  const position = getPosition(positionId);
  if (!position) return { hasCapacity: false, reason: '岗位不存在' };

  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  const overlappingSchedules = schedules.filter(schedule => {
    if (schedule.id === excludeScheduleId) return false;
    if (schedule.positionId !== positionId || schedule.date !== date) return false;
    if (schedule.status === 'rejected') return false;

    const sStart = parseTime(schedule.startTime);
    const sEnd = parseTime(schedule.endTime);

    return (startMinutes < sEnd && endMinutes > sStart);
  });

  return {
    hasCapacity: overlappingSchedules.length < position.maxVolunteers,
    currentCount: overlappingSchedules.length,
    maxCount: position.maxVolunteers
  };
};

const validateSchedule = (schedule, excludeScheduleId = null) => {
  const errors = [];
  const warnings = [];

  if (!schedule.volunteerId) errors.push('请选择志愿者');
  if (!schedule.positionId) errors.push('请选择岗位');
  if (!schedule.date) errors.push('请选择日期');
  if (!schedule.startTime) errors.push('请选择开始时间');
  if (!schedule.endTime) errors.push('请选择结束时间');

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const volunteer = getVolunteer(schedule.volunteerId);
  const position = getPosition(schedule.positionId);

  if (!volunteer) {
    errors.push('志愿者不存在');
  } else if (!position) {
    errors.push('岗位不存在');
  } else {
    if (!checkQualification(volunteer, position)) {
      errors.push(`志愿者"${volunteer.name}"没有"${position.requiredQualification}"岗位资格`);
    }

    if (parseTime(schedule.startTime) >= parseTime(schedule.endTime)) {
      errors.push('结束时间必须晚于开始时间');
    }

    if (checkScheduleConflict(schedule.volunteerId, schedule.date, schedule.startTime, schedule.endTime, excludeScheduleId)) {
      errors.push('该志愿者在同一时间段已有排班冲突');
    }

    const capacityCheck = checkPositionCapacity(schedule.positionId, schedule.date, schedule.startTime, schedule.endTime, excludeScheduleId);
    if (!capacityCheck.hasCapacity) {
      errors.push(`该岗位在该时间段已满员（${capacityCheck.currentCount}/${capacityCheck.maxCount}）`);
    }

    const restCheck = checkRestConstraint(schedule.volunteerId, schedule.date);
    if (!restCheck.hasEnoughRest) {
      warnings.push(`休息约束警告：${restCheck.reason}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

app.get('/api/volunteers', (req, res) => {
  res.json(volunteers);
});

app.post('/api/volunteers', (req, res) => {
  const { name, phone, qualifications } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: '姓名和电话不能为空' });
  }

  const exists = volunteers.some(v => v.phone === phone);
  if (exists) {
    return res.status(400).json({ error: '该手机号已被注册' });
  }

  const newVolunteer = {
    id: idCounter.volunteer++,
    name,
    phone,
    qualifications: qualifications || [],
    status: 'active'
  };

  volunteers.push(newVolunteer);
  res.status(201).json(newVolunteer);
});

app.put('/api/volunteers/:id', (req, res) => {
  const { id } = req.params;
  const index = volunteers.findIndex(v => v.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '志愿者不存在' });
  }

  volunteers[index] = { ...volunteers[index], ...req.body };
  res.json(volunteers[index]);
});

app.delete('/api/volunteers/:id', (req, res) => {
  const { id } = req.params;
  const index = volunteers.findIndex(v => v.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '志愿者不存在' });
  }

  volunteers.splice(index, 1);
  res.json({ message: '删除成功' });
});

app.get('/api/positions', (req, res) => {
  res.json(positions);
});

app.post('/api/positions', (req, res) => {
  const { name, area, requiredQualification, maxVolunteers } = req.body;
  
  if (!name || !area || !requiredQualification) {
    return res.status(400).json({ error: '岗位名称、区域和所需资格不能为空' });
  }

  const newPosition = {
    id: idCounter.position++,
    name,
    area,
    requiredQualification,
    maxVolunteers: maxVolunteers || 1,
    status: 'active'
  };

  positions.push(newPosition);
  res.status(201).json(newPosition);
});

app.put('/api/positions/:id', (req, res) => {
  const { id } = req.params;
  const index = positions.findIndex(p => p.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '岗位不存在' });
  }

  positions[index] = { ...positions[index], ...req.body };
  res.json(positions[index]);
});

app.delete('/api/positions/:id', (req, res) => {
  const { id } = req.params;
  const index = positions.findIndex(p => p.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '岗位不存在' });
  }

  positions.splice(index, 1);
  res.json({ message: '删除成功' });
});

app.get('/api/schedules', (req, res) => {
  const enrichedSchedules = schedules.map(schedule => ({
    ...schedule,
    volunteer: getVolunteer(schedule.volunteerId),
    position: getPosition(schedule.positionId)
  }));
  res.json(enrichedSchedules);
});

app.post('/api/schedules/validate', (req, res) => {
  const result = validateSchedule(req.body);
  res.json(result);
});

app.post('/api/schedules', (req, res) => {
  const validation = validateSchedule(req.body);
  
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors, warnings: validation.warnings });
  }

  const newSchedule = {
    id: idCounter.schedule++,
    volunteerId: req.body.volunteerId,
    positionId: req.body.positionId,
    date: req.body.date,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    status: req.body.status || 'pending'
  };

  schedules.push(newSchedule);
  
  const enriched = {
    ...newSchedule,
    volunteer: getVolunteer(newSchedule.volunteerId),
    position: getPosition(newSchedule.positionId)
  };

  res.status(201).json({ schedule: enriched, warnings: validation.warnings });
});

app.put('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const index = schedules.findIndex(s => s.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '排班不存在' });
  }

  const updatedSchedule = { ...schedules[index], ...req.body };
  const validation = validateSchedule(updatedSchedule, parseInt(id));
  
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors, warnings: validation.warnings });
  }

  schedules[index] = updatedSchedule;
  
  const enriched = {
    ...updatedSchedule,
    volunteer: getVolunteer(updatedSchedule.volunteerId),
    position: getPosition(updatedSchedule.positionId)
  };

  res.json({ schedule: enriched, warnings: validation.warnings });
});

app.post('/api/schedules/:id/confirm', (req, res) => {
  const { id } = req.params;
  const index = schedules.findIndex(s => s.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '排班不存在' });
  }

  schedules[index].status = 'confirmed';
  
  const enriched = {
    ...schedules[index],
    volunteer: getVolunteer(schedules[index].volunteerId),
    position: getPosition(schedules[index].positionId)
  };

  res.json(enriched);
});

app.post('/api/schedules/:id/reject', (req, res) => {
  const { id } = req.params;
  const index = schedules.findIndex(s => s.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '排班不存在' });
  }

  schedules[index].status = 'rejected';
  
  const enriched = {
    ...schedules[index],
    volunteer: getVolunteer(schedules[index].volunteerId),
    position: getPosition(schedules[index].positionId)
  };

  res.json(enriched);
});

app.delete('/api/schedules/:id', (req, res) => {
  const { id } = req.params;
  const index = schedules.findIndex(s => s.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '排班不存在' });
  }

  schedules.splice(index, 1);
  res.json({ message: '删除成功' });
});

app.get('/api/schedules/export', (req, res) => {
  const enrichedSchedules = schedules.map(schedule => ({
    排班ID: schedule.id,
    志愿者: getVolunteer(schedule.volunteerId)?.name || '',
    志愿者电话: getVolunteer(schedule.volunteerId)?.phone || '',
    岗位: getPosition(schedule.positionId)?.name || '',
    区域: getPosition(schedule.positionId)?.area || '',
    日期: schedule.date,
    开始时间: schedule.startTime,
    结束时间: schedule.endTime,
    状态: schedule.status === 'confirmed' ? '已确认' : schedule.status === 'rejected' ? '已拒绝' : '待确认'
  }));

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=volunteer_schedules.json');
  res.json(enrichedSchedules);
});

app.get('/api/exceptions', (req, res) => {
  res.json(exceptions);
});

app.post('/api/exceptions/test', (req, res) => {
  const { type } = req.body;
  let testData;

  switch (type) {
    case 'duplicate':
      testData = {
        volunteerId: 1,
        positionId: 1,
        date: '2026-05-15',
        startTime: '09:00',
        endTime: '12:00'
      };
      break;
    case 'missing_fields':
      testData = {
        volunteerId: 5,
        positionId: 6,
        date: '2026-05-15',
        startTime: '',
        endTime: ''
      };
      break;
    case 'manual_error':
      testData = {
        volunteerId: 3,
        positionId: 5,
        date: '2026-05-15',
        startTime: '14:00',
        endTime: '17:00'
      };
      break;
    default:
      return res.status(400).json({ error: '未知的异常类型' });
  }

  const validation = validateSchedule(testData);
  res.json({ testData, validation });
});

app.get('/api/qualifications', (req, res) => {
  const allQuals = new Set();
  volunteers.forEach(v => v.qualifications.forEach(q => allQuals.add(q)));
  positions.forEach(p => allQuals.add(p.requiredQualification));
  res.json(Array.from(allQuals));
});

app.get('/api/dashboard', (req, res) => {
  const confirmed = schedules.filter(s => s.status === 'confirmed').length;
  const pending = schedules.filter(s => s.status === 'pending').length;
  const rejected = schedules.filter(s => s.status === 'rejected').length;

  const byArea = {};
  positions.forEach(p => {
    if (!byArea[p.area]) byArea[p.area] = { positions: 0, schedules: 0 };
    byArea[p.area].positions++;
  });
  schedules.forEach(s => {
    const pos = getPosition(s.positionId);
    if (pos && s.status !== 'rejected') {
      if (!byArea[pos.area]) byArea[pos.area] = { positions: 0, schedules: 0 };
      byArea[pos.area].schedules++;
    }
  });

  res.json({
    totalVolunteers: volunteers.length,
    totalPositions: positions.length,
    totalSchedules: schedules.length,
    scheduleStatus: { confirmed, pending, rejected },
    byArea
  });
});

app.post('/api/reset', (req, res) => {
  idCounter = { volunteer: 1, position: 1, schedule: 1 };
  initializeData();
  res.json({ message: '数据已重置为初始状态' });
});

initializeData();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`音乐节志愿者岗位轮换台已启动: http://localhost:${PORT}`);
});
