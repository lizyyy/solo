const fs = require('fs');
const path = require('path');
const { initSchema } = require('./schema');
const { generateCode, now, uuid, addStatusHistory } = require('./utils');
const { initDb, saveDb, exec, prepare } = require('./database');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'sales.db');

const runSeed = async () => {
  if (fs.existsSync(dbPath)) {
    console.log('移除旧数据库...');
    fs.unlinkSync(dbPath);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  
  await initDb();
  initSchema();
  console.log('数据库初始化完成');

  const projectId = uuid();
  prepare(`
    INSERT INTO projects (id, project_code, project_name, city, developer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run([projectId, 'PRJ-001', '锦绣花园', '北京市', '锦绣地产开发有限公司', now(), now()]);

  const properties = [
    { code: 'PROP-A101', building: '1号楼', unit: '1单元', room: '101', floor: 1, area: 95.5, price: 3500000 },
    { code: 'PROP-A102', building: '1号楼', unit: '1单元', room: '102', floor: 1, area: 89.3, price: 3200000 },
    { code: 'PROP-A201', building: '1号楼', unit: '1单元', room: '201', floor: 2, area: 95.5, price: 3600000 },
    { code: 'PROP-A301', building: '1号楼', unit: '1单元', room: '301', floor: 3, area: 120.8, price: 4500000 },
    { code: 'PROP-B101', building: '2号楼', unit: '2单元', room: '101', floor: 1, area: 110.2, price: 4000000 },
    { code: 'PROP-B201', building: '2号楼', unit: '2单元', room: '201', floor: 2, area: 110.2, price: 4100000 },
  ];

  const propertyIds = {};
  properties.forEach(p => {
    const id = uuid();
    propertyIds[p.code] = id;
    prepare(`
      INSERT INTO properties (id, project_id, property_code, building_no, unit_no, room_no, floor, area, total_price, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([id, projectId, p.code, p.building, p.unit, p.room, p.floor, p.area, p.price, 'available', now(), now()]);
    addStatusHistory('property', id, null, 'available', '创建房源', 'system');
  });

  console.log('已创建房源:', properties.length, '套');

  const channelId1 = uuid();
  prepare(`
    INSERT INTO channels (id, channel_code, channel_name, contact_person, phone, commission_rate, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([channelId1, 'CHN-001', '链家房产', '张经理', '13800138001', 0.025, now(), now()]);

  const channelId2 = uuid();
  prepare(`
    INSERT INTO channels (id, channel_code, channel_name, contact_person, phone, commission_rate, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([channelId2, 'CHN-002', '我爱我家', '李经理', '13800138002', 0.03, now(), now()]);

  console.log('已创建渠道: 2个');

  const customers = [
    { code: 'CUS-001', name: '王小明', phone: '13900139001', idCard: '110101199001011234', channelId: channelId1 },
    { code: 'CUS-002', name: '李小红', phone: '13900139002', idCard: '110101199002011235', channelId: channelId1 },
    { code: 'CUS-003', name: '王大明', phone: '13900139003', idCard: '110101198503011236', channelId: channelId2 },
    { code: 'CUS-004', name: '张伟', phone: '13900139004', idCard: '110101198804011237', channelId: channelId2 },
  ];

  const customerIds = {};
  customers.forEach(c => {
    const id = uuid();
    customerIds[c.code] = id;
    prepare(`
      INSERT INTO customers (id, customer_code, name, phone, id_card_no, channel_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run([id, c.code, c.name, c.phone, c.idCard, c.channelId, now(), now()]);
    addStatusHistory('customer', id, null, 'active', '创建客户', 'system');
  });

  console.log('已创建客户:', customers.length, '个');
  console.log('');
  console.log('演示数据创建完成!');
  console.log('');
  console.log('项目: 锦绣花园 (PRJ-001)');
  console.log('房源:');
  properties.forEach(p => {
    console.log(`  ${p.code}: ${p.building}${p.unit}${p.room}, ${p.area}㎡, ¥${p.price.toLocaleString()}`);
  });
  console.log('');
  console.log('渠道:');
  console.log('  CHN-001: 链家房产 (佣金率 2.5%)');
  console.log('  CHN-002: 我爱我家 (佣金率 3%)');
  console.log('');
  console.log('客户:');
  customers.forEach(c => {
    console.log(`  ${c.code}: ${c.name} (${c.phone})`);
  });
  console.log('');
};

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
