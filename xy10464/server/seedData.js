const { db } = require('./database');
const { format, addHours, addDays } = require('date-fns');

async function seedDatabase() {
  const existingContract = db.prepare('SELECT COUNT(*) as count FROM contracts').get();
  if (existingContract && existingContract.count > 0) {
    console.log('数据库已存在数据，跳过种子数据插入');
    return;
  }
  
  console.log('开始插入种子数据...');
  
  const now = new Date();
  
  const contractResult = db.prepare(`
    INSERT INTO contracts (
      name, customer_name, contract_number, start_date, end_date,
      response_sla_hours, repair_sla_hours, response_fine_rate, repair_fine_rate,
      max_response_fine, max_repair_fine, max_total_fine
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '2026年度企业维修服务合同',
    '华为技术有限公司',
    'CONTRACT-2026-001',
    '2026-01-01',
    '2026-12-31',
    4,
    8,
    50,
    80,
    2000,
    5000,
    6000
  );
  
  const contractId = contractResult.lastInsertRowid;
  console.log('插入合同成功，ID:', contractId);
  
  const created1 = new Date(now.getTime() - 10 * 60 * 60 * 1000);
  const responded1 = new Date(created1.getTime() + 2 * 60 * 60 * 1000);
  const repaired1 = new Date(responded1.getTime() + 5 * 60 * 60 * 1000);
  const closed1 = new Date(repaired1.getTime() + 30 * 60 * 1000);
  
  const wo1Result = db.prepare(`
    INSERT INTO work_orders (contract_id, work_order_number, description, status, is_settled)
    VALUES (?, ?, ?, 'closed', 0)
  `).run(contractId, 'WO-2026-0001', '服务器硬盘故障，需要更换硬盘');
  const wo1Id = wo1Result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'created', ?, '工单创建')
  `).run(wo1Id, format(created1, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'responded', ?, '响应客户')
  `).run(wo1Id, format(responded1, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'repaired', ?, '修复完成')
  `).run(wo1Id, format(repaired1, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'closed', ?, '工单关闭')
  `).run(wo1Id, format(closed1, 'yyyy-MM-dd HH:mm:ss'));
  
  console.log('插入正常工单成功，ID:', wo1Id);
  
  const created2 = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const responded2 = new Date(created2.getTime() + 6 * 60 * 60 * 1000);
  
  const wo2Result = db.prepare(`
    INSERT INTO work_orders (contract_id, work_order_number, description, status, is_settled)
    VALUES (?, ?, ?, 'responded', 0)
  `).run(contractId, 'WO-2026-0002', '网络交换机端口故障，影响业务系统');
  const wo2Id = wo2Result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'created', ?, '工单创建')
  `).run(wo2Id, format(created2, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'responded', ?, '响应客户')
  `).run(wo2Id, format(responded2, 'yyyy-MM-dd HH:mm:ss'));
  
  console.log('插入响应超时工单成功，ID:', wo2Id);
  
  const created3 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const responded3 = new Date(created3.getTime() + 2 * 60 * 60 * 1000);
  const paused3 = new Date(responded3.getTime() + 3 * 60 * 60 * 1000);
  const resumed3 = new Date(paused3.getTime() + 24 * 60 * 60 * 1000);
  const repaired3 = new Date(resumed3.getTime() + 4 * 60 * 60 * 1000);
  
  const wo3Result = db.prepare(`
    INSERT INTO work_orders (contract_id, work_order_number, description, status, is_settled)
    VALUES (?, ?, ?, 'repaired', 0)
  `).run(contractId, 'WO-2026-0003', '数据库系统迁移，客户需要协调业务停机窗口');
  const wo3Id = wo3Result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'created', ?, '工单创建')
  `).run(wo3Id, format(created3, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'responded', ?, '响应客户')
  `).run(wo3Id, format(responded3, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason, evidence_url)
    VALUES (?, 'paused', ?, '客户原因: 等待客户提供业务停机窗口确认', 'https://example.com/evidence/wo3-screenshot1.png')
  `).run(wo3Id, format(paused3, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'resumed', ?, '客户确认停机窗口，恢复处理')
  `).run(wo3Id, format(resumed3, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'repaired', ?, '修复完成')
  `).run(wo3Id, format(repaired3, 'yyyy-MM-dd HH:mm:ss'));
  
  console.log('插入客户暂停工单成功，ID:', wo3Id);
  
  const created4 = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const responded4 = new Date(created4.getTime() + 3 * 60 * 60 * 1000);
  const repaired4 = new Date(responded4.getTime() + 15 * 60 * 60 * 1000);
  const closed4 = new Date(repaired4.getTime() + 30 * 60 * 1000);
  
  const wo4Result = db.prepare(`
    INSERT INTO work_orders (contract_id, work_order_number, description, status, is_settled)
    VALUES (?, ?, ?, 'closed', 0)
  `).run(contractId, 'WO-2026-0004', '核心业务系统性能严重下降，用户无法访问');
  const wo4Id = wo4Result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'created', ?, '工单创建')
  `).run(wo4Id, format(created4, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'responded', ?, '响应客户')
  `).run(wo4Id, format(responded4, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'repaired', ?, '修复完成')
  `).run(wo4Id, format(repaired4, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'closed', ?, '工单关闭')
  `).run(wo4Id, format(closed4, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO exemption_requests (
      work_order_id, exemption_type, reason, evidence_url, amount, status
    ) VALUES (?, 'repair', '供应商配件延迟，需要从外地调货，非我方责任', 'https://example.com/evidence/wo4-supplier.png', 400, 'pending')
  `).run(wo4Id);
  
  console.log('插入修复超时工单成功，ID:', wo4Id);
  
  const created5 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const responded5 = new Date(created5.getTime() + 2 * 60 * 60 * 1000);
  const repaired5 = new Date(responded5.getTime() + 6 * 60 * 60 * 1000);
  const closed5 = new Date(repaired5.getTime() + 30 * 60 * 1000);
  
  const wo5Result = db.prepare(`
    INSERT INTO work_orders (contract_id, work_order_number, description, status, is_settled)
    VALUES (?, ?, ?, 'closed', 0)
  `).run(contractId, 'WO-2026-0005', '测试环境部署，客户原因导致延迟');
  const wo5Id = wo5Result.lastInsertRowid;
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'created', ?, '工单创建')
  `).run(wo5Id, format(created5, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'responded', ?, '响应客户')
  `).run(wo5Id, format(responded5, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'repaired', ?, '修复完成')
  `).run(wo5Id, format(repaired5, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO timing_events (work_order_id, event_type, event_time, reason)
    VALUES (?, 'closed', ?, '工单关闭')
  `).run(wo5Id, format(closed5, 'yyyy-MM-dd HH:mm:ss'));
  
  db.prepare(`
    INSERT INTO exemption_requests (
      work_order_id, exemption_type, reason, evidence_url, amount, status, approved_by, approved_at
    ) VALUES (?, 'response', '客户未及时提供必要信息，导致响应延迟', 'https://example.com/evidence/wo5-approval.png', 150, 'approved', 'manager_a', datetime('now'))
  `).run(wo5Id);
  
  console.log('插入带已批准免责的工单成功，ID:', wo5Id);
  
  console.log('\n========================================');
  console.log('种子数据插入完成！');
  console.log('========================================');
  console.log('合同: 1个');
  console.log('工单: 5个');
  console.log('  - WO-2026-0001: 正常工单（无罚款）');
  console.log('  - WO-2026-0002: 响应超时（2小时超时，罚款100元）');
  console.log('  - WO-2026-0003: 客户暂停（暂停24小时，已扣除）');
  console.log('  - WO-2026-0004: 修复超时（7小时超时，罚款560元，待审批免责）');
  console.log('  - WO-2026-0005: 正常工单，含已批准免责（抵扣150元）');
  console.log('========================================');
}

module.exports = { seedDatabase };
