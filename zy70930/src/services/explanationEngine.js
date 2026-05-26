const DISCREPANCY_EXPLANATIONS = {
  cross_store_redemption: {
    template: (details) => {
      const { packageCode, purchaseStore, redeemStore, customerName, workOrderNo } = details;
      return {
        title: '跨店核销',
        summary: `客户【${customerName || '未知客户'}】的套餐在【${purchaseStore}】购买，却在【${redeemStore}】核销使用`,
        detail: `套餐编号: ${packageCode}，关联工单号: ${workOrderNo}`,
        businessImpact: '这是连锁门店常见的正常业务场景，客户有权在任意门店使用套餐。请确认：\n1. 跨店结算流程是否合规\n2. 门店间费用分摊是否完成\n3. 是否有异常操作',
        recommendation: '如属于正常业务，可标记为"放行"，否则需核实并完善跨店结算流程。',
        affectedParties: [purchaseStore, redeemStore],
        relatedDocuments: ['跨店结算协议', '套餐通用条款']
      };
    }
  },

  item_replacement: {
    template: (details) => {
      const { originalItem, newItem, reason, workOrderNo } = details;
      return {
        title: '项目替换',
        summary: `工单项目【${originalItem}】被替换为【${newItem}】`,
        detail: `工单号: ${workOrderNo}，替换原因: ${reason}`,
        businessImpact: '项目替换可能导致套餐内容变更，需检查：\n1. 是否经过客户同意\n2. 替换项目价格是否合理\n3. 库存扣减是否正确',
        recommendation: '核实替换原因是否合理，如有客户签字确认可标记为"放行"，否则需补充材料或退回。',
        affectedParties: ['服务顾问', '客户', '库房'],
        relatedDocuments: ['项目替换审批单', '客户签字确认单']
      };
    }
  },

  inventory_shortage: {
    template: (details) => {
      const { partCode, partName, expectedClosing, actualClosing, difference, relatedOrders, storeName } = details;
      const diffQty = Math.abs(difference || 0);
      const orderList = relatedOrders?.map(o => o.orderNo).join(', ') || '无';
      return {
        title: '库存盘亏',
        summary: `【${storeName || '门店'}】配件【${partName}(${partCode})】库存短缺${diffQty}件`,
        detail: `理论结存: ${expectedClosing}件，实际结存: ${actualClosing}件`,
        businessImpact: `库存短缺可能由以下原因导致：\n1. 工单登记错误\n2. 配件失窃或损耗\n3. 采购入库未登记\n4. 退换货处理不当\n\n请核实相关工单：${orderList}`,
        recommendation: '请库房盘点并确认缺失件去向，如属正常损耗可调整库存记录，如属人为原因需追究责任。',
        affectedParties: ['库房管理员', '财务'],
        relatedDocuments: ['库存盘点表', '库存调整单']
      };
    }
  },

  inventory_surplus: {
    template: (details) => {
      const { partCode, partName, expectedClosing, actualClosing, difference, storeName } = details;
      const diffQty = difference || 0;
      return {
        title: '库存盘盈',
        summary: `【${storeName || '门店'}】配件【${partName}(${partCode})】库存多出${diffQty}件`,
        detail: `理论结存: ${expectedClosing}件，实际结存: ${actualClosing}件`,
        businessImpact: '库存盘盈可能由以下原因导致：\n1. 采购入库多登记\n2. 客户退库未登记\n3. 前期盘点错误\n4. 供应商多送货',
        recommendation: '请查明多出来源，如属正常盘盈做入库处理。',
        affectedParties: ['库房管理员', '财务'],
        relatedDocuments: ['库存盘点表', '库存调整单']
      };
    }
  },

  package_usage_mismatch: {
    template: (details) => {
      const { packageCode, workOrderNo, itemCode } = details;
      return {
        title: '套餐项目不匹配',
        summary: `工单项目【${itemCode}】不在套餐【${packageCode}】包含范围内`,
        detail: `工单号: ${workOrderNo}`,
        businessImpact: '这可能是：\n1. 服务顾问操作失误选错套餐\n2. 客户额外付费添加项目\n3. 系统套餐配置错误',
        recommendation: '核实客户是否同意额外付费，如同意需补充计费，否则退回处理。',
        affectedParties: ['服务顾问', '客户', '收银员'],
        relatedDocuments: ['工单明细', '套餐配置表']
      };
    }
  },

  quantity_mismatch: {
    template: (details) => {
      const { packageCode, workOrderNo, itemCode, packageQty, usedQty } = details;
      return {
        title: '使用数量不符',
        summary: `工单使用【${itemCode}】数量(${usedQty}件)超出套餐包含数量(${packageQty}件)`,
        detail: `套餐: ${packageCode}，工单: ${workOrderNo}`,
        businessImpact: '使用数量超出套餐范围，可能：\n1. 客户重复使用\n2. 录入错误\n3. 套餐次数已用完',
        recommendation: '核实客户是否同意额外付费，超出部分是否已收费。',
        affectedParties: ['服务顾问', '客户'],
        relatedDocuments: ['工单明细', '套餐使用记录']
      };
    }
  },

  price_mismatch: {
    template: (details) => {
      const { partCode, partName, inventoryPrice, orderPrice, workOrderNo } = details;
      const diff = (orderPrice - inventoryPrice).toFixed(2);
      const direction = diff > 0 ? '高' : '低';
      return {
        title: '价格差异',
        summary: `【${partName}(${partCode})】工单单价比库存单价${direction}${Math.abs(diff)}元`,
        detail: `库存单价: ${inventoryPrice}元，工单单价: ${orderPrice}元，工单号: ${workOrderNo}`,
        businessImpact: '价格差异原因可能是：\n1. 价格调整未同步\n2. 工单录入错误\n3. 特殊折扣\n4. 供应商调价',
        recommendation: '核实价格差异原因，如属正常折扣可放行，否则调整工单价格。',
        affectedParties: ['服务顾问', '收银员', '财务'],
        relatedDocuments: ['价格调整审批单']
      };
    }
  },

  missing_package: {
    template: (details) => {
      const { workOrderNo, itemCode } = details;
      return {
        title: '套餐不存在',
        summary: `工单【${workOrderNo}】引用的套餐不存在`,
        detail: `项目代码: ${itemCode}`,
        businessImpact: '这是严重数据问题：\n1. 可能是数据导入错误\n2. 套餐已被删除\n3. 系统ID引用错误',
        recommendation: '请核对原始数据，重新导入正确的套餐数据。',
        affectedParties: ['数据录入员', 'IT'],
        relatedDocuments: ['原始导入文件']
      };
    }
  },

  missing_work_order: {
    template: (details) => {
      const { packageCode, customerName, totalAmount } = details;
      return {
        title: '缺少工单',
        summary: `套餐【${packageCode}】已使用但无对应工单记录`,
        detail: `客户: ${customerName}，金额: ${totalAmount}元`,
        businessImpact: '缺少工单意味着：\n1. 工单遗漏\n2. 套餐核销无效',
        recommendation: '查找并补录工单，否则无法完成核销。',
        affectedParties: ['服务顾问', '收银员'],
        relatedDocuments: ['工单原始记录']
      };
    }
  },

  amount_mismatch: {
    template: (details) => {
      const { expectedAmount, actualAmount, workOrderNo } = details;
      return {
        title: '金额不符',
        summary: `工单【${workOrderNo}】金额与应收金额不符`,
        detail: `应收: ${expectedAmount}元，实收: ${actualAmount}元，差额: ${(actualAmount - expectedAmount).toFixed(2)}元`,
        businessImpact: '金额差异可能：\n1. 折扣/优惠\n2. 计算错误\n3. 免单/赠送',
        recommendation: '核实金额差异原因，有审批可放行，否则补收或调整。',
        affectedParties: ['收银员', '财务'],
        relatedDocuments: ['优惠审批单', '收银记录']
      };
    }
  }
};

