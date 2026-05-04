const db = require('../config/database');
const moment = require('moment');

console.log('正在插入乡土植物种子库示例数据...');

db.serialize(() => {
  const volunteerStmt = db.prepare(`
    INSERT INTO volunteers (name, role, contact, status)
    VALUES (?, ?, ?, ?)
  `);
  
  const volunteers = [
    ['张采集', '采集志愿者', 'zhang@example.com', '活跃'],
    ['李鉴定', '种子鉴定员', 'li@example.com', '活跃'],
    ['王保管员', '库房管理员', 'wang@example.com', '活跃'],
    ['陈组长', '项目组长', 'chen@example.com', '活跃'],
    ['刘测试', '萌发测试员', 'liu@example.com', '活跃']
  ];
  
  volunteers.forEach(volunteer => {
    volunteerStmt.run(...volunteer);
  });
  volunteerStmt.finalize();
  
  console.log('✓ 已插入 5 条志愿者记录');

  const siteStmt = db.prepare(`
    INSERT INTO collection_sites (
      site_code, site_name, location, latitude, longitude,
      habitat, elevation, description, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const sites = [
    ['SITE-001', '北京松山自然保护区', '北京市延庆区', 40.55, 115.82, '山地森林', 800, '温带落叶阔叶林保护区，物种多样性丰富', '活跃'],
    ['SITE-002', '河北小五台山', '河北省张家口市', 39.95, 115.32, '高山草甸', 2000, '华北地区最高峰，高山植物丰富', '活跃'],
    ['SITE-003', '天津八仙山', '天津市蓟州区', 40.12, 117.53, '次生林', 500, '天津最高峰，次生林恢复良好', '活跃'],
    ['SITE-004', '废弃采集点', '已撤销区域', 0, 0, '未知', 0, '已停止使用的采集点', '已关闭']
  ];
  
  sites.forEach(site => {
    siteStmt.run(...site);
  });
  siteStmt.finalize();
  
  console.log('✓ 已插入 4 条采集地点记录');

  const speciesStmt = db.prepare(`
    INSERT INTO native_species (
      species_code, scientific_name, common_name, family,
      genus, species, native_status, conservation_status,
      seed_collection_season, moisture_threshold, germination_threshold, description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const species = [
    ['SP-001', 'Pinus tabuliformis', '油松', '松科', '松属', 'tabuliformis', '乡土种', '无危', '秋季', 8.0, 60.0, '中国北方主要造林树种，适应性强'],
    ['SP-002', 'Quercus mongolica', '蒙古栎', '壳斗科', '栎属', 'mongolica', '乡土种', '无危', '秋季', 7.5, 55.0, '温带落叶阔叶林建群种'],
    ['SP-003', 'Betula platyphylla', '白桦', '桦木科', '桦木属', 'platyphylla', '乡土种', '无危', '秋季', 7.0, 50.0, '先锋树种，喜光耐寒'],
    ['SP-004', 'Acer truncatum', '元宝枫', '槭树科', '槭属', 'truncatum', '乡土种', '无危', '秋季', 8.0, 45.0, '优良秋色叶树种，种子含油'],
    ['SP-005', 'Robinia pseudoacacia', '刺槐', '豆科', '刺槐属', 'pseudoacacia', '外来种', '入侵风险', '春季', 8.0, 70.0, '原产北美，已在中国归化，具有入侵性'],
    ['SP-006', 'Lonicera maackii', '金银忍冬', '忍冬科', '忍冬属', 'maackii', '乡土种', '无危', '秋季', 8.5, 40.0, '优良观果灌木，种子鸟类传播']
  ];
  
  species.forEach(spec => {
    speciesStmt.run(...spec);
  });
  speciesStmt.finalize();
  
  console.log('✓ 已插入 6 条物种记录（含1条外来种测试数据）');

  const cabinetStmt = db.prepare(`
    INSERT INTO cold_storages (
      cabinet_code, cabinet_name, location, total_slots,
      temperature, humidity, status, description
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const cabinets = [
    ['CS-001', '长期冷藏柜A', '种子库一楼A区', 50, -18.0, 30.0, '正常', '长期保存用，温度-18°C'],
    ['CS-002', '长期冷藏柜B', '种子库一楼A区', 50, -18.0, 30.0, '正常', '长期保存用，温度-18°C'],
    ['CS-003', '中期冷藏柜', '种子库一楼B区', 30, 4.0, 45.0, '正常', '中期保存用，温度4°C'],
    ['CS-004', '待维修冷藏柜', '种子库二楼', 20, -18.0, 30.0, '故障', '待维修，暂时停用']
  ];
  
  cabinets.forEach(cabinet => {
    cabinetStmt.run(...cabinet);
  });
  cabinetStmt.finalize();
  
  console.log('✓ 已插入 4 条冷藏柜记录');

  const slotStmt = db.prepare(`
    INSERT INTO storage_slots (
      cold_storage_id, slot_code, row_number, column_number, max_capacity
    )
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const slots = [];
  for (let cabinetId = 1; cabinetId <= 3; cabinetId++) {
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 2; col++) {
        const cabinetCode = cabinetId === 1 ? 'CS-001' : cabinetId === 2 ? 'CS-002' : 'CS-003';
        slots.push([cabinetId, `${cabinetCode}-R${row}C${col}`, row, col, 10]);
      }
    }
  }
  
  slots.forEach(slot => {
    slotStmt.run(...slot);
  });
  slotStmt.finalize();
  
  console.log('✓ 已插入 30 条冷藏柜格位记录');

  const batchStmt = db.prepare(`
    INSERT INTO seed_batches (
      batch_number, species_id, collection_site_id, volunteer_id,
      collection_date, quantity_grams, moisture_content,
      initial_germination_rate, storage_slot_id, status,
      batch_assessment, assessment_details, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const batches = [
    [
      'BATCH-2024-001',
      1,
      1,
      1,
      '2024-10-15',
      500,
      6.5,
      75.0,
      1,
      '已入库',
      '正常',
      JSON.stringify([]),
      '松山保护区采集，质量优良'
    ],
    [
      'BATCH-2024-002',
      2,
      2,
      2,
      '2024-10-20',
      300,
      7.2,
      65.0,
      2,
      '已入库',
      '正常',
      JSON.stringify([]),
      '小五台山采集，蒙古栎种子'
    ],
    [
      'BATCH-2024-003',
      3,
      3,
      1,
      '2024-09-25',
      200,
      9.5,
      45.0,
      3,
      '待复核',
      '高风险',
      JSON.stringify([
        '含水率 9.5% 超过该物种阈值 7.0%',
        '萌发率 45.0% 低于该物种阈值 50.0%'
      ]),
      '含水率超标，萌发率偏低，待复核'
    ],
    [
      'BATCH-2024-004',
      5,
      1,
      3,
      '2024-05-10',
      150,
      7.8,
      80.0,
      null,
      '待复核',
      '高风险',
      JSON.stringify([
        '物种 刺槐 (Robinia pseudoacacia) 为 外来种，非乡土种，禁止入库'
      ]),
      '外来种，禁止入库'
    ],
    [
      'BATCH-2024-005',
      6,
      2,
      2,
      '2024-11-01',
      100,
      8.0,
      35.0,
      null,
      '待确认',
      '中风险',
      JSON.stringify([
        '萌发率 35.0% 低于该物种阈值 40.0%'
      ]),
      '萌发率略低，待确认'
    ]
  ];
  
  batches.forEach(batch => {
    batchStmt.run(...batch);
  });
  batchStmt.finalize();
  
  console.log('✓ 已插入 5 条种子批次记录（含高风险、中风险示例）');

  db.run(`UPDATE storage_slots SET current_usage = 1, status = '使用中' WHERE id IN (1, 2, 3)`);
  
  console.log('✓ 已更新格位使用状态');

  const germTestStmt = db.prepare(`
    INSERT INTO germination_tests (
      seed_batch_id, test_date, tested_by, seeds_planted,
      seeds_germinated, germination_rate, test_conditions, duration_days, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const germTests = [
    [1, '2024-10-20', '刘测试', 100, 75, 75.0, '25°C，光照12小时', 14, '第一次萌发测试'],
    [1, '2024-11-05', '刘测试', 100, 78, 78.0, '25°C，光照12小时', 14, '重复测试，结果一致'],
    [2, '2024-10-25', '刘测试', 50, 32, 64.0, '25°C，低温层积30天', 21, '需要层积处理'],
    [3, '2024-10-01', '李鉴定', 100, 45, 45.0, '25°C，光照12小时', 14, '萌发率偏低']
  ];
  
  germTests.forEach(test => {
    germTestStmt.run(...test);
  });
  germTestStmt.finalize();
  
  console.log('✓ 已插入 4 条萌发测试记录');

  const exchangeStmt = db.prepare(`
    INSERT INTO seed_exchanges (
      exchange_number, exchange_type, seed_batch_id,
      quantity_grams, requestor, request_date, purpose, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const exchanges = [
    ['EX-2024-001', '换出', 1, 50, '北京植物园', '2024-11-01', '科研合作', '待审核'],
    ['EX-2024-002', '入库', 4, 150, '王保管员', '2024-10-28', '新采集入库', '待审核'],
    ['EX-2024-003', '换出', 2, 100, '河北林科院', '2024-10-15', '种苗交换', '已完成']
  ];
  
  exchanges.forEach(exchange => {
    exchangeStmt.run(...exchange);
  });
  exchangeStmt.finalize();
  
  console.log('✓ 已插入 3 条换种申请记录');

  const auditStmt = db.prepare(`
    INSERT INTO audit_logs (
      batch_id, exchange_id, action, actor, details, assessment, assessment_details
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const audits = [
    [1, null, '创建种子批次', '张采集', JSON.stringify({ batch_number: 'BATCH-2024-001', species_id: 1 }), '正常', JSON.stringify([])],
    [2, null, '创建种子批次', '李鉴定', JSON.stringify({ batch_number: 'BATCH-2024-002', species_id: 2 }), '正常', JSON.stringify([])],
    [3, null, '创建种子批次', '张采集', JSON.stringify({ batch_number: 'BATCH-2024-003', species_id: 3 }), '高风险', JSON.stringify(['含水率超标', '萌发率过低'])],
    [4, null, '创建种子批次', '王保管员', JSON.stringify({ batch_number: 'BATCH-2024-004', species_id: 5 }), '高风险', JSON.stringify(['外来种误放'])],
    [5, null, '创建种子批次', '李鉴定', JSON.stringify({ batch_number: 'BATCH-2024-005', species_id: 6 }), '中风险', JSON.stringify(['萌发率过低'])],
    [1, 3, '完成换种', '王保管员', JSON.stringify({ exchange_number: 'EX-2024-003', quantity: 100 }), '正常', JSON.stringify([])],
    [1, null, '入库登记', '系统', JSON.stringify({ storage_slot_id: 1 }), '正常', JSON.stringify([])],
    [2, null, '入库登记', '系统', JSON.stringify({ storage_slot_id: 2 }), '正常', JSON.stringify([])],
    [3, null, '入库登记', '系统', JSON.stringify({ storage_slot_id: 3 }), '高风险', JSON.stringify(['含水率超标', '萌发率过低'])]
  ];
  
  audits.forEach(audit => {
    auditStmt.run(...audit);
  });
  auditStmt.finalize();
  
  console.log('✓ 已插入 9 条审计日志记录');

  console.log('');
  console.log('========================================');
  console.log('  乡土植物种子库示例数据插入完成！');
  console.log('========================================');
  console.log('');
  console.log('数据概览：');
  console.log('- 志愿者: 5 条');
  console.log('- 采集地点: 4 条 (含1条已关闭测试点)');
  console.log('- 物种: 6 条 (含1条外来种测试数据)');
  console.log('- 冷藏柜: 4 条 (含1条故障测试)');
  console.log('- 冷藏格位: 30 条');
  console.log('- 种子批次: 5 条');
  console.log('  - 正常: 2 条');
  console.log('  - 高风险: 2 条 (含水率超标、外来种)');
  console.log('  - 中风险: 1 条 (萌发率偏低)');
  console.log('- 萌发测试: 4 条');
  console.log('- 换种申请: 3 条');
  console.log('- 审计日志: 9 条');
  console.log('');
  console.log('测试场景说明：');
  console.log('1. 含水率超标测试: BATCH-2024-003 (白桦, 含水率9.5% > 阈值7.0%)');
  console.log('2. 萌发率过低测试: BATCH-2024-003 (45% < 50%), BATCH-2024-005 (35% < 40%)');
  console.log('3. 外来种误放测试: BATCH-2024-004 (刺槐, 标记为外来种)');
  console.log('4. 来源缺失测试: SITE-004 (已关闭的采集点)');
  console.log('5. 格位容量测试: 已占用3个格位，其余空闲');
  console.log('');
  console.log('运行 npm start 启动服务');
});

db.close();
