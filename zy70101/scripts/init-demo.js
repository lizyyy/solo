const { v4: uuidv4 } = require('uuid');
const db = require('../src/db/init');

function runDemo() {
  console.log('开始初始化示例数据...\n');
  
  const tx = db.transaction(() => {
    const meterId = uuidv4();
    db.prepare(`
      INSERT INTO meters (id, code, name, location)
      VALUES (?, ?, ?, ?)
    `).run(meterId, 'M-001', '一号楼总表', '一号楼配电房');
    
    console.log('✓ 已创建电表: M-001 一号楼总表');
    
    const tenant1Id = uuidv4();
    const tenant2Id = uuidv4();
    
    db.prepare(`
      INSERT INTO tenants (id, code, name, current_area)
      VALUES (?, ?, ?, ?)
    `).run(tenant1Id, 'T-001', '科技创新公司A', 500);
    
    db.prepare(`
      INSERT INTO tenant_area_versions (id, tenant_id, area, effective_from)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), tenant1Id, 500, '2024-01-01');
    
    db.prepare(`
      INSERT INTO tenants (id, code, name, current_area)
      VALUES (?, ?, ?, ?)
    `).run(tenant2Id, 'T-002', '互联网公司B', 300);
    
    db.prepare(`
      INSERT INTO tenant_area_versions (id, tenant_id, area, effective_from)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), tenant2Id, 300, '2024-01-01');
    
    console.log('✓ 已创建2个租户，总面积 800㎡');
    
    db.prepare(`
      INSERT INTO allocation_rules 
        (id, version, name, description, rule_config, effective_from, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), 
      1, 
      '基础分摊规则v1',
      '按面积比例分摊，无损耗',
      JSON.stringify({ pricePerUnit: 1.2, lossRatio: 0 }),
      '2024-01-01',
      1
    );
    
    console.log('✓ 已创建分摊规则 v1: 单价1.2元/度，无损耗');
    
    db.prepare(`
      INSERT INTO meter_readings 
        (id, meter_id, period, reading, last_reading, consumption, reading_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      meterId,
      '2024-03',
      15000,
      10000,
      5000,
      '2024-04-01T09:00:00'
    );
    
    console.log('✓ 已录入2024年3月电表读数: 用电量5000度');
    
    return { meterId, tenant1Id, tenant2Id };
  });
  
  const result = tx();
  
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                           示例数据初始化完成                              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  【数据概览】                                                             ║
║  电表: M-001 一号楼总表                                                   ║
║  租户1: T-001 科技创新公司A - 500㎡ (62.5%)                               ║
║  租户2: T-002 互联网公司B - 300㎡ (37.5%)                                 ║
║  分摊规则: v1 - 单价1.2元/度，无损耗                                       ║
║  2024年3月用电量: 5000度                                                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║  【预期分摊结果】                                                         ║
║  公司A: 5000 × 62.5% = 3125度 × 1.2元 = 3750元                           ║
║  公司B: 5000 × 37.5% = 1875度 × 1.2元 = 2250元                           ║
║  合计: 6000元                                                             ║
╠══════════════════════════════════════════════════════════════════════════╣
║  【下一步操作】                                                           ║
║  1. 生成账单:                                                             ║
║     curl -X POST http://localhost:3000/api/bills/generate \\             ║
║       -H "Content-Type: application/json" \\                             ║
║       -H "X-Request-ID: req-001" \\                                      ║
║       -d '{"period": "2024-03", "meter_id": "${result.meterId}"}'        ║
║                                                                          ║
║  2. 查看状态机定义: GET /api/status-machine                               ║
║  3. 模拟规则变更后重算 - 请参考 README 中的演示步骤                       ║
╚══════════════════════════════════════════════════════════════════════════╝
  `);
}

runDemo();
