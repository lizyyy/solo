const { api, log, delay } = require('./demoHelper');

const demoAbnormalFlow = async () => {
  log.title('演示 2: 冷链异常复核流程');
  log.info('场景: 麻婆豆腐预制菜批次冷链运输温度异常，需要复核处理');
  
  try {
    // 步骤 1: 创建门店和批次
    log.step(1, '准备基础数据 - 创建门店和批次');
    
    const storeResult = await api.post('/stores', {
      store_name: '上海浦东店',
      store_code: 'STORE_SH_DEMO02',
      city: '上海',
      address: '上海市浦东新区陆家嘴环路1000号'
    }, 'admin');
    
    if (!storeResult.success) {
      log.error(storeResult.error);
      return;
    }
    const storeId = storeResult.data.id;
    log.success('门店创建成功', { id: storeId, name: storeResult.data.store_name });
    
    const batchResult = await api.post('/batches', {
      product_name: '麻婆豆腐预制菜',
      product_code: 'PROD_MPD_DEMO02',
      production_date: '2026-05-11',
      expiry_date: '2026-08-11',
      quantity: 80,
      unit: '箱'
    }, 'kitchen_manager');
    
    if (!batchResult.success) {
      log.error(batchResult.error);
      return;
    }
    const batchId = batchResult.data.id;
    log.success('批次创建成功', { 
      id: batchId, 
      product: batchResult.data.product_name,
      status: batchResult.data.status
    });
    
    // 步骤 2: 出库
    log.step(2, '出库 - 30箱发往上海浦东店');
    const outboundResult = await api.post('/outbound', {
      batch_id: batchId,
      quantity: 30,
      outbound_time: '2026-05-12 07:00:00'
    }, 'warehouse_manager');
    
    if (!outboundResult.success) {
      log.error(outboundResult.error);
      return;
    }
    const outboundId = outboundResult.data.id;
    log.success('出库成功', { quantity: outboundResult.data.quantity });
    
    // 步骤 3: 开始冷链运输
    log.step(3, '开始冷链运输');
    const coldChainResult = await api.post('/cold-chain/start', {
      batch_id: batchId,
      store_id: storeId,
      outbound_record_id: outboundId,
      transport_start_time: '2026-05-12 08:00:00'
    }, 'logistics_manager');
    
    if (!coldChainResult.success) {
      log.error(coldChainResult.error);
      return;
    }
    const coldChainId = coldChainResult.data.id;
    log.success('冷链运输开始');
    
    // 步骤 4: 完成冷链运输 - 模拟温度异常
    log.step(4, '完成冷链运输 - 模拟温度异常（最高温度 2°C，超过安全范围）');
    log.info('安全温度范围: -18°C ~ -5°C');
    log.info('模拟异常: 运输途中制冷设备故障，温度飙升至 2°C');
    
    const completeColdChainResult = await api.post(`/cold-chain/${coldChainId}/complete`, {
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
    
    if (!completeColdChainResult.success) {
      log.error(completeColdChainResult.error);
      return;
    }
    
    log.success('冷链运输完成');
    log.section('冷链状态分析');
    log.info(`冷链状态: ${completeColdChainResult.data.status}`);
    log.info(`是否异常: ${completeColdChainResult.data.is_abnormal ? '是' : '否'}`);
    log.info(`异常原因: ${completeColdChainResult.data.abnormal_reason}`);
    log.info(`最高温度: ${completeColdChainResult.data.max_temperature}°C`);
    log.info(`最低温度: ${completeColdChainResult.data.min_temperature}°C`);
    log.info(`平均温度: ${completeColdChainResult.data.avg_temperature}°C`);
    
    // 查询批次状态变化
    const batchDetail1 = await api.get(`/batches/${batchId}`);
    log.info(`批次状态: ${batchDetail1.data.batch.status}`);
    
    // 步骤 5: 质量部门复核
    log.step(5, '质量部门复核 - 决定是否可以接收');
    log.info('质量专员检查温度记录和货物状态...');
    
    // 查看历史记录
    log.section('查看状态历史记录');
    const history = batchDetail1.data.history;
    log.info(`共有 ${history.length} 条状态变更记录:`);
    history.forEach((h, idx) => {
      log.info(`  ${idx + 1}. [${h.created_at}] ${h.action}: ${h.from_status || '无'} -> ${h.to_status}`);
      if (h.reason) {
        log.info(`     原因: ${h.reason}`);
      }
    });
    
    // 步骤 6: 门店接收（即使异常也可以接收，但会标记异常批次）
    log.step(6, '门店接收 - 接收异常批次等待进一步处理');
    const receiveResult = await api.post('/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 11:00:00',
      remarks: '冷链温度异常，货物已隔离等待质检'
    }, 'store_manager_sh');
    
    if (!receiveResult.success) {
      log.error(receiveResult.error);
      return;
    }
    log.success('接收成功', { remarks: receiveResult.data.remarks });
    
    // 查询批次状态
    const batchDetail2 = await api.get(`/batches/${batchId}`);
    log.info(`批次当前状态: ${batchDetail2.data.batch.status}`);
    
    // 步骤 7: 质量部门决定 - 报损处理
    log.step(7, '质量部门决定 - 因温度异常，全部报损');
    const damageResult = await api.post('/damages', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 30,
      damage_type: 'frozen',
      damage_reason: '冷链运输温度异常，存在食品安全风险',
      damage_time: '2026-05-12 14:00:00'
    }, 'quality_manager');
    
    if (!damageResult.success) {
      log.error(damageResult.error);
      return;
    }
    log.success('报损成功', { 
      quantity: damageResult.data.quantity,
      reason: damageResult.data.damage_reason
    });
    
    // 步骤 8: 人工修正（可选演示）
    log.step(8, '查询最终库存和状态');
    
    const finalInventory = await api.get('/inventory');
    if (finalInventory.success && finalInventory.data.length > 0) {
      const inv = finalInventory.data.find(i => i.batch_id === batchId);
      if (inv) {
        log.section('库存详情');
        log.info(`门店: ${inv.store_name}`);
        log.info(`  总库存: ${inv.quantity}箱`);
        log.info(`  冷冻: ${inv.frozen_quantity}箱, 解冻: ${inv.thawed_quantity}箱`);
        log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
      }
    }
    
    // 生成报告
    log.section('生成批次流向报告');
    const reportResult = await api.get(`/reports/batch-flow/${batchId}`);
    if (reportResult.success) {
      log.info(`批次: ${reportResult.data.batch_info.product_name}`);
      log.info(`最终状态: ${reportResult.data.batch_info.current_status}`);
      log.info(`报损数量: ${reportResult.data.statistics.total_damaged}箱`);
      log.info(`流向路径:`);
      reportResult.data.flow_path.forEach((step, idx) => {
        const statusIcon = step.status === 'COMPLETED' ? '✓' : (step.status.includes('ABNORMAL') ? '⚠' : '→');
        log.info(`  ${statusIcon} ${step.step}`);
        if (step.details.includes('异常')) {
          log.info(`     ${step.details}`);
        }
      });
    }
    
    log.title('冷链异常流程演示完成！');
    log.result(`批次 ID: ${batchId}`);
    log.result(`异常类型: 冷链运输温度过高 (最高 ${completeColdChainResult.data.max_temperature}°C)`);
    log.result(`处理结果: 全部报损 (${damageResult.data.quantity}箱)`);
    log.result('状态变化: CREATED -> OUTBOUND -> IN_TRANSIT -> ABNORMAL -> ABNORMAL (报损后)');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

demoAbnormalFlow();
