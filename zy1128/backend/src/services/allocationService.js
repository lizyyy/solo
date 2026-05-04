import subscriptionModel from '../models/subscriptionModel.js';
import reconciliationModel from '../models/reconciliationModel.js';
import allocationModel from '../models/allocationModel.js';
import expectedPayoutModel from '../models/expectedPayoutModel.js';
import { roundAmount } from '../utils/calculationUtils.js';
import db from '../config/database.js';

export const generateAllocations = (reconciliationId = null) => {
  const reconciliations = reconciliationId
    ? [reconciliationModel.findById(reconciliationId)]
    : reconciliationModel.findAll();

  const results = [];
  const errors = [];

  db.transaction(() => {
    reconciliations.forEach(reconciliation => {
      if (!reconciliation) return;

      try {
        if (reconciliationId) {
          allocationModel.deleteByReconciliationId(reconciliationId);
        }

        const existingAllocations = allocationModel.findByReconciliationId(reconciliation.id);
        if (existingAllocations.length > 0 && !reconciliationId) {
          return;
        }

        const payout = expectedPayoutModel.findById(reconciliation.expected_payout_id);
        if (!payout) {
          throw new Error('应到账记录不存在');
        }

        const subscriptions = subscriptionModel.findByProductId(payout.product_id);
        if (subscriptions.length === 0) {
          throw new Error('产品没有认购记录');
        }

        const totalRatio = subscriptions.reduce((sum, sub) => sum + (sub.share_ratio || 0), 0);
        if (Math.abs(totalRatio - 1) > 0.0001) {
          console.warn(`产品 ${payout.product_id} 的份额比例合计为 ${totalRatio}，不是100%`);
        }

        subscriptions.forEach(sub => {
          const ratio = sub.share_ratio || (1 / subscriptions.length);
          
          const allocation = {
            reconciliation_id: reconciliation.id,
            holder_id: sub.holder_id,
            share_ratio: ratio,
            allocated_principal: roundAmount((reconciliation.expected_amount || payout.expected_total) * ratio),
            allocated_interest: roundAmount(payout.expected_interest * ratio),
            allocated_management_fee: roundAmount(payout.expected_management_fee * ratio),
            allocated_redemption_fee: roundAmount(payout.expected_redemption_fee * ratio),
            allocated_difference: reconciliation.difference !== null 
              ? roundAmount(reconciliation.difference * ratio)
              : 0
          };

          const created = allocationModel.create(allocation);
          results.push(created);
        });
      } catch (e) {
        errors.push({
          reconciliation_id: reconciliation.id,
          error: e.message
        });
      }
    });
  })();

  return {
    success: errors.length === 0,
    generatedCount: results.length,
    errorCount: errors.length,
    errors,
    results
  };
};

export const getHolderAllocations = (holderId, filters = {}) => {
  const allocations = allocationModel.findByHolderId(holderId, filters);
  
  const summary = {
    holder_id: holderId,
    total_principal: 0,
    total_interest: 0,
    total_management_fee: 0,
    total_redemption_fee: 0,
    total_difference: 0,
    net_total: 0,
    count: 0,
    allocations: []
  };

  allocations.forEach(alloc => {
    summary.total_principal += alloc.allocated_principal || 0;
    summary.total_interest += alloc.allocated_interest || 0;
    summary.total_management_fee += alloc.allocated_management_fee || 0;
    summary.total_redemption_fee += alloc.allocated_redemption_fee || 0;
    summary.total_difference += alloc.allocated_difference || 0;
    summary.count++;
  });

  summary.net_total = roundAmount(
    summary.total_principal + summary.total_interest - 
    summary.total_management_fee - summary.total_redemption_fee + 
    summary.total_difference
  );

  summary.allocations = allocations;

  return summary;
};

export const getReconciliationAllocations = (reconciliationId) => {
  const allocations = allocationModel.findByReconciliationId(reconciliationId);
  const reconciliation = reconciliationModel.findById(reconciliationId);

  return {
    reconciliation,
    allocations,
    summary: {
      total_share_ratio: allocations.reduce((sum, a) => sum + (a.share_ratio || 0), 0),
      total_principal: allocations.reduce((sum, a) => sum + (a.allocated_principal || 0), 0),
      total_interest: allocations.reduce((sum, a) => sum + (a.allocated_interest || 0), 0),
      total_management_fee: allocations.reduce((sum, a) => sum + (a.allocated_management_fee || 0), 0),
      total_redemption_fee: allocations.reduce((sum, a) => sum + (a.allocated_redemption_fee || 0), 0),
      total_difference: allocations.reduce((sum, a) => sum + (a.allocated_difference || 0), 0)
    }
  };
};

export const validateShareRatiosForProduct = (productId) => {
  const subscriptions = subscriptionModel.findByProductId(productId);
  
  if (subscriptions.length === 0) {
    return {
      isValid: true,
      message: '该产品没有认购记录'
    };
  }

  const totalRatio = subscriptions.reduce((sum, sub) => sum + (sub.share_ratio || 0), 0);
  
  const isValid = Math.abs(totalRatio - 1) <= 0.0001;
  
  return {
    isValid,
    totalRatio,
    subscriptions: subscriptions.map(s => ({
      id: s.id,
      holder_name: s.holder_name,
      share_ratio: s.share_ratio,
      percentage: (s.share_ratio * 100).toFixed(2) + '%'
    })),
    message: isValid 
      ? `份额比例合计为 ${(totalRatio * 100).toFixed(2)}%，验证通过`
      : `份额比例合计为 ${(totalRatio * 100).toFixed(2)}%，不是100%`
  };
};

export default {
  generateAllocations,
  getHolderAllocations,
  getReconciliationAllocations,
  validateShareRatiosForProduct
};
