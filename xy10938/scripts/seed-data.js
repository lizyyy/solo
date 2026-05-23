const { runQuery, getOne } = require('../src/db');
const moment = require('moment');

console.log('开始插入示例数据...\n');

const members = [
  { name: '张三', phone: '13800138001', level: 'VIP会员', balance: 500 },
  { name: '李四', phone: '13800138002', level: '普通会员', balance: 100 },
  { name: '王五', phone: '13800138003', level: 'VIP会员', balance: 300 },
  { name: '赵六', phone: '13800138004', level: '普通会员', balance: 50 },
  { name: '孙七', phone: '13800138005', level: '高级会员', balance: 1000 }
];

members.forEach(m => {
  try {
    runQuery(
      `INSERT INTO members (member_no, name, phone, level, balance) VALUES (?, ?, ?, ?, ?)`,
      [`M${String(members.indexOf(m) + 1).padStart(6, '0')}`, m.name, m.phone, m.level, m.balance]
    );
    console.log(`✅ 会员: ${m.name}`);
  } catch (e) {
    console.log(`⚠️  会员 ${m.name} 已存在`);
  }
});

const stations = [
  { name: '1号工位' },
  { name: '2号工位' },
  { name: '3号工位' },
  { name: '4号工位' }
];

stations.forEach(s => {
  try {
    runQuery(
      `INSERT INTO stations (station_no, name, status) VALUES (?, ?, '空闲')`,
      [`S${String(stations.indexOf(s) + 1).padStart(3, '0')}`, s.name]
    );
    console.log(`✅ 工位: ${s.name}`);
  } catch (e) {
    console.log(`⚠️  工位 ${s.name} 已存在`);
  }
});

const today = moment().format('YYYY-MM-DD');
const serviceTypes = ['标准洗', '精洗', '打蜡', '内饰清洁'];

for (let i = 1; i <= 8; i++) {
  const memberId = (i % 5) + 1;
  const serviceType = serviceTypes[i % serviceTypes.length];
  const status = i <= 2 ? '已完成' : i <= 4 ? '服务中' : i <= 6 ? '等待中' : '已过号';
  const queueNo = `Q${today.replace(/-/g, '')}${String(i).padStart(3, '0')}`;
  
  try {
    runQuery(
      `INSERT INTO queue_numbers (queue_no, member_id, service_type, position, status) VALUES (?, ?, ?, ?, ?)`,
      [queueNo, memberId, serviceType, i, status]
    );
    console.log(`✅ 排队号: ${queueNo}`);
  } catch (e) {
    console.log(`⚠️  排队号 ${queueNo} 已存在`);
  }
}

console.log('\n✅ 示例数据插入完成！');
console.log('\n数据概览:');
console.log('- 会员: 5人');
console.log('- 工位: 4个');
console.log('- 排队记录: 8条');
