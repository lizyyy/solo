const traceabilityService = require('./traceabilityService');
const { getStatusHistory } = require('../utils');

const generateBatchFlowReport = async (batchId) => {
  const batchDetail = await traceabilityService.getBatchDetail(batchId);
  
  if (!batchDetail) {
    throw new Error('批次不存在');
  }
  
  const { batch, history, outbound_records, cold_chain_records, 
          receive_records, thaw_records, sale_records, 
          recall_records, damage_records, inventory_records } = batchDetail;
  
  // 计算统计数据
  const totalSold = sale_records.reduce((sum, r) => sum + r.quantity, 0);
  const totalDamaged = damage_records.reduce((sum, r) => sum + r.quantity, 0);
  
  // 计算召回覆盖率
  const totalInStores = inventory_records.reduce((sum, r) => 
    sum + r.quantity + r.sold_quantity + r.damaged_quantity + r.recalled_quantity, 0
  );
  const totalRecalled = inventory_records.reduce((sum, r) => sum + r.recalled_quantity, 0);
  const recallCoverage = totalInStores > 0 ? (totalRecalled / totalInStores * 100).toFixed(2) : 0;
  
  // 构建流向路径
  const flowPath = [];
  
  flowPath.push({
    step: '创建批次',
    status: batch.status === 'CREATED' ? 'CURRENT' : 'COMPLETED',
    timestamp: batch.created_at,
    details: `产品: ${batch.product_name}, 数量: ${batch.quantity}${batch.unit}`
  });
  
  if (outbound_records.length > 0) {
    const outbound = outbound_records[0];
    flowPath.push({
      step: '中央厨房出库',
      status: 'COMPLETED',
      timestamp: outbound.outbound_time,
      details: `出库数量: ${outbound.quantity}${batch.unit}, 操作人: ${outbound.created_by}`
    });
  }
  
  if (cold_chain_records.length > 0) {
    const coldChain = cold_chain_records[0];
    flowPath.push({
      step: '冷链运输',
      status: coldChain.status === 'IN_TRANSIT' ? 'IN_PROGRESS' : 'COMPLETED',
      timestamp: coldChain.transport_start_time,
      details: coldChain.is_abnormal 
        ? `异常! 最高温度: ${coldChain.max_temperature}°C, 原因: ${coldChain.abnormal_reason}`
        : `平均温度: ${coldChain.avg_temperature}°C, 状态: ${coldChain.status}`
    });
  }
  
  if (receive_records.length > 0) {
    const receive = receive_records[0];
    flowPath.push({
      step: '门店接收',
      status: 'COMPLETED',
      timestamp: receive.receive_time,
      details: `接收数量: ${receive.quantity}${batch.unit}, 操作人: ${receive.operator}`
    });
  }
  
  if (thaw_records.length > 0) {
    thaw_records.forEach(thaw => {
      flowPath.push({
        step: '解冻',
        status: thaw.status === 'THAWING' ? 'IN_PROGRESS' : 'COMPLETED',
        timestamp: thaw.thaw_start_time,
        details: thaw.is_overtime 
          ? `超时! 数量: ${thaw.quantity}${batch.unit}, 状态: ${thaw.status}`
          : `数量: ${thaw.quantity}${batch.unit}, 状态: ${thaw.status}`
      });
    });
  }
  
  if (sale_records.length > 0) {
    const lastSale = sale_records[0];
    flowPath.push({
      step: '销售',
      status: 'COMPLETED',
      timestamp: lastSale.sale_time,
      details: `已售: ${totalSold}${batch.unit}, 最近销售时间: ${lastSale.sale_time}`
    });
  }
  
  if (recall_records.length > 0) {
    const recall = recall_records[0];
    flowPath.push({
      step: '召回',
      status: recall.status === 'ACTIVE' ? 'IN_PROGRESS' : 'COMPLETED',
      timestamp: recall.recall_time,
      details: `原因: ${recall.recall_reason}, 覆盖率: ${recallCoverage}%, 操作人: ${recall.operator}`
    });
  }
  
  return {
    report_type: 'BATCH_FLOW',
    generated_at: new Date().toISOString(),
    batch_info: {
      id: batch.id,
      product_name: batch.product_name,
      product_code: batch.product_code,
      production_date: batch.production_date,
      expiry_date: batch.expiry_date,
      total_quantity: batch.quantity,
      unit: batch.unit,
      current_status: batch.status
    },
    statistics: {
      total_in_transit: batch.status === 'IN_TRANSIT' ? batch.quantity : 0,
      total_in_stores: inventory_records.reduce((sum, r) => sum + r.quantity, 0),
      total_frozen: inventory_records.reduce((sum, r) => sum + r.frozen_quantity, 0),
      total_thawed: inventory_records.reduce((sum, r) => sum + r.thawed_quantity, 0),
      total_sold: totalSold,
      total_damaged: totalDamaged,
      total_recalled: totalRecalled,
      recall_coverage: `${recallCoverage}%`
    },
    flow_path: flowPath,
    full_history: history,
    inventory_by_store: inventory_records.map(inv => ({
      store_id: inv.store_id,
      store_name: inv.store_name,
      store_code: inv.store_code,
      total: inv.quantity,
      frozen: inv.frozen_quantity,
      thawed: inv.thawed_quantity,
      sold: inv.sold_quantity,
      recalled: inv.recalled_quantity,
      damaged: inv.damaged_quantity
    }))
  };
};

