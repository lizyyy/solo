const db = require('../utils/db-helper');
const { closeDB } = require('../config/database');

async function seedData() {
  console.log('开始导入示例数据...');

  await db.exec(`
    DELETE FROM allocation_history;
    DELETE FROM allocations;
    DELETE FROM animals;
    DELETE FROM cages;
    DELETE FROM isolation_rules;
    DELETE FROM strains;
  `);

  const strains = [
    { code: 'C57BL/6J', name: 'C57BL/6J 小黑鼠', description: '最常用的近交系小鼠，广泛用于遗传学和免疫学研究' },
    { code: 'BALB/c', name: 'BALB/c 小白鼠', description: '常用于单克隆抗体制备和免疫学研究' },
    { code: 'ICR', name: 'ICR 远交系小鼠', description: '繁殖力强，常用于毒理学和药理学实验' },
    { code: 'SD', name: 'SD 大鼠', description: 'Sprague-Dawley 大鼠，广泛用于营养学和毒理学研究' },
    { code: 'Wistar', name: 'Wistar 大鼠', description: '最古老的封闭群大鼠，用于生理学和药理学研究' }
  ];

  for (const s of strains) {
    await db.run(
      'INSERT INTO strains (code, name, description) VALUES (?, ?, ?)',
      [s.code, s.name, s.description]
    );
  }
  console.log(`已导入 ${strains.length} 个品系`);

  const isolationRules = [
    { code: 'SPF', name: '无特定病原体级', level: 'SPF', description: '无特定病原体动物，需严格隔离', can_coexist_with: 'SPF' },
    { code: 'CONV', name: '普通级', level: 'conventional', description: '普通饲养环境', can_coexist_with: 'SPF, CONV' },
    { code: 'QUAR', name: '检疫隔离', level: 'quarantine', description: '新到动物检疫期隔离', can_coexist_with: 'QUAR' },
    { code: 'GF', name: '无菌级', level: 'germ-free', description: '完全无菌环境', can_coexist_with: 'GF' },
    { code: 'IMMU', name: '免疫缺陷', level: 'immunodeficient', description: '免疫缺陷动物，需特殊隔离', can_coexist_with: 'IMMU, SPF' }
  ];

  for (const r of isolationRules) {
    await db.run(
      'INSERT INTO isolation_rules (code, name, level, description, can_coexist_with) VALUES (?, ?, ?, ?, ?)',
      [r.code, r.name, r.level, r.description, r.can_coexist_with]
    );
  }
  console.log(`已导入 ${isolationRules.length} 个隔离规则`);

  const c57Row = await db.get('SELECT id FROM strains WHERE code = ?', ['C57BL/6J']);
  const balbRow = await db.get('SELECT id FROM strains WHERE code = ?', ['BALB/c']);
  const icrRow = await db.get('SELECT id FROM strains WHERE code = ?', ['ICR']);
  const sdRow = await db.get('SELECT id FROM strains WHERE code = ?', ['SD']);
  const c57Id = c57Row.id;
  const balbId = balbRow.id;
  const icrId = icrRow.id;
  const sdId = sdRow.id;

  const spfRow = await db.get('SELECT id FROM isolation_rules WHERE code = ?', ['SPF']);
  const convRow = await db.get('SELECT id FROM isolation_rules WHERE code = ?', ['CONV']);
  const quarRow = await db.get('SELECT id FROM isolation_rules WHERE code = ?', ['QUAR']);
  const spfId = spfRow.id;
  const convId = convRow.id;
  const quarId = quarRow.id;

  const cages = [
    { code: 'A-01-01', room: 'A01', rack: 'R01', position: '1', max_capacity: 5, strain_id: c57Id, gender: 'male', isolation_rule_id: spfId },
    { code: 'A-01-02', room: 'A01', rack: 'R01', position: '2', max_capacity: 5, strain_id: c57Id, gender: 'male', isolation_rule_id: spfId },
    { code: 'A-01-03', room: 'A01', rack: 'R01', position: '3', max_capacity: 5, strain_id: c57Id, gender: 'female', isolation_rule_id: spfId },
    { code: 'A-01-04', room: 'A01', rack: 'R01', position: '4', max_capacity: 5, strain_id: c57Id, gender: 'female', isolation_rule_id: spfId },
    { code: 'A-01-05', room: 'A01', rack: 'R01', position: '5', max_capacity: 5, strain_id: null, gender: null, isolation_rule_id: spfId },
    { code: 'A-02-01', room: 'A02', rack: 'R01', position: '1', max_capacity: 5, strain_id: balbId, gender: 'male', isolation_rule_id: spfId },
    { code: 'A-02-02', room: 'A02', rack: 'R01', position: '2', max_capacity: 5, strain_id: balbId, gender: 'male', isolation_rule_id: spfId },
    { code: 'A-02-03', room: 'A02', rack: 'R01', position: '3', max_capacity: 5, strain_id: balbId, gender: 'female', isolation_rule_id: spfId },
    { code: 'A-02-04', room: 'A02', rack: 'R01', position: '4', max_capacity: 5, strain_id: null, gender: null, isolation_rule_id: spfId },
    { code: 'B-01-01', room: 'B01', rack: 'R01', position: '1', max_capacity: 3, strain_id: sdId, gender: 'male', isolation_rule_id: convId },
    { code: 'B-01-02', room: 'B01', rack: 'R01', position: '2', max_capacity: 3, strain_id: sdId, gender: 'female', isolation_rule_id: convId },
    { code: 'B-01-03', room: 'B01', rack: 'R01', position: '3', max_capacity: 3, strain_id: null, gender: null, isolation_rule_id: convId },
    { code: 'Q-01-01', room: 'Q01', rack: 'R01', position: '1', max_capacity: 5, strain_id: null, gender: null, isolation_rule_id: quarId, status: 'reserved' },
    { code: 'Q-01-02', room: 'Q01', rack: 'R01', position: '2', max_capacity: 5, strain_id: null, gender: null, isolation_rule_id: quarId, status: 'reserved' }
  ];

  for (const c of cages) {
    await db.run(
      'INSERT INTO cages (code, room, rack, position, max_capacity, strain_id, gender, isolation_rule_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [c.code, c.room, c.rack, c.position, c.max_capacity, c.strain_id, c.gender, c.isolation_rule_id, c.status || 'available']
    );
  }
  console.log(`已导入 ${cages.length} 个笼位`);

  const animals = [
    { animal_id: 'M001', strain_id: c57Id, gender: 'male', birth_date: '2025-01-15', weight: 25.5, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'M002', strain_id: c57Id, gender: 'male', birth_date: '2025-01-15', weight: 26.2, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'M003', strain_id: c57Id, gender: 'male', birth_date: '2025-01-15', weight: 24.8, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'F001', strain_id: c57Id, gender: 'female', birth_date: '2025-01-20', weight: 22.1, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'F002', strain_id: c57Id, gender: 'female', birth_date: '2025-01-20', weight: 21.9, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'M004', strain_id: balbId, gender: 'male', birth_date: '2025-02-01', weight: 28.5, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'M005', strain_id: balbId, gender: 'male', birth_date: '2025-02-01', weight: 29.1, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'F003', strain_id: balbId, gender: 'female', birth_date: '2025-02-05', weight: 24.5, isolation_rule_id: spfId, health_status: 'normal' },
    { animal_id: 'R001', strain_id: sdId, gender: 'male', birth_date: '2024-12-01', weight: 250.0, isolation_rule_id: convId, health_status: 'normal' },
    { animal_id: 'R002', strain_id: sdId, gender: 'female', birth_date: '2024-12-05', weight: 220.0, isolation_rule_id: convId, health_status: 'normal' },
    { animal_id: 'Q001', strain_id: icrId, gender: 'male', birth_date: '2025-03-01', weight: 23.0, isolation_rule_id: quarId, health_status: 'quarantine', notes: '新到动物，待检疫' }
  ];

  for (const a of animals) {
    await db.run(
      'INSERT INTO animals (animal_id, strain_id, gender, birth_date, weight, isolation_rule_id, health_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [a.animal_id, a.strain_id, a.gender, a.birth_date, a.weight, a.isolation_rule_id, a.health_status, a.notes]
    );
  }
  console.log(`已导入 ${animals.length} 只动物`);

  console.log('示例数据导入完成！');
  console.log('');
  console.log('数据概览:');
  console.log('  品系: 5 种 (C57BL/6J, BALB/c, ICR, SD, Wistar)');
  console.log('  隔离规则: 5 种 (SPF, CONV, QUAR, GF, IMMU)');
  console.log('  笼位: 14 个 (分布在 A01, A02, B01, Q01 房间)');
  console.log('  动物: 11 只 (小鼠 9 只 + 大鼠 2 只)');
  console.log('');
  console.log('业务场景说明:');
  console.log('  1. A01/A02 房间: SPF级小鼠饲养区');
  console.log('  2. B01 房间: 普通级大鼠饲养区');
  console.log('  3. Q01 房间: 检疫隔离区');
  console.log('  4. 部分笼位已绑定品系和性别，系统会自动匹配');
  console.log('  5. 可进行初始分配、转笼、释放等操作');
  console.log('');

  closeDB();
}

seedData().catch(err => {
  console.error('导入示例数据失败:', err);
  closeDB();
});