function generateExplanation(type, expected, actual, sourceDetails) {
  const handler = DISCREPANCY_EXPLANATIONS[type];
  if (!handler) {
    return JSON.stringify({
      title: '差异',
      summary: `发现差异：期望: ${expected}，实际: ${actual}`,
      detail: '',
      businessImpact: '',
      recommendation: '请核实差异原因',
      affectedParties: [],
      relatedDocuments: []
    });
  }

  try {
    const details = typeof sourceDetails === 'string' ? JSON.parse(sourceDetails) : sourceDetails;
    const result = handler.template(details || {});
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({
      title: '差异解释生成失败',
      summary: `差异类型: ${type}`,
      detail: `期望: ${expected}，实际: ${actual}`,
      businessImpact: '',
      recommendation: '',
      affectedParties: [],
      relatedDocuments: []
    });
  }
}

function getReadableSummary(explanationJson) {
  try {
    const data = typeof explanationJson === 'string' ? JSON.parse(explanationJson) : explanationJson;
    return `${data.title}：${data.summary}\n业务影响：${data.businessImpact}\n处理建议：${data.recommendation}\n涉及相关方：${data.affectedParties?.join('、') || '无'}\n相关文档：${data.relatedDocuments?.join('、') || '无'}\n`;
  } catch (e) {
    return explanationJson;
  }
}

module.exports = {
  generateExplanation,
  getReadableSummary,
  DISCREPANCY_EXPLANATIONS
};