const generateStoreInventoryReport = async (storeId = null) => {
  const inventoryRecords = await traceabilityService.getStoreInventory(storeId);
  
  // 按门店分组
  const inventoryByStore = {};
  inventoryRecords.forEach(inv => {
    const key = inv.store_id;
    if (!inventoryByStore[key]) {
      inventoryByStore[key] = {
        store_id: inv.store_id,
        store_name: inv.store_name,
        store_code: inv.store_code,
        batches: [],
        total_value: 0,
        total_frozen: 0,
        total_thawed: 0,
        total_sold: 0,
        total_damaged: 0
      };
    }
    inventoryByStore[key].batches.push({
      batch_id: inv.batch_id,
      product_name: inv.product_name,
      product_code: inv.product_code,
      production_date: inv.production_date,
      expiry_date: inv.expiry_date,
      batch_status: inv.batch_status,
      quantity: inv.quantity,
      frozen_quantity: inv.frozen_quantity,
      thawed_quantity: inv.thawed_quantity,
      sold_quantity: inv.sold_quantity,
      recalled_quantity: inv.recalled_quantity,
      damaged_quantity: inv.damaged_quantity
    });
    inventoryByStore[key].total_frozen += inv.frozen_quantity;
    inventoryByStore[key].total_thawed += inv.thawed_quantity;
    inventoryByStore[key].total_sold += inv.sold_quantity;
    inventoryByStore[key].total_damaged += inv.damaged_quantity;
  });
  
  // 计算全局统计
  const globalStats = {
    total_stores: Object.keys(inventoryByStore).length,
    total_batches: inventoryRecords.length,
    total_frozen: inventoryRecords.reduce((sum, r) => sum + r.frozen_quantity, 0),
    total_thawed: inventoryRecords.reduce((sum, r) => sum + r.thawed_quantity, 0),
    total_sold: inventoryRecords.reduce((sum, r) => sum + r.sold_quantity, 0),
    total_damaged: inventoryRecords.reduce((sum, r) => sum + r.damaged_quantity, 0),
    total_recalled: inventoryRecords.reduce((sum, r) => sum + r.recalled_quantity, 0)
  };
  
  return {
    report_type: 'STORE_INVENTORY',
    generated_at: new Date().toISOString(),
    global_statistics: globalStats,
    inventory_by_store: Object.values(inventoryByStore)
  };
};

const generateRecallReport = async (batchId) => {
  const batchDetail = await traceabilityService.getBatchDetail(batchId);
  
  if (!batchDetail) {
    throw new Error('批次不存在');
  }
  
  const { batch, recall_records, inventory_records, sale_records } = batchDetail;
  
  if (recall_records.length === 0) {
    throw new Error('该批次没有召回记录');
  }
  
  const recall = recall_records[0];
  
  // 计算召回统计
  const totalDistributed = inventory_records.reduce((sum, r) => 
    sum + r.quantity + r.sold_quantity + r.damaged_quantity + r.recalled_quantity, 0
  );
  const totalInStores = inventory_records.reduce((sum, r) => sum + r.quantity, 0);
  const totalSold = sale_records.reduce((sum, r) => sum + r.quantity, 0);
  const totalRecalled = inventory_records.reduce((sum, r) => sum + r.recalled_quantity, 0);
  const totalRemainingToRecall = totalInStores;
  
  const coverageRate = totalDistributed > 0 ? (totalRecalled / totalDistributed * 100).toFixed(2) : 0;
  
  // 按门店细分
  const storeBreakdown = inventory_records.map(inv => ({
    store_id: inv.store_id,
    store_name: inv.store_name,
    store_code: inv.store_code,
    total_received: inv.quantity + inv.sold_quantity + inv.damaged_quantity + inv.recalled_quantity,
    remaining_in_store: inv.quantity,
    sold: inv.sold_quantity,
    damaged: inv.damaged_quantity,
    recalled: inv.recalled_quantity,
    recall_status: inv.quantity > 0 ? '待召回' : '已完成'
  }));
  
  return {
    report_type: 'RECALL',
    generated_at: new Date().toISOString(),
    recall_info: {
      batch_id: batch.id,
      product_name: batch.product_name,
      product_code: batch.product_code,
      recall_reason: recall.recall_reason,
      recall_time: recall.recall_time,
      operator: recall.operator,
      status: recall.status
    },
    recall_statistics: {
      total_distributed: totalDistributed,
      total_sold: totalSold,
      total_in_stores: totalInStores,
      total_recalled: totalRecalled,
      total_remaining_to_recall: totalRemainingToRecall,
      coverage_rate: `${coverageRate}%`
    },
    store_breakdown: storeBreakdown
  };
};

module.exports = {
  generateBatchFlowReport,
  generateStoreInventoryReport,
  generateRecallReport
};
