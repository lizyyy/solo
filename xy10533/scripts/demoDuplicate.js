const { api, log, delay } = require('./demoHelper');

const demoDuplicateFlow = async () => {
  log.title('演示 4: 重复操作验证（幂等性 + 重复接收）');
  log.info('场景: 验证系统幂等性和防止重复接收的规则');
  
  try {
    // 步骤 1: 创建基础数据
    log.step(1, '准备基础数据');
    
    const storeResult = await api.post('/stores', {
      store_name: '深圳南山店',
      store_code: 'STORE_SZ_DEMO04',
      city: '深圳',
      address: '深圳市南山区科技园'
    }, 'admin');
    
    if (!storeResult.success) {
      log.error(storeResult.error);
      return;
    }
    const storeId = storeResult.data.id;
    log.success('门店创建成功');
    
    const batchResult = await api.post('/batches', {
      product_name: '鱼香肉丝预制菜',
      product_code: 'PROD_YXR_DEMO04',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 50,
      unit: '箱'
    }, 'kitchen_manager');
    
    if (!batchResult.success) {
      log.error(batchResult.error);
      return;
    }
    const batchId = batchResult.data.id;
    log.success('批次创建成功');
    
    // 步骤 2: 出库
    log.step(2, '出库 - 20箱');
    
    const outboundResult = await api.post('/outbound', {
      batch_id: batchId,
      quantity: 20,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    
    if (!outboundResult.success) {
      log.error(outboundResult.error);
      return;
    }
    const outboundId = outboundResult.data.id;
    log.success('第一次出库成功');
    
    // 验证幂等性 - 尝试重复出库（相同时间）
    log.section('验证幂等性 - 重复出库（相同参数）');
    log.info('尝试使用相同参数再次出库...');
    
    const duplicateOutboundResult = await api.post('/outbound', {
      batch_id: batchId,
      quantity: 20,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    
    if (duplicateOutboundResult.success) {
      log.success('幂等性生效 - 返回第一次出库结果，不重复创建');
      log.info(`  出库ID一致: ${duplicateOutboundResult.data.id === outboundId ? '是 ✓' : '否 ✗'}`);
    } else {
      log.error('幂等性验证失败');
    }
    
    // 步骤 3: 冷链运输
    log.step(3, '开始冷链运输');
    
    const coldChainResult = await api.post('/cold-chain/start', {
      batch_id: batchId,
      store_id: storeId,
      outbound_record_id: outboundId,
      transport_start_time: '2026-05-12 09:00:00'
    }, 'logistics_manager');
    
    if (!coldChainResult.success) {
      log.error(coldChainResult.error);
      return;
    }
    const coldChainId = coldChainResult.data.id;
    log.success('冷链开始');
    
    // 完成冷链
    const completeColdChainResult = await api.post(`/cold-chain/${coldChainId}/complete`, {
      transport_end_time: '2026-05-12 11:00:00',
      temperature_log: [
        { time: '2026-05-12 09:00:00', temperature: -18 },
        { time: '2026-05-12 11:00:00', temperature: -17 }
      ]
    }, 'logistics_manager');
    
    log.success('冷链完成');
    
    // 步骤 4: 第一次接收
    log.step(4, '第一次门店接收');
    
    const firstReceiveResult = await api.post('/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 11:30:00',
      remarks: '第一次接收'
    }, 'store_manager_sz');
    
    if (!firstReceiveResult.success) {
      log.error(firstReceiveResult.error);
      return;
    }
    log.success('第一次接收成功');
    
    // 查看库存
    const inventory1 = await api.get('/inventory');
    if (inventory1.success && inventory1.data.length > 0) {
      const inv = inventory1.data.find(i => i.batch_id === batchId);
      if (inv) {
        log.info(`当前库存: ${inv.quantity}箱`);
      }
    }
    
    // 步骤 5: 验证重复接收
    log.step(5, '验证禁止重复接收规则');
    log.info('尝试使用相同冷链记录再次接收...');
    
    const duplicateReceiveResult = await api.post('/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 12:00:00',
      remarks: '第二次尝试接收'
    }, 'store_manager_sz');
    
    if (duplicateReceiveResult.success) {
      log.error('错误: 应该禁止重复接收！');
    } else {
      log.success('规则生效 - 禁止重复接收');
      log.info(`  错误信息: ${duplicateReceiveResult.error}`);
    }
    
    // 验证库存没有增加
    const inventory2 = await api.get('/inventory');
    if (inventory2.success && inventory2.data.length > 0) {
      const inv = inventory2.data.find(i => i.batch_id === batchId);
      if (inv) {
        log.info(`库存验证: ${inv.quantity}箱 (应该还是20箱)`);
      }
    }
    
    // 步骤 6: 验证其他幂等性
    log.step(6, '验证创建批次幂等性');
    log.info('尝试创建相同产品代码和生产日期的批次...');
    
    const duplicateBatchResult = await api.post('/batches', {
      product_name: '鱼香肉丝预制菜',
      product_code: 'PROD_YXR_DEMO04',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 50,
      unit: '箱'
    }, 'kitchen_manager');
    
    if (duplicateBatchResult.success) {
      log.success('幂等性生效 - 返回已存在的批次');
      log.info(`  批次ID一致: ${duplicateBatchResult.data.id === batchId ? '是 ✓' : '否 ✗'}`);
    }
    
    // 步骤 7: 验证召回幂等性
    log.step(7, '验证召回幂等性');
    
    // 先执行第一次召回
    const recallResult = await api.post('/recalls', {
      batch_id: batchId,
      recall_reason: '测试召回',
      recall_time: '2026-05-12 15:00:00'
    }, 'quality_manager');
    
    if (!recallResult.success) {
      log.error(recallResult.error);
      return;
    }
    log.success('第一次召回成功');
    
    // 尝试重复召回
    log.info('尝试重复召回...');
    const duplicateRecallResult = await api.post('/recalls', {
      batch_id: batchId,
      recall_reason: '测试召回',
      recall_time: '2026-05-12 15:00:00'
    }, 'quality_manager');
    
    if (duplicateRecallResult.success) {
      log.success('幂等性生效 - 返回第一次召回结果');
    } else {
      log.info(`  提示: ${duplicateRecallResult.error}`);
    }
    
    // 步骤 8: 查看完整历史记录
    log.step(8, '查看状态历史记录（验证幂等操作没有产生重复历史）');
    
    const batchDetail = await api.get(`/batches/${batchId}`);
    log.section('状态变更历史');
    batchDetail.data.history.forEach((h, idx) => {
      log.info(`${idx + 1}. [${h.created_at}] ${h.action}: ${h.from_status || '无'} -> ${h.to_status}`);
    });
    log.info(`\n总历史记录数: ${batchDetail.data.history.length}`);
    log.info('(幂等操作不会产生重复的历史记录)');
    
    // 步骤 9: 人工修正演示
    log.step(9, '人工修正演示 - 必须留下前后差异和操作者');
    
    // 先获取库存ID
    const inventory3 = await api.get('/inventory');
    let inventoryId = null;
    if (inventory3.success && inventory3.data.length > 0) {
      const inv = inventory3.data.find(i => i.batch_id === batchId);
      if (inv) {
        inventoryId = inv.id;
      }
    }
    
    if (inventoryId) {
      log.info('模拟盘点发现库存差异，需要人工修正...');
      log.info('修正前: 冷冻库存应该是 20 箱，但实际盘点只有 18 箱');
      
      const correctionResult = await api.post('/manual-correction', {
        entity_type: 'STORE_INVENTORY',
        entity_id: inventoryId,
        corrections: {
          frozen_quantity: 18
        },
        reason: '盘点发现差异，系统记录20箱，实际只有18箱，可能是发货时少发'
      }, 'inventory_auditor');
      
      if (correctionResult.success) {
        log.success('人工修正成功');
        log.section('修正记录详情');
        log.info(`操作人: ${correctionResult.data.operator}`);
        log.info(`原因: ${correctionResult.data.reason}`);
        log.info(`修正前 - 冷冻库存: ${correctionResult.data.before_data.frozen_quantity}箱`);
        log.info(`修正后 - 冷冻库存: ${correctionResult.data.after_data.frozen_quantity}箱`);
      }
    }
    
    log.title('重复操作和幂等性演示完成！');
    log.result('验证的规则:');
    log.result('  ✓ 出库幂等性 - 相同参数不重复创建');
    log.result('  ✓ 批次创建幂等性 - 相同产品代码和生产日期不重复创建');
    log.result('  ✓ 禁止重复接收 - 同一冷链记录只能接收一次');
    log.result('  ✓ 人工修正留痕 - 保存前后差异、操作者和原因');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

demoDuplicateFlow();
