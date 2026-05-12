const service = require('./services/pointsService');
const { v4: uuidv4 } = require('uuid');

function loadDemoData() {
  const today = new Date();
  
  const formatDate = (daysOffset) => {
    const d = new Date(today.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const member1Id = 'DEMO001';
  const member2Id = 'DEMO002';

  service.createMember(member1Id, '张三', '13800138001', '黄金会员');
  service.createMember(member2Id, '李四', '13800138002', '普通会员');

  service.issuePoints(
    member1Id,
    1000,
    '注册奖励',
    'REG_001',
    formatDate(-90),
    formatDate(-30),
    'demo_batch_1'
  );

  service.issuePoints(
    member1Id,
    500,
    '消费返利',
    'REBATE_001',
    formatDate(-60),
    formatDate(0),
    'demo_batch_2'
  );

  service.issuePoints(
    member1Id,
    2000,
    '生日礼遇',
    'BIRTHDAY_2024',
    formatDate(-30),
    formatDate(365),
    'demo_batch_3'
  );

  service.issuePoints(
    member1Id,
    800,
    '活动奖励',
    'PROMO_Q1',
    formatDate(-15),
    formatDate(15),
    'demo_batch_4'
  );

  service.issuePoints(
    member1Id,
    3000,
    '周年庆',
    'ANNIV_2024',
    formatDate(0),
    formatDate(180),
    'demo_batch_5'
  );

  service.issuePoints(
    member2Id,
    500,
    '注册奖励',
    'REG_002',
    formatDate(-45),
    formatDate(-15),
    'demo_batch_6'
  );

  service.issuePoints(
    member2Id,
    1500,
    '消费返利',
    'REBATE_002',
    formatDate(-30),
    formatDate(60),
    'demo_batch_7'
  );

  console.log('[Seed] 演示数据加载完成');
}

module.exports = { loadDemoData };
