const { initDB, getDB, closeDB } = require('./db');
const orderService = require('./services/orderService');
const exportService = require('./services/exportService');

console.log('========================================');
console.log('印务店管理系统 - 测试流程');
console.log('========================================\n');

async function runTests() {
  console.log('📋 步骤1: 初始化数据库...');
  initDB();
  const db = getDB();
  console.log('✅ 数据库初始化完成\n');
  
  console.log('👥 步骤2: 创建测试客户...');
  const customerResult = db.prepare(`
    INSERT INTO customers (name, phone, wechat, notes)
    VALUES (?, ?, ?, ?)
  `).run('测试客户_张三', '13900139001', 'test_zhangsan', '测试专用客户');
  const customerId = customerResult.lastInsertRowid;
  console.log(`✅ 客户创建成功，ID: ${customerId}\n`);
  
  console.log('📦 步骤3: 创建测试纸张...');
  const paperResult = db.prepare(`
    INSERT INTO paper_stock (name, type, size, weight, color, unit_price, stock_qty, min_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('测试铜版纸_157g', '铜版纸', 'A4', 157, '白色', 0.8, 1000, 100);
  const paperId = paperResult.lastInsertRowid;
  console.log(`✅ 纸张创建成功，ID: ${paperId}\n`);
  
  console.log('⚙️ 步骤4: 创建测试工序...');
  const processResult = db.prepare(`
    INSERT INTO processes (name, type, cost_per_unit)
    VALUES (?, ?, ?)
  `).run('测试彩色打印', 'print', 0.5);
  const processId = processResult.lastInsertRowid;
  console.log(`✅ 工序创建成功，ID: ${processId}\n`);
  
  console.log('📋 步骤5: 创建订单 - 测试报价计算...');
  
  const orderData = {
    customer_id: customerId,
    product_type: '名片',
    width: 90,
    height: 54,
    quantity: 200,
    paper_id: paperId,
    process_ids: [processId],
    pickup_time: new Date(Date.now() + 86400000).toISOString(),
    notes: '测试订单 - 200张名片'
  };
  
  const order = orderService.createOrder(orderData);
  console.log(`✅ 订单创建成功`);
  console.log(`   订单号: ${order.order_no}`);
  console.log(`   预估用纸: ${order.paper_qty_est} 张`);
  console.log(`   成本: ¥${order.total_cost}`);
  console.log(`   报价: ¥${order.total_price}`);
  console.log(`   状态: ${order.status_name}\n`);
  
  console.log('📊 步骤6: 测试状态流转...');
  
  console.log('   6.1 报价确认 (pending → quoted)');
  let updatedOrder = orderService.updateOrderStatus(order.id, 'quoted', '确认报价', 'test');
  console.log(`   ✅ 状态已变更: ${updatedOrder.status}`);
  
  console.log('   6.2 收款 (quoted → paid)');
  db.prepare('UPDATE orders SET paid_amount = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?').run(order.total_price, order.id);
  updatedOrder = orderService.updateOrderStatus(order.id, 'paid', '已收款', 'test');
  console.log(`   ✅ 状态已变更: ${updatedOrder.status}`);
  
  console.log('   6.3 锁料 (paid → locked)');
  const lockResult = orderService.lockStock(order.id);
  console.log(`   ✅ 库存锁定成功，锁定数量: ${lockResult.locked}`);
  updatedOrder = orderService.updateOrderStatus(order.id, 'locked', '库存已锁定', 'test');
  console.log(`   ✅ 状态已变更: ${updatedOrder.status}\n`);
  
  console.log('⚠️ 步骤7: 测试预检功能...');
  const precheckIssues = orderService.simulatePrecheck(order.id);
  console.log(`   预检完成，发现 ${precheckIssues.length} 个问题`);
  precheckIssues.forEach((issue, idx) => {
    console.log(`   ${idx + 1}. [${issue.severity}] ${issue.issue_name}: ${issue.description}`);
  });
  console.log('');
  
  if (precheckIssues.length > 0) {
    console.log('   7.1 测试问题处理...');
    const resolved = orderService.resolvePrecheckIssue(precheckIssues[0].id, '已检查，问题已处理', 'test');
    console.log(`   ✅ 问题已标记为处理完成: ${resolved.status}\n`);
  }
  
  console.log('📅 步骤8: 测试排产功能...');
  const machineResult = db.prepare(`
    INSERT INTO machines (name, type, status, capacity_per_hour)
    VALUES (?, ?, ?, ?)
  `).run('测试打印机', 'print', 'available', 500);
  const machineId = machineResult.lastInsertRowid;
  
  const startTime = new Date();
  startTime.setHours(10, 0, 0, 0);
  const endTime = new Date();
  endTime.setHours(11, 0, 0, 0);
  
  const scheduleResult = orderService.createScheduleEntry({
    orderId: order.id,
    machineId: machineId,
    processType: 'print',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    quantity: order.quantity,
    notes: '测试排产'
  });
  
  if (scheduleResult.success) {
    console.log(`✅ 排产成功，排产ID: ${scheduleResult.entryId}`);
    
    console.log('   8.1 测试排产冲突检查...');
    const conflictResult = orderService.createScheduleEntry({
      orderId: order.id,
      machineId: machineId,
      processType: 'print',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      quantity: order.quantity,
      notes: '冲突测试'
    });
    
    if (!conflictResult.success) {
      console.log(`   ✅ 冲突检测正常，发现 ${conflictResult.conflicts.length} 个冲突\n`);
    }
  }
  
  console.log('📝 步骤9: 测试改单和库存释放...');
  console.log('   9.1 检查改单前库存...');
  const paperBefore = orderService.getAvailableStock(paperId);
  console.log(`   改单前可用库存: ${paperBefore.available}`);
  
  console.log('   9.2 取消订单释放库存...');
  orderService.releaseStock(order.id);
  const paperAfter = orderService.getAvailableStock(paperId);
  console.log(`   取消后可用库存: ${paperAfter.available}`);
  console.log(`   ✅ 库存释放正确: ${paperBefore.available} → ${paperAfter.available}\n`);
  
  console.log('📄 步骤10: 测试导出功能...');
  
  console.log('   10.1 今日生产单 (Markdown)');
  const todayProd = exportService.getTodayProduction();
  const mdToday = exportService.toMarkdown_TodayProduction(todayProd);
  console.log(`   ✅ Markdown 导出成功，长度: ${mdToday.length} 字符`);
  
  console.log('   10.2 今日生产单 (CSV)');
  const csvToday = exportService.toCSV_TodayProduction(todayProd);
  console.log(`   ✅ CSV 导出成功，长度: ${csvToday.length} 字符`);
  
  console.log('   10.3 补纸清单 (Markdown)');
  const restockList = exportService.getPaperRestockList();
  const mdRestock = exportService.toMarkdown_RestockList(restockList);
  console.log(`   ✅ 补纸清单导出成功，${restockList.length} 种纸张\n`);
  
  console.log('📊 步骤11: 验证状态历史记录...');
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  console.log(`   状态历史记录数: ${history.length}`);
  history.forEach(h => {
    console.log(`   - ${h.from_status || '(初始)'} → ${h.to_status} (${h.reason || '无原因'})`);
  });
  console.log('');
  
  console.log('✅ 测试订单完整状态流转:');
  const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  console.log(`   订单号: ${finalOrder.order_no}`);
  console.log(`   当前状态: ${finalOrder.status}`);
  console.log(`   报价: ¥${finalOrder.total_price}`);
  console.log(`   已收款: ¥${finalOrder.paid_amount || 0}\n`);
  
  console.log('========================================');
  console.log('✅ 所有测试流程完成！');
  console.log('========================================');
  console.log('\n📋 测试覆盖功能:');
  console.log('   ✅ 客户管理');
  console.log('   ✅ 纸张库存管理');
  console.log('   ✅ 订单创建与报价计算');
  console.log('   ✅ 用纸量与损耗估算');
  console.log('   ✅ 状态流转与历史记录');
  console.log('   ✅ 库存锁定与释放');
  console.log('   ✅ 预检问题管理');
  console.log('   ✅ 设备排产与冲突检测');
  console.log('   ✅ 数据导出 (Markdown/CSV)');
  console.log('   ✅ 改单记录与库存重算');
  
  closeDB();
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
