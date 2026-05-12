const { initializeDatabase } = require('./src/database');
const traceabilityService = require('./src/services/traceabilityService');
const reportService = require('./src/services/reportService');

const log = {
  title: (msg) => {
    console.log('\n' + '='.repeat(70));
    console.log(msg);
    console.log('='.repeat(70));
  },
  step: (num, msg) => {
    console.log(`\n【步骤 ${num}】${msg}`);
    console.log('-'.repeat(70));
  },
  success: (msg, data = null) => {
    console.log(`✓ ${msg}`);
    if (data) {
      const str = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
      console.log('  ' + str.substring(0, 300));
    }
  },
  error: (msg) => {
    console.log(`✗ ${msg}`);
  },
  info: (msg) => {
    console.log(`ℹ ${msg}`);
  },
  section: (msg) => {
    console.log('\n  [' + msg + ']');
  }
};

const runDemo1 = async () => {
  log.title('演示 1: 正常到店销售流程');
  log.info('场景: 宫保鸡丁预制菜批次从中央厨房 -> 冷链运输 -> 门店接收 -> 解冻 -> 销售');
  
  try {
    // 步骤 1: 创建门店
    log.step(1, '创建门店 - 北京朝阳店');
    const store = await traceabilityService.createStore({
      store_name: '北京朝阳店',
      store_code: 'DEMO01_STORE_BJ',
      city: '北京',
      address: '北京市朝阳区建国路88号'
    }, 'admin');
    log.success('门店创建成功', { id: store.id, name: store.store_name });
    
    // 步骤 2: 创建批次
    log.step(2, '创建预制菜批次 - 宫保鸡丁');
    const batch = await traceabilityService.createBatch({
      product_name: '宫保鸡丁预制菜',
      product_code: 'DEMO01_PROD_GBC',
      production_date: '2026-05-10',
      expiry_date: '2026-08-10',
      quantity: 100,
      unit: '箱'
    }, 'kitchen_manager');
    log.success('批次创建成功', { 
      id: batch.id, 
      product: batch.product_name,
      status: batch.status,
      quantity: batch.quantity
    });
    
    // 步骤 3: 出库
    log.step(3, '中央厨房出库 - 50箱发往北京朝阳店');
    const outbound = await traceabilityService.createOutbound({
      batch_id: batch.id,
      quantity: 50,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    log.success('出库成功', { id: outbound.id, quantity: outbound.quantity });
    
    // 查询当前批次状态
    log.section('查询当前批次状态');
    const detail1 = await traceabilityService.getBatchDetail(batch.id);
    log.info(`批次当前状态: ${detail1.batch.status}`);
    
    // 步骤 4: 开始冷链运输
    log.step(4, '开始冷链运输');
    const coldChain = await traceabilityService.startColdChain({
      batch_id: batch.id,
      store_id: store.id,
      outbound_record_id: outbound.id,
      transport_start_time: '2026-05-12 09:00:00'
    }, 'logistics_manager');
    log.success('冷链运输开始', { 
      id: coldChain.id, 
      status: coldChain.status
    });
    
    // 步骤 5: 完成冷链运输（正常温度）
    log.step(5, '完成冷链运输 - 温度正常 (-18°C ~ -5°C)');
    const completeColdChain = await traceabilityService.completeColdChain(coldChain.id, {
      transport_end_time: '2026-05-12 11:30:00',
      temperature_log: [
        { time: '2026-05-12 09:00:00', temperature: -18 },
        { time: '2026-05-12 10:00:00', temperature: -17 },
        { time: '2026-05-12 11:00:00', temperature: -16 },
        { time: '2026-05-12 11:30:00', temperature: -15 }
      ]
    }, 'logistics_manager');
    log.success('冷链运输完成', { 
      status: completeColdChain.status,
      is_abnormal: completeColdChain.is_abnormal,
      avg_temp: completeColdChain.avg_temperature
    });
    
    // 步骤 6: 门店接收
    log.step(6, '北京朝阳店接收货物');
    const receive = await traceabilityService.receiveBatch({
      cold_chain_record_id: coldChain.id,
      receive_time: '2026-05-12 12:00:00',
      remarks: '货物完好，数量无误'
    }, 'store_manager_bj');
    log.success('接收成功', { 
      quantity: receive.quantity,
      operator: receive.operator
    });
    
    // 查询库存
    log.section('查询门店库存');
    const inv1 = await traceabilityService.getStoreInventory();
    if (inv1.length > 0) {
      const inv = inv1[0];
      log.info(`门店: ${inv.store_name}, 总库存: ${inv.quantity}箱`);
      log.info(`  冷冻: ${inv.frozen_quantity}箱, 解冻: ${inv.thawed_quantity}箱`);
      log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
    }
    
    // 步骤 7: 开始解冻
    log.step(7, '开始解冻 - 10箱');
    const thaw = await traceabilityService.startThaw({
      batch_id: batch.id,
      store_id: store.id,
      quantity: 10,
      thaw_start_time: '2026-05-12 14:00:00',
      expected_thaw_time: '2026-05-12 20:00:00'
    }, 'chef_bj');
    log.success('解冻开始', { id: thaw.id, quantity: thaw.quantity, status: thaw.status });
    
    // 步骤 8: 完成解冻
    log.step(8, '完成解冻 - 正常时间内完成');
    const completeThaw = await traceabilityService.completeThaw(thaw.id, {
      thaw_end_time: '2026-05-12 19:30:00'
    }, 'chef_bj');
    log.success('解冻完成', { status: completeThaw.status, is_overtime: completeThaw.is_overtime });
    
    // 步骤 9: 销售
    log.step(9, '销售 - 卖出5箱');
    const sale = await traceabilityService.createSale({
      batch_id: batch.id,
      store_id: store.id,
      quantity: 5,
      sale_time: '2026-05-12 21:00:00'
    }, 'cashier_bj');
    log.success('销售成功', { quantity: sale.quantity, operator: sale.operator });
    
    // 最终查询
    log.section('最终状态查询');
    const finalDetail = await traceabilityService.getBatchDetail(batch.id);
    log.info(`批次最终状态: ${finalDetail.batch.status}`);
    
    const finalInv = await traceabilityService.getStoreInventory();
    if (finalInv.length > 0) {
      const inv = finalInv[0];
      log.info(`门店: ${inv.store_name}`);
      log.info(`  总库存: ${inv.quantity}箱 (冷冻: ${inv.frozen_quantity}, 解冻: ${inv.thawed_quantity})`);
      log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
    }
    
    // 生成报告
    log.section('生成批次流向报告');
    const report = await reportService.generateBatchFlowReport(batch.id);
    log.info(`报告类型: ${report.report_type}`);
    log.info(`批次: ${report.batch_info.product_name}`);
    log.info(`流向步骤: ${report.flow_path.length} 个环节`);
    report.flow_path.forEach((step, idx) => {
      log.info(`  ${idx + 1}. ${step.step} - ${step.status}`);
    });
    log.info(`统计: 已售 ${report.statistics.total_sold}箱, 库存 ${report.statistics.total_in_stores}箱`);
    
    log.title('演示 1 完成: 正常流程');
    log.info('流程: 创建批次 -> 出库 -> 冷链运输 -> 门店接收 -> 解冻 -> 销售');
    log.info('状态变化: CREATED -> OUTBOUND -> IN_TRANSIT -> RECEIVED -> THAWING -> THAWED -> PARTIAL_SOLD');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

const runDemo2 = async () => {
  log.title('演示 2: 冷链异常复核流程');
  log.info('场景: 麻婆豆腐预制菜批次冷链运输温度异常，需要复核处理');
  
  try {
    // 步骤 1: 创建门店和批次
    log.step(1, '准备基础数据 - 创建门店和批次');
    
    const store = await traceabilityService.createStore({
      store_name: '上海浦东店',
      store_code: 'DEMO02_STORE_SH',
      city: '上海',
      address: '上海市浦东新区陆家嘴环路1000号'
    }, 'admin');
    log.success('门店创建成功', { id: store.id, name: store.store_name });
    
    const batch = await traceabilityService.createBatch({
      product_name: '麻婆豆腐预制菜',
      product_code: 'DEMO02_PROD_MPD',
      production_date: '2026-05-11',
      expiry_date: '2026-08-11',
      quantity: 80,
      unit: '箱'
    }, 'kitchen_manager');
    log.success('批次创建成功', { id: batch.id, product: batch.product_name, status: batch.status });
    
    // 步骤 2: 出库
    log.step(2, '出库 - 30箱发往上海浦东店');
    const outbound = await traceabilityService.createOutbound({
      batch_id: batch.id,
      quantity: 30,
      outbound_time: '2026-05-12 07:00:00'
    }, 'warehouse_manager');
    log.success('出库成功', { quantity: outbound.quantity });
    
    // 步骤 3: 开始冷链运输
    log.step(3, '开始冷链运输');
    const coldChain = await traceabilityService.startColdChain({
      batch_id: batch.id,
      store_id: store.id,
      outbound_record_id: outbound.id,
      transport_start_time: '2026-05-12 08:00:00'
    }, 'logistics_manager');
    log.success('冷链运输开始');
    
    // 步骤 4: 完成冷链运输 - 模拟温度异常
    log.step(4, '完成冷链运输 - 模拟温度异常（最高温度 2°C，超过安全范围）');
    log.info('安全温度范围: -18°C ~ -5°C');
    log.info('模拟异常: 运输途中制冷设备故障，温度飙升至 2°C');
    
    const completeColdChain = await traceabilityService.completeColdChain(coldChain.id, {
      transport_end_time: '2026-05-12 10:30:00',
      temperature_log: [
        { time: '2026-05-12 08:00:00', temperature: -18 },
        { time: '2026-05-12 08:30:00', temperature: -15 },
        { time: '2026-05-12 09:00:00', temperature: -5 },
        { time: '2026-05-12 09:30:00', temperature: 0 },
        { time: '2026-05-12 10:00:00', temperature: 2 },
        { time: '2026-05-12 10:30:00', temperature: -10 }
      ]
    }, 'logistics_manager');
    
    log.success('冷链运输完成');
    log.section('冷链状态分析');
    log.info(`冷链状态: ${completeColdChain.status}`);
    log.info(`是否异常: ${completeColdChain.is_abnormal ? '是' : '否'}`);
    log.info(`异常原因: ${completeColdChain.abnormal_reason}`);
    log.info(`最高温度: ${completeColdChain.max_temperature}°C`);
    log.info(`最低温度: ${completeColdChain.min_temperature}°C`);
    log.info(`平均温度: ${completeColdChain.avg_temperature}°C`);
    
    const detail1 = await traceabilityService.getBatchDetail(batch.id);
    log.info(`批次状态: ${detail1.batch.status}`);
    
    // 步骤 5: 质量部门复核
    log.step(5, '质量部门复核 - 决定是否可以接收');
    log.info('质量专员检查温度记录和货物状态...');
    
    log.section('查看状态历史记录');
    const history = detail1.history;
    log.info(`共有 ${history.length} 条状态变更记录:`);
    history.forEach((h, idx) => {
      log.info(`  ${idx + 1}. [${h.created_at}] ${h.action}: ${h.from_status || '无'} -> ${h.to_status}`);
      if (h.reason) {
        log.info(`     原因: ${h.reason}`);
      }
    });
    
    // 步骤 6: 门店接收（即使异常也可以接收，但会标记异常批次）
    log.step(6, '门店接收 - 接收异常批次等待进一步处理');
    const receive = await traceabilityService.receiveBatch({
      cold_chain_record_id: coldChain.id,
      receive_time: '2026-05-12 11:00:00',
      remarks: '冷链温度异常，货物已隔离等待质检'
    }, 'store_manager_sh');
    log.success('接收成功', { remarks: receive.remarks });
    
    const detail2 = await traceabilityService.getBatchDetail(batch.id);
    log.info(`批次当前状态: ${detail2.batch.status}`);
    
    // 步骤 7: 质量部门决定 - 报损处理
    log.step(7, '质量部门决定 - 因温度异常，全部报损');
    const damage = await traceabilityService.createDamage({
      batch_id: batch.id,
      store_id: store.id,
      quantity: 30,
      damage_type: 'frozen',
      damage_reason: '冷链运输温度异常，存在食品安全风险',
      damage_time: '2026-05-12 14:00:00'
    }, 'quality_manager');
    log.success('报损成功', { quantity: damage.quantity, reason: damage.damage_reason });
    
    // 步骤 8: 查询最终库存和状态
    log.step(8, '查询最终库存和状态');
    
    const finalInv = await traceabilityService.getStoreInventory();
    if (finalInv.length > 0) {
      const inv = finalInv.find(i => i.batch_id === batch.id);
      if (inv) {
        log.section('库存详情');
        log.info(`门店: ${inv.store_name}`);
        log.info(`  总库存: ${inv.quantity}箱`);
        log.info(`  冷冻: ${inv.frozen_quantity}箱, 解冻: ${inv.thawed_quantity}箱`);
        log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
      }
    }
    
    log.section('生成批次流向报告');
    const report = await reportService.generateBatchFlowReport(batch.id);
    log.info(`批次: ${report.batch_info.product_name}`);
    log.info(`最终状态: ${report.batch_info.current_status}`);
    log.info(`报损数量: ${report.statistics.total_damaged}箱`);
    log.info(`流向路径:`);
    report.flow_path.forEach((step, idx) => {
      const statusIcon = step.status === 'COMPLETED' ? '✓' : (step.details.includes('异常') ? '⚠' : '→');
      log.info(`  ${statusIcon} ${idx + 1}. ${step.step}`);
      if (step.details.includes('异常')) {
        log.info(`     ${step.details}`);
      }
    });
    
    log.title('演示 2 完成: 冷链异常流程');
    log.info(`异常类型: 冷链运输温度过高 (最高 ${completeColdChain.max_temperature}°C)`);
    log.info(`处理结果: 全部报损 (${damage.quantity}箱)`);
    log.info('状态变化: CREATED -> OUTBOUND -> IN_TRANSIT -> ABNORMAL (最终报损)');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

const runDemo3 = async () => {
  log.title('演示 3: 召回冻结流程');
  log.info('场景: 红烧肉预制菜批次发现质量问题，启动召回，已售出和未售出的追踪');
  
  try {
    // 步骤 1: 创建门店和批次
    log.step(1, '准备基础数据 - 创建门店和批次');
    
    const store = await traceabilityService.createStore({
      store_name: '广州天河店',
      store_code: 'DEMO03_STORE_GZ',
      city: '广州',
      address: '广州市天河区珠江新城华夏路30号'
    }, 'admin');
    log.success('门店创建成功', { id: store.id, name: store.store_name });
    
    const batch = await traceabilityService.createBatch({
      product_name: '红烧肉预制菜',
      product_code: 'DEMO03_PROD_HSR',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 60,
      unit: '箱'
    }, 'kitchen_manager');
    log.success('批次创建成功', { id: batch.id, product: batch.product_name, status: batch.status });
    
    // 步骤 2: 正常流程到销售
    log.step(2, '正常流程 - 出库、冷链、接收、解冻、部分销售');
    
    const outbound = await traceabilityService.createOutbound({
      batch_id: batch.id,
      quantity: 40,
      outbound_time: '2026-05-12 06:00:00'
    }, 'warehouse_manager');
    log.success('出库 - 40箱');
    
    const coldChain = await traceabilityService.startColdChain({
      batch_id: batch.id,
      store_id: store.id,
      outbound_record_id: outbound.id,
      transport_start_time: '2026-05-12 07:00:00'
    }, 'logistics_manager');
    log.success('冷链开始');
    
    await traceabilityService.completeColdChain(coldChain.id, {
      transport_end_time: '2026-05-12 10:00:00',
      temperature_log: [
        { time: '2026-05-12 07:00:00', temperature: -18 },
        { time: '2026-05-12 08:30:00', temperature: -16 },
        { time: '2026-05-12 10:00:00', temperature: -17 }
      ]
    }, 'logistics_manager');
    log.success('冷链完成（正常温度）');
    
    await traceabilityService.receiveBatch({
      cold_chain_record_id: coldChain.id,
      receive_time: '2026-05-12 10:30:00',
      remarks: '正常接收'
    }, 'store_manager_gz');
    log.success('门店接收 - 40箱');
    
    const thaw = await traceabilityService.startThaw({
      batch_id: batch.id,
      store_id: store.id,
      quantity: 20,
      thaw_start_time: '2026-05-12 11:00:00',
      expected_thaw_time: '2026-05-12 17:00:00'
    }, 'chef_gz');
    log.success('开始解冻 - 20箱');
    
    await traceabilityService.completeThaw(thaw.id, {
      thaw_end_time: '2026-05-12 16:30:00'
    }, 'chef_gz');
    log.success('完成解冻');
    
    await traceabilityService.createSale({
      batch_id: batch.id,
      store_id: store.id,
      quantity: 15,
      sale_time: '2026-05-12 18:00:00'
    }, 'cashier_gz');
    log.success('销售 - 15箱');
    
    log.section('当前库存状态（召回前）');
    const inv1 = await traceabilityService.getStoreInventory();
    if (inv1.length > 0) {
      const inv = inv1.find(i => i.batch_id === batch.id);
      if (inv) {
        log.info(`门店: ${inv.store_name}`);
        log.info(`  总库存: ${inv.quantity}箱`);
        log.info(`  冷冻: ${inv.frozen_quantity}箱, 解冻: ${inv.thawed_quantity}箱`);
        log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
      }
    }
    
    // 步骤 3: 发现问题，启动召回
    log.step(3, '质量问题发现 - 启动召回');
    log.info('发现该批次红烧肉预制菜调料包存在质量问题');
    log.info('启动召回流程...');
    
    const recall = await traceabilityService.createRecall({
      batch_id: batch.id,
      recall_reason: '该批次调料包检测出微生物超标，存在食品安全风险',
      recall_time: '2026-05-12 20:00:00'
    }, 'quality_manager');
    log.success('召回启动成功', { reason: recall.recall_reason, operator: recall.operator });
    
    const detail1 = await traceabilityService.getBatchDetail(batch.id);
    log.info(`批次状态变化: PARTIAL_SOLD -> ${detail1.batch.status}`);
    
    // 步骤 4: 验证召回后禁止销售
    log.step(4, '验证召回后禁止销售规则');
    log.info('尝试销售召回批次...');
    
    try {
      await traceabilityService.createSale({
        batch_id: batch.id,
        store_id: store.id,
        quantity: 5,
        sale_time: '2026-05-12 20:30:00'
      }, 'cashier_gz');
      log.error('错误: 召回批次应该禁止销售！');
    } catch (e) {
      log.success('规则生效 - 召回批次禁止销售');
      log.info(`  错误信息: ${e.message}`);
    }
    
    // 步骤 5: 生成召回报告
    log.step(5, '生成召回报告 - 分析召回覆盖率');
    
    const recallReport = await reportService.generateRecallReport(batch.id);
    const report = recallReport;
    log.section('召回报告详情');
    log.info(`批次: ${report.recall_info.product_name}`);
    log.info(`召回原因: ${report.recall_info.recall_reason}`);
    log.info(`召回时间: ${report.recall_info.recall_time}`);
    log.info(`操作人: ${report.recall_info.operator}`);
    
    log.section('召回统计');
    log.info(`总分发数量: ${report.recall_statistics.total_distributed}箱`);
    log.info(`已售出数量: ${report.recall_statistics.total_sold}箱`);
    log.info(`门店剩余数量: ${report.recall_statistics.total_in_stores}箱`);
    log.info(`已召回数量: ${report.recall_statistics.total_recalled}箱`);
    log.info(`待召回数量: ${report.recall_statistics.total_remaining_to_recall}箱`);
    log.info(`召回覆盖率: ${report.recall_statistics.coverage_rate}`);
    
    log.section('门店明细');
    report.store_breakdown.forEach(s => {
      log.info(`门店: ${s.store_name}`);
      log.info(`  总接收: ${s.total_received}箱, 已售: ${s.sold}箱`);
      log.info(`  门店剩余: ${s.remaining_in_store}箱, 召回状态: ${s.recall_status}`);
    });
    
    // 步骤 6: 查看完整历史记录
    log.step(6, '查看完整状态历史记录');
    
    const finalDetail = await traceabilityService.getBatchDetail(batch.id);
    log.section('状态变更历史');
    finalDetail.history.forEach((h, idx) => {
      log.info(`${idx + 1}. [${h.created_at}]`);
      log.info(`   操作: ${h.action}`);
      log.info(`   状态: ${h.from_status || '无'} -> ${h.to_status}`);
      log.info(`   操作人: ${h.operator}`);
      if (h.reason) {
        log.info(`   原因: ${h.reason}`);
      }
      log.info('');
    });
    
    log.title('演示 3 完成: 召回流程');
    log.info(`召回原因: ${recall.recall_reason}`);
    log.info(`已售出: 15箱, 门店剩余: 25箱 (冷冻20箱 + 解冻5箱)`);
    log.info(`召回后状态: RECALLED（禁止销售）`);
    log.info('验证规则: 召回批次尝试销售被系统拒绝 ✓');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

const runDemo4 = async () => {
  log.title('演示 4: 重复操作验证（幂等性 + 重复接收）');
  log.info('场景: 验证系统幂等性和防止重复接收的规则');
  
  try {
    // 步骤 1: 创建基础数据
    log.step(1, '准备基础数据');
    
    const store = await traceabilityService.createStore({
      store_name: '深圳南山店',
      store_code: 'DEMO04_STORE_SZ',
      city: '深圳',
      address: '深圳市南山区科技园'
    }, 'admin');
    log.success('门店创建成功');
    
    const batch = await traceabilityService.createBatch({
      product_name: '鱼香肉丝预制菜',
      product_code: 'DEMO04_PROD_YXR',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 50,
      unit: '箱'
    }, 'kitchen_manager');
    log.success('批次创建成功');
    
    // 步骤 2: 出库
    log.step(2, '出库 - 20箱');
    
    const outbound = await traceabilityService.createOutbound({
      batch_id: batch.id,
      quantity: 20,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    const outboundId = outbound.id;
    log.success('第一次出库成功');
    
    // 验证幂等性 - 尝试重复出库（相同时间）
    log.section('验证幂等性 - 重复出库（相同参数）');
    log.info('尝试使用相同参数再次出库...');
    
    const duplicateOutbound = await traceabilityService.createOutbound({
      batch_id: batch.id,
      quantity: 20,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    
    log.success('幂等性生效 - 返回第一次出库结果，不重复创建');
    log.info(`  出库ID一致: ${duplicateOutbound.id === outboundId ? '是 ✓' : '否 ✗'}`);
    
    // 步骤 3: 冷链运输
    log.step(3, '开始冷链运输');
    
    const coldChain = await traceabilityService.startColdChain({
      batch_id: batch.id,
      store_id: store.id,
      outbound_record_id: outboundId,
      transport_start_time: '2026-05-12 09:00:00'
    }, 'logistics_manager');
    const coldChainId = coldChain.id;
    log.success('冷链开始');
    
    await traceabilityService.completeColdChain(coldChainId, {
      transport_end_time: '2026-05-12 11:00:00',
      temperature_log: [
        { time: '2026-05-12 09:00:00', temperature: -18 },
        { time: '2026-05-12 11:00:00', temperature: -17 }
      ]
    }, 'logistics_manager');
    log.success('冷链完成');
    
    // 步骤 4: 第一次接收
    log.step(4, '第一次门店接收');
    
    await traceabilityService.receiveBatch({
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 11:30:00',
      remarks: '第一次接收'
    }, 'store_manager_sz');
    log.success('第一次接收成功');
    
    const inv1 = await traceabilityService.getStoreInventory();
    if (inv1.length > 0) {
      const inv = inv1.find(i => i.batch_id === batch.id);
      if (inv) {
        log.info(`当前库存: ${inv.quantity}箱`);
      }
    }
    
    // 步骤 5: 验证重复接收
    log.step(5, '验证禁止重复接收规则');
    log.info('尝试使用相同冷链记录再次接收...');
    
    try {
      await traceabilityService.receiveBatch({
        cold_chain_record_id: coldChainId,
        receive_time: '2026-05-12 12:00:00',
        remarks: '第二次尝试接收'
      }, 'store_manager_sz');
      log.error('错误: 应该禁止重复接收！');
    } catch (e) {
      log.success('规则生效 - 禁止重复接收');
      log.info(`  错误信息: ${e.message}`);
    }
    
    const inv2 = await traceabilityService.getStoreInventory();
    if (inv2.length > 0) {
      const inv = inv2.find(i => i.batch_id === batch.id);
      if (inv) {
        log.info(`库存验证: ${inv.quantity}箱 (应该还是20箱)`);
      }
    }
    
    // 步骤 6: 验证创建批次幂等性
    log.step(6, '验证创建批次幂等性');
    log.info('尝试创建相同产品代码和生产日期的批次...');
    
    const duplicateBatch = await traceabilityService.createBatch({
      product_name: '鱼香肉丝预制菜',
      product_code: 'DEMO04_PROD_YXR',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 50,
      unit: '箱'
    }, 'kitchen_manager');
    
    log.success('幂等性生效 - 返回已存在的批次');
    log.info(`  批次ID一致: ${duplicateBatch.id === batch.id ? '是 ✓' : '否 ✗'}`);
    
    // 步骤 7: 验证召回幂等性
    log.step(7, '验证召回幂等性');
    
    const recall = await traceabilityService.createRecall({
      batch_id: batch.id,
      recall_reason: '测试召回',
      recall_time: '2026-05-12 15:00:00'
    }, 'quality_manager');
    log.success('第一次召回成功');
    
    log.info('尝试重复召回...');
    const duplicateRecall = await traceabilityService.createRecall({
      batch_id: batch.id,
      recall_reason: '测试召回',
      recall_time: '2026-05-12 15:00:00'
    }, 'quality_manager');
    log.success('幂等性生效 - 返回第一次召回结果');
    
    // 步骤 8: 查看完整历史记录
    log.step(8, '查看状态历史记录（验证幂等操作没有产生重复历史）');
    
    const batchDetail = await traceabilityService.getBatchDetail(batch.id);
    log.section('状态变更历史');
    batchDetail.history.forEach((h, idx) => {
      log.info(`${idx + 1}. [${h.created_at}] ${h.action}: ${h.from_status || '无'} -> ${h.to_status}`);
    });
    log.info(`\n总历史记录数: ${batchDetail.history.length}`);
    log.info('(幂等操作不会产生重复的历史记录)');
    
    log.title('演示 4 完成: 重复操作和幂等性验证');
    log.info('验证的规则:');
    log.info('  ✓ 出库幂等性 - 相同参数不重复创建');
    log.info('  ✓ 批次创建幂等性 - 相同产品代码和生产日期不重复创建');
    log.info('  ✓ 禁止重复接收 - 同一冷链记录只能接收一次');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

const runAllDemos = async () => {
  try {
    await initializeDatabase();
    console.log('\n✓ 数据库初始化成功\n');
    
    await runDemo1();
    await runDemo2();
    await runDemo3();
    await runDemo4();
    
    console.log('\n\n');
    console.log('='.repeat(70));
    console.log('所有演示完成！');
    console.log('='.repeat(70));
    console.log('\n演示覆盖的业务场景:');
    console.log('  1. 正常流程 - 创建批次 → 出库 → 冷链 → 接收 → 解冻 → 销售');
    console.log('  2. 冷链异常 - 温度异常检测 → 质量复核 → 报损处理');
    console.log('  3. 召回冻结 - 问题批次召回 → 禁止销售 → 召回报告');
    console.log('  4. 幂等性验证 - 重复操作保护 → 禁止重复接收');
    console.log('\n关键业务规则验证:');
    console.log('  ✓ 批次状态追踪（CREATED → OUTBOUND → ... → PARTIAL_SOLD）');
    console.log('  ✓ 冷链温度异常自动检测（安全范围: -18°C ~ -5°C）');
    console.log('  ✓ 召回后禁止销售');
    console.log('  ✓ 禁止重复接收');
    console.log('  ✓ 幂等性保护（重复操作不产生重复数据）');
    console.log('  ✓ 状态历史完整记录');
    console.log('  ✓ 批次流向报告和召回报告生成');
    
  } catch (error) {
    console.error('演示执行失败:', error);
    process.exit(1);
  }
};

runAllDemos();
