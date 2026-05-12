const { api, log, delay } = require('./demoHelper');

const demoRecallFlow = async () => {
  log.title('演示 3: 召回冻结流程');
  log.info('场景: 红烧肉预制菜批次发现质量问题，启动召回，已售出和未售出的追踪');
  
  try {
    // 步骤 1: 创建门店和批次
    log.step(1, '准备基础数据 - 创建门店和批次');
    
    const storeResult = await api.post('/stores', {
      store_name: '广州天河店',
      store_code: 'STORE_GZ_DEMO03',
      city: '广州',
      address: '广州市天河区珠江新城华夏路30号'
    }, 'admin');
    
    if (!storeResult.success) {
      log.error(storeResult.error);
      return;
    }
    const storeId = storeResult.data.id;
    log.success('门店创建成功', { id: storeId, name: storeResult.data.store_name });
    
    const batchResult = await api.post('/batches', {
      product_name: '红烧肉预制菜',
      product_code: 'PROD_HSR_DEMO03',
      production_date: '2026-05-12',
      expiry_date: '2026-08-12',
      quantity: 60,
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
    
    // 步骤 2: 正常流程到销售
    log.step(2, '正常流程 - 出库、冷链、接收、解冻、部分销售');
    
    // 出库
    const outboundResult = await api.post('/outbound', {
      batch_id: batchId,
      quantity: 40,
      outbound_time: '2026-05-12 06:00:00'
    }, 'warehouse_manager');
    
    if (!outboundResult.success) {
      log.error(outboundResult.error);
      return;
    }
    const outboundId = outboundResult.data.id;
    log.success('出库 - 40箱');
    
    // 冷链开始
    const coldChainResult = await api.post('/cold-chain/start', {
      batch_id: batchId,
      store_id: storeId,
      outbound_record_id: outboundId,
      transport_start_time: '2026-05-12 07:00:00'
    }, 'logistics_manager');
    
    if (!coldChainResult.success) {
      log.error(coldChainResult.error);
      return;
    }
    const coldChainId = coldChainResult.data.id;
    log.success('冷链开始');
    
    // 冷链完成（正常）
    const completeColdChainResult = await api.post(`/cold-chain/${coldChainId}/complete`, {
      transport_end_time: '2026-05-12 10:00:00',
      temperature_log: [
        { time: '2026-05-12 07:00:00', temperature: -18 },
        { time: '2026-05-12 08:30:00', temperature: -16 },
        { time: '2026-05-12 10:00:00', temperature: -17 }
      ]
    }, 'logistics_manager');
    
    log.success('冷链完成（正常温度）');
    
    // 接收
    const receiveResult = await api.post('/receive', {
      cold_chain_record_id: coldChainId,
      receive_time: '2026-05-12 10:30:00',
      remarks: '正常接收'
    }, 'store_manager_gz');
    
    log.success('门店接收 - 40箱');
    
    // 解冻
    const thawResult = await api.post('/thaw/start', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 20,
      thaw_start_time: '2026-05-12 11:00:00',
      expected_thaw_time: '2026-05-12 17:00:00'
    }, 'chef_gz');
    
    if (!thawResult.success) {
      log.error(thawResult.error);
      return;
    }
    const thawId = thawResult.data.id;
    log.success('开始解冻 - 20箱');
    
    // 完成解冻
    const completeThawResult = await api.post(`/thaw/${thawId}/complete`, {
      thaw_end_time: '2026-05-12 16:30:00'
    }, 'chef_gz');
    
    log.success('完成解冻');
    
    // 销售 - 卖出15箱
    const saleResult = await api.post('/sales', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 15,
      sale_time: '2026-05-12 18:00:00'
    }, 'cashier_gz');
    
    log.success('销售 - 15箱');
    
    // 查看当前库存
    log.section('当前库存状态（召回前）');
    const inventory1 = await api.get('/inventory');
    if (inventory1.success && inventory1.data.length > 0) {
      const inv = inventory1.data.find(i => i.batch_id === batchId);
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
    
    const recallResult = await api.post('/recalls', {
      batch_id: batchId,
      recall_reason: '该批次调料包检测出微生物超标，存在食品安全风险',
      recall_time: '2026-05-12 20:00:00'
    }, 'quality_manager');
    
    if (!recallResult.success) {
      log.error(recallResult.error);
      return;
    }
    log.success('召回启动成功', { 
      reason: recallResult.data.recall_reason,
      operator: recallResult.data.operator
    });
    
    // 查看批次状态
    const batchDetail1 = await api.get(`/batches/${batchId}`);
    log.info(`批次状态变化: PARTIAL_SOLD -> ${batchDetail1.data.batch.status}`);
    
    // 步骤 4: 验证召回后禁止销售
    log.step(4, '验证召回后禁止销售规则');
    log.info('尝试销售召回批次...');
    
    const trySaleResult = await api.post('/sales', {
      batch_id: batchId,
      store_id: storeId,
      quantity: 5,
      sale_time: '2026-05-12 20:30:00'
    }, 'cashier_gz');
    
    if (trySaleResult.success) {
      log.error('错误: 召回批次应该禁止销售！');
    } else {
      log.success('规则生效 - 召回批次禁止销售');
      log.info(`  错误信息: ${trySaleResult.error}`);
    }
    
    // 步骤 5: 生成召回报告
    log.step(5, '生成召回报告 - 分析召回覆盖率');
    
    const recallReportResult = await api.get(`/reports/recall/${batchId}`);
    if (recallReportResult.success) {
      const report = recallReportResult.data;
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
      report.store_breakdown.forEach(store => {
        log.info(`门店: ${store.store_name}`);
        log.info(`  总接收: ${store.total_received}箱, 已售: ${store.sold}箱`);
        log.info(`  门店剩余: ${store.remaining_in_store}箱, 召回状态: ${store.recall_status}`);
      });
    }
    
    // 步骤 6: 查看完整历史记录
    log.step(6, '查看完整状态历史记录');
    
    const finalBatchDetail = await api.get(`/batches/${batchId}`);
    log.section('状态变更历史');
    finalBatchDetail.data.history.forEach((h, idx) => {
      log.info(`${idx + 1}. [${h.created_at}]`);
      log.info(`   操作: ${h.action}`);
      log.info(`   状态: ${h.from_status || '无'} -> ${h.to_status}`);
      log.info(`   操作人: ${h.operator}`);
      if (h.reason) {
        log.info(`   原因: ${h.reason}`);
      }
      if (h.before_data || h.after_data) {
        log.info(`   有数据变更记录`);
      }
      log.info('');
    });
    
    // 步骤 7: 生成批次流向报告
    log.section('批次流向报告');
    const flowReportResult = await api.get(`/reports/batch-flow/${batchId}`);
    if (flowReportResult.success) {
      const report = flowReportResult.data;
      log.info(`流向步骤 (${report.flow_path.length}个环节):`);
      report.flow_path.forEach((step, idx) => {
        const statusIcon = step.status === 'COMPLETED' ? '✓' : 
                          step.status === 'IN_PROGRESS' ? '⏳' : 
                          step.status === 'CURRENT' ? '📍' : '→';
        log.info(`  ${statusIcon} ${idx + 1}. ${step.step}`);
        log.info(`     ${step.details}`);
      });
      
      log.section('统计汇总');
      log.info(`总数量: ${report.batch_info.total_quantity}箱`);
      log.info(`已售: ${report.statistics.total_sold}箱`);
      log.info(`门店库存: ${report.statistics.total_in_stores}箱`);
      log.info(`  冷冻: ${report.statistics.total_frozen}箱`);
      log.info(`  解冻: ${report.statistics.total_thawed}箱`);
    }
    
    log.title('召回流程演示完成！');
    log.result(`批次 ID: ${batchId}`);
    log.result(`召回原因: ${recallResult.data.recall_reason}`);
    log.result(`已售出: 15箱, 门店剩余: 25箱 (冷冻20箱 + 解冻5箱)`);
    log.result(`召回后状态: RECALLED（禁止销售）`);
    log.result('验证规则: 召回批次尝试销售被系统拒绝 ✓');
    
  } catch (error) {
    log.error('演示失败: ' + error.message);
    console.error(error);
  }
};

demoRecallFlow();
