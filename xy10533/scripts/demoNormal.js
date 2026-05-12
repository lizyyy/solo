const { api, log, delay } = require('./demoHelper');

const demoNormalFlow = async () => {
  log.title('演示 1: 正常到店销售流程');
  log.info('场景: 宫保鸡丁预制菜批次从中央厨房 -> 冷链运输 -> 门店接收 -> 解冻 -> 销售');
  
  try {
    // 步骤 1: 创建门店
    log.step(1, '创建门店 - 北京朝阳店');
    const storeResult = await api.post('/stores', {
      store_name: '北京朝阳店',
      store_code: 'STORE_BJ_DEMO01',
      city: '北京',
      address: '北京市朝阳区建国路88号'
    }, 'admin');
    
    if (!storeResult.success) {
      log.error(storeResult.error);
      return;
    }
    const storeId = storeResult.data.id;
    log.success('门店创建成功', { id: storeId, name: storeResult.data.store_name });
    
    // 步骤 2: 创建批次
    log.step(2, '创建预制菜批次 - 宫保鸡丁');
    const batchResult = await api.post('/batches', {
      product_name: '宫保鸡丁预制菜',
      product_code: 'PROD_GBC_DEMO01',
      production_date: '2026-05-10',
      expiry_date: '2026-08-10',
      quantity: 100,
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
      status: batchResult.data.status,
      quantity: batchResult.data.quantity
    });
    
    // 步骤 3: 出库
    log.step(3, '中央厨房出库 - 50箱发往北京朝阳店');
    const outboundResult = await api.post('/outbound', {
      batch_id: batchId,
      quantity: 50,
      outbound_time: '2026-05-12 08:00:00'
    }, 'warehouse_manager');
    
    if (!outboundResult.success) {
      log.error(outboundResult.error);
      return;
    }
    const outboundId = outboundResult.data.id;
    log.success('出库成功', { 
      id: outboundId, 
      quantity: outboundResult.data.quantity
    });
    
    // 查询当前批次状态
    log.section('查询当前批次状态');
    const batchDetail1 = await api.get(`/batches/${batchId}`);
    log.info(`批次当前状态: ${batchDetail1.data.batch.status}`);
    
    // 步骤 4: 开始冷链运输
    log.step(4, '开始冷链运输');
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
    log.success('冷链运输开始', { 
      id: coldChainId, 
      status: coldChainResult.data.status,
      start_time: coldChainResult.data.transport_start_time
    });
    
    // 步骤 5: 完成冷链运输（正常温度）
    log.step(5, '完成冷链运输 - 温度正常 (-18°C ~ -5°C)');
    const completeColdChainResult = await api.post(`/cold-chain/${coldChainId}/complete`, {
      transport_end_time: '2026-05-12 11:30:00',
      temperature_log: [
        { time: '2026-05-12 09:00:00', temperature: -18 },
        { time: '2026-05-12 10:00:00', temperature: -17 },
        { time: '2026-05-12 11:00:00', temperature: -16 },
        { time: '2026-05-12 11:30:00', temperature: -15 }
      ]
    }, 'logistics_manager');
    
    if (!completeColdChainResult.success) {
      log.error(completeColdChainResult.error);
      return;
    }
    log.success('冷链运输完成', { 
      status: completeColdChainResult.data.status,
      is_abnormal: completeColdChainResult.data.is_abnormal,
      avg_temp: completeColdChainResult.data.avg_temperature
    });
    
    // 步骤 6: 门店接收
    log.step(6, '北京朝阳店接收货物');
    const receiveResult = await api.post('/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 12:00:00',
      remarks: '货物完好，数量无误'
    }, 'store_manager_bj');
    
    if (!receiveResult.success) {
      log.error(receiveResult.error);
      return;
    }
    log.success('接收成功', { 
      quantity: receiveResult.data.quantity,
      operator: receiveResult.data.operator
    });
    
    // 查询库存
    log.section('查询门店库存');
    const inventory1 = await api.get('/inventory');
    if (inventory1.success && inventory1.data.length > 0) {
      const inv = inventory1.data[0];
      log.info(`门店: ${inv.store_name}, 总库存: ${inv.quantity}箱`);
      log.info(`  冷冻: ${inv.frozen_quantity}箱, 解冻: ${inv.thawed_quantity}箱`);
      log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
    }
    
    // 步骤 7: 开始解冻
    log.step(7, '开始解冻 - 10箱');
    const thawResult = await api.post('/thaw/start', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 10,
      thaw_start_time: '2026-05-12 14:00:00',
      expected_thaw_time: '2026-05-12 20:00:00'
    }, 'chef_bj');
    
    if (!thawResult.success) {
      log.error(thawResult.error);
      return;
    }
    const thawId = thawResult.data.id;
    log.success('解冻开始', { 
      id: thawId,
      quantity: thawResult.data.quantity,
      status: thawResult.data.status
    });
    
    // 步骤 8: 完成解冻
    log.step(8, '完成解冻 - 正常时间内完成');
    const completeThawResult = await api.post(`/thaw/${thawId}/complete`, {
      thaw_end_time: '2026-05-12 19:30:00'
    }, 'chef_bj');
    
    if (!completeThawResult.success) {
      log.error(completeThawResult.error);
      return;
    }
    log.success('解冻完成', { 
      status: completeThawResult.data.status,
      is_overtime: completeThawResult.data.is_overtime
    });
    
    // 步骤 9: 销售
    log.step(9, '销售 - 卖出5箱');
    const saleResult = await api.post('/sales', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 5,
      sale_time: '2026-05-12 21:00:00'
    }, 'cashier_bj');
    
    if (!saleResult.success) {
      log.error(saleResult.error);
      return;
    }
    log.success('销售成功', { 
      quantity: saleResult.data.quantity,
      operator: saleResult.data.operator
    });
    
    // 最终查询
    log.section('最终状态查询');
    const finalBatchDetail = await api.get(`/batches/${batchId}`);
    log.info(`批次最终状态: ${finalBatchDetail.data.batch.status}`);
    
    const finalInventory = await api.get('/inventory');
    if (finalInventory.success && finalInventory.data.length > 0) {
      const inv = finalInventory.data[0];
      log.info(`门店: ${inv.store_name}`);
      log.info(`  总库存: ${inv.quantity}箱 (冷冻: ${inv.frozen_quantity}, 解冻: ${inv.thawed_quantity})`);
      log.info(`  已售: ${inv.sold_quantity}箱, 报损: ${inv.damaged_quantity}箱`);
    }
    
    // 生成报告
    log.section('生成批次流向报告');
    const reportResult = await api.get(`/reports/batch-flow/${batchId}`);
    if (reportResult.success) {
      log.info(`报告类型: ${reportResult.data.report_type}`);
      log.info(`批次: ${reportResult.data.batch_info.product_name}`);
      log.info(`流向步骤: ${reportResult.data.flow_path.length} 个环节`);
      reportResult.data.flow_path.forEach((step, idx) => {
        log.info(`  ${idx + 1}. ${step.step} - ${step.status}`);
      });
      log.info(`统计: 已售 ${reportResult.data.statistics.total_sold}箱, 库存 ${reportResult.data.statistics.total_in_stores}箱`);
    }
    
    log.title('正常流程演示完成！');
    log.result(`批次 ID: ${batchId}`);
    log.result(`门店 ID: ${storeId}`);
    log.result('流程: 创建批次 -> 出库 -> 冷链运输 -> 门店接收 -> 解冻 -> 销售');
    log.result('状态变化: CREATED -> OUTBOUND -> IN_TRANSIT -> RECEIVED -> THAWING -> THAWED -> PARTIAL_SOLD');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

demoNormalFlow();
