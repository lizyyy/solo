const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');
const { now } = require('../src/utils/date');

function seedData() {
  console.log('开始初始化基础数据...');

  const members = [
    { id: uuidv4(), member_no: 'M001', name: '张三', phone: '13800138001', id_card: '110101199001011234', data_expiry_date: '2025-12-31' },
    { id: uuidv4(), member_no: 'M002', name: '李四', phone: '13800138002', id_card: '110101199002022345', data_expiry_date: '2024-01-01' },
    { id: uuidv4(), member_no: 'M003', name: '王五', phone: '13800138003', id_card: '110101199003033456', data_expiry_date: '2025-06-30' }
  ];

  const diseases = [
    { id: uuidv4(), code: 'HTN', name: '高血压', description: '原发性高血压' },
    { id: uuidv4(), code: 'DM', name: '糖尿病', description: '2型糖尿病' },
    { id: uuidv4(), code: 'CHD', name: '冠心病', description: '冠状动脉粥样硬化性心脏病' }
  ];

  const benefitPackages = [
    { id: uuidv4(), code: 'PKG_A', name: '慢病管理基础包', description: '基础权益包，含复诊提醒', validity_days: 365 },
    { id: uuidv4(), code: 'PKG_B', name: '慢病管理尊享包', description: '尊享权益包，含健康咨询+复诊提醒', validity_days: 365 },
    { id: uuidv4(), code: 'PKG_C', name: '慢病管理VIP包', description: 'VIP权益包，含一对一健康管理', validity_days: 730 }
  ];

  db.serialize(() => {
    const memberStmt = db.prepare(`INSERT OR IGNORE INTO members (id, member_no, name, phone, id_card, data_expiry_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    members.forEach(m => {
      memberStmt.run(m.id, m.member_no, m.name, m.phone, m.id_card, m.data_expiry_date, now(), now());
    });
    memberStmt.finalize();
    console.log(`已初始化 ${members.length} 个会员数据`);

    const diseaseStmt = db.prepare(`INSERT OR IGNORE INTO diseases (id, code, name, description, created_at) VALUES (?, ?, ?, ?, ?)`);
    diseases.forEach(d => {
      diseaseStmt.run(d.id, d.code, d.name, d.description, now());
    });
    diseaseStmt.finalize();
    console.log(`已初始化 ${diseases.length} 个病种数据`);

    const pkgStmt = db.prepare(`INSERT OR IGNORE INTO benefit_packages (id, code, name, description, validity_days, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
    benefitPackages.forEach(p => {
      pkgStmt.run(p.id, p.code, p.name, p.description, p.validity_days, now());
    });
    pkgStmt.finalize();
    console.log(`已初始化 ${benefitPackages.length} 个权益包数据`);

    console.log('基础数据初始化完成！');
    console.log('');
    console.log('会员信息:');
    members.forEach(m => {
      console.log(`  ${m.member_no} - ${m.name} (资料到期: ${m.data_expiry_date})`);
    });
    console.log('');
    console.log('病种信息:');
    diseases.forEach(d => {
      console.log(`  ${d.code} - ${d.name}`);
    });
    console.log('');
    console.log('权益包信息:');
    benefitPackages.forEach(p => {
      console.log(`  ${p.code} - ${p.name} (有效期: ${p.validity_days}天)`);
    });
  });
}

seedData();