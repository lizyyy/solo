'use strict';

const utils = require('./utils');

function getNextMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const nextMonth = month >= 12 ? 1 : month + 1;
  const nextYear = month >= 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function getMonthDates(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const dates = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function generateSampleData(targetMonth = null) {
  const month = targetMonth || getNextMonth();
  const dates = getMonthDates(month);
  
  const skills = [
    { id: 'skill-presales', name: '售前咨询', description: '产品咨询、购买引导', priority: 1, requiresMinCoverage: true },
    { id: 'skill-postsales', name: '售后支持', description: '订单处理、退换货', priority: 1, requiresMinCoverage: true },
    { id: 'skill-complaint', name: '投诉处理', description: '投诉跟进、纠纷调解', priority: 2, requiresMinCoverage: true }
  ];
  
  const agents = [
    { id: 'agent-zhang', name: '张三', skills: ['skill-presales', 'skill-postsales'], status: 'active' },
    { id: 'agent-li', name: '李四', skills: ['skill-presales'], status: 'active' },
    { id: 'agent-wang', name: '王五', skills: ['skill-postsales', 'skill-complaint'], status: 'active' },
    { id: 'agent-zhao', name: '赵六', skills: ['skill-complaint'], status: 'active' },
    { id: 'agent-chen', name: '陈七', skills: ['skill-presales', 'skill-postsales', 'skill-complaint'], status: 'active' },
    { id: 'agent-liu', name: '刘八', skills: ['skill-postsales'], status: 'active' }
  ];
  
  const [year, monthNum] = month.split('-').map(Number);
  const holidays = [];
  
  if (monthNum === 1) {
    holidays.push({ id: 'holiday-ny', date: `${month}-01`, name: '元旦', type: 'public', requiresCoverage: true });
  } else if (monthNum === 5) {
    holidays.push({ id: 'holiday-labor', date: `${month}-01`, name: '劳动节', type: 'public', requiresCoverage: true });
  } else if (monthNum === 10) {
    holidays.push({ id: 'holiday-national', date: `${month}-01`, name: '国庆节', type: 'public', requiresCoverage: true });
  }
  
  const midMonth = Math.floor(dates.length / 2);
  const leaves = [
    {
      id: 'leave-zhang',
      agentId: 'agent-zhang',
      startDate: dates[midMonth],
      endDate: dates[midMonth + 2],
      type: 'annual',
      reason: '年假',
      status: 'approved'
    },
    {
      id: 'leave-liu',
      agentId: 'agent-liu',
      startDate: dates[Math.min(dates.length - 3, midMonth + 5)],
      endDate: dates[Math.min(dates.length - 1, midMonth + 7)],
      type: 'sick',
      reason: '病假',
      status: 'approved'
    }
  ];
  
  const schedules = [];
  let scheduleIndex = 0;
  
  const shiftRotation = ['morning', 'afternoon', 'night'];
  
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    
    const shiftType1 = shiftRotation[i % 3];
    const shiftType2 = shiftRotation[(i + 1) % 3];
    const shiftType3 = shiftRotation[(i + 2) % 3];
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-zhang',
      date,
      shiftType: shiftType1,
      source: 'sample'
    });
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-li',
      date,
      shiftType: shiftType1,
      source: 'sample'
    });
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-wang',
      date,
      shiftType: shiftType2,
      source: 'sample'
    });
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-chen',
      date,
      shiftType: shiftType2,
      source: 'sample'
    });
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-zhao',
      date,
      shiftType: shiftType3,
      source: 'sample'
    });
    
    schedules.push({
      id: `sched-${scheduleIndex++}`,
      agentId: 'agent-liu',
      date,
      shiftType: shiftType3,
      source: 'sample'
    });
  }
  
  const locks = [
    {
      id: 'lock-chen-holiday',
      agentId: 'agent-chen',
      date: dates[14],
      shiftType: 'afternoon',
      reason: '主管指定值班',
      operator: 'sample'
    }
  ];
  
  return {
    targetMonth: month,
    skills,
    agents,
    holidays,
    leaves,
    schedules,
    locks
  };
}

function generateBadSampleData(targetMonth = null) {
  const good = generateSampleData(targetMonth);
  
  const bad = JSON.parse(JSON.stringify(good));
  
  const leaveDates = utils.datesInRange(good.leaves[0].startDate, good.leaves[0].endDate);
  for (const date of leaveDates) {
    const schedulesOnDate = bad.schedules.filter(s => 
      s.agentId === 'agent-zhang' && s.date === date
    );
    for (const s of schedulesOnDate) {
      s.source = 'bad-sample';
    }
  }
  
  bad.schedules = bad.schedules.filter(s => {
    if (s.agentId === 'agent-zhao' && s.date === good.dates?.[15]) {
      return false;
    }
    if (s.agentId === 'agent-wang' && s.date === good.dates?.[15] && s.shiftType === 'afternoon') {
      return false;
    }
    return true;
  });
  
  const firstDates = (good.dates || []).slice(0, 3);
  for (const date of firstDates) {
    const existing = bad.schedules.find(s => s.agentId === 'agent-li' && s.date === date);
    if (existing) {
      existing.shiftType = 'night';
    }
  }
  
  return bad;
}

module.exports = {
  getNextMonth,
  getMonthDates,
  generateSampleData,
  generateBadSampleData
};
