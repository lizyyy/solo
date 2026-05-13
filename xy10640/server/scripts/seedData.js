const { run, get } = require('../database/db');

async function seedData() {
  console.log('开始生成演示数据...\n');

  const ayis = [
    { ayi_id: 'AYI-001', name: '张阿姨', phone: '13800138001', id_card: '110101198001010001', skills: '保洁,做饭,带孩子', experience_years: 5 },
    { ayi_id: 'AYI-002', name: '李阿姨', phone: '13800138002', id_card: '110101198502020002', skills: '保洁,照顾老人', experience_years: 3 },
    { ayi_id: 'AYI-003', name: '王阿姨', phone: '13800138003', id_card: '110101197803030003', skills: '做饭,月嫂', experience_years: 8 }
  ];

  for (const ayi of ayis) {
    await run(
      `INSERT OR IGNORE INTO ayi_profiles (ayi_id, name, phone, id_card, skills, experience_years) VALUES (?, ?, ?, ?, ?, ?)`,
      [ayi.ayi_id, ayi.name, ayi.phone, ayi.id_card, ayi.skills, ayi.experience_years]
    );
    console.log(`✓ 创建阿姨档案: ${ayi.name}`);
  }

  const requirements = [
    { req_id: 'REQ-001', customer_name: '赵先生', customer_phone: '13900139001', address: '北京市朝阳区某某小区1号楼101室', service_type: '住家保姆', requirements: '照顾老人，做三餐，简单家务', budget_min: 5000, budget_max: 7000 },
    { req_id: 'REQ-002', customer_name: '钱女士', customer_phone: '13900139002', address: '北京市海淀区某某小区2号楼202室', service_type: '育儿嫂', requirements: '照顾2岁宝宝，做辅食，简单家务', budget_min: 6000, budget_max: 8000 },
    { req_id: 'REQ-003', customer_name: '孙女士', customer_phone: '13900139003', address: '北京市西城区某某小区3号楼303室', service_type: '钟点工', requirements: '每天3小时，做晚饭，打扫卫生', budget_min: 3000, budget_max: 4000 }
  ];

  for (const req of requirements) {
    await run(
      `INSERT OR IGNORE INTO customer_requirements (req_id, customer_name, customer_phone, address, service_type, requirements, budget_min, budget_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.req_id, req.customer_name, req.customer_phone, req.address, req.service_type, req.requirements, req.budget_min, req.budget_max]
    );
    console.log(`✓ 创建客户需求: ${req.customer_name} - ${req.service_type}`);
  }

  console.log('\n✓ 基础数据创建完成');
}

seedData().then(() => {
  console.log('\n演示数据生成完毕！');
  process.exit(0);
}).catch(err => {
  console.error('生成数据失败:', err);
  process.exit(1);
});