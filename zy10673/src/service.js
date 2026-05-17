const store = require('./store');
const {
  PRICE_STATUS,
  PRICE_STATUS_LABELS,
  EXPIRATION_REASONS,
  EXPIRATION_REASON_LABELS,
  REQUIRED_MATERIALS,
  VALID_TRANSITIONS
} = require('./types');

class PriceService {
  canTransition(fromStatus, toStatus) {
    const validTransitions = VALID_TRANSITIONS[fromStatus];
    return validTransitions && validTransitions.includes(toStatus);
  }

  transitionStatus(priceId, toStatus, reasonCode, operator, remark = '') {
    const price = store.getPrice(priceId);
    if (!price) {
      return {
        success: false,
        errorCode: 'PRICE_NOT_FOUND',
        message: `价格记录 ${priceId} 不存在`,
        failedRule: '记录存在性校验'
      };
    }

    if (!this.canTransition(price.status, toStatus)) {
      return {
        success: false,
        errorCode: 'INVALID_TRANSITION',
        message: `状态流转非法: ${PRICE_STATUS_LABELS[price.status]} -> ${PRICE_STATUS_LABELS[toStatus]}`,
        failedRule: '状态流转规则校验',
        currentStatus: price.status,
        currentStatusLabel: PRICE_STATUS_LABELS[price.status]
      };
    }

    if (toStatus !== PRICE_STATUS.ACTIVE && !reasonCode) {
      return {
        success: false,
        errorCode: 'REASON_REQUIRED',
        message: '状态变更时必须提供失效原因',
        failedRule: '原因必填校验'
      };
    }

    if (reasonCode && !EXPIRATION_REASON_LABELS[reasonCode]) {
      return {
        success: false,
        errorCode: 'INVALID_REASON',
        message: `失效原因代码无效: ${reasonCode}`,
        failedRule: '原因代码有效性校验',
        validReasons: Object.keys(EXPIRATION_REASON_LABELS)
      };
    }

    const updatedPrice = store.updateStatus(
      priceId,
      toStatus,
      reasonCode,
      operator,
      remark
    );

    return {
      success: true,
      data: this.enrichPrice(updatedPrice),
      message: `状态已更新为: ${PRICE_STATUS_LABELS[toStatus]}`
    };
  }

  enrichPrice(price) {
    return {
      ...price,
      statusLabel: PRICE_STATUS_LABELS[price.status],
      expirationReasonLabel: price.expirationReason 
        ? EXPIRATION_REASON_LABELS[price.expirationReason] 
        : null,
      requiredMaterials: price.status !== PRICE_STATUS.ACTIVE && price.expirationReason
        ? REQUIRED_MATERIALS[price.expirationReason]
        : null
    };
  }

  getPriceDetail(priceId) {
    const price = store.getPrice(priceId);
    if (!price) {
      return {
        success: false,
        errorCode: 'PRICE_NOT_FOUND',
        message: `价格记录 ${priceId} 不存在`
      };
    }
    return {
      success: true,
      data: this.enrichPrice(price)
    };
  }

  listPrices(filters = {}) {
    const prices = store.listPrices(filters);
    return {
      success: true,
      data: prices.map(p => this.enrichPrice(p)),
      total: prices.length
    };
  }

  getPriceHistory(priceId) {
    const price = store.getPrice(priceId);
    if (!price) {
      return {
        success: false,
        errorCode: 'PRICE_NOT_FOUND',
        message: `价格记录 ${priceId} 不存在`
      };
    }
    const history = store.getHistory(priceId);
    return {
      success: true,
      data: history.map(h => ({
        ...h,
        details: this.enrichHistoryDetails(h.details)
      }))
    };
  }

  enrichHistoryDetails(details) {
    if (details.oldStatus && details.newStatus) {
      return {
        ...details,
        oldStatusLabel: PRICE_STATUS_LABELS[details.oldStatus],
        newStatusLabel: PRICE_STATUS_LABELS[details.newStatus],
        reasonLabel: details.reason ? EXPIRATION_REASON_LABELS[details.reason] : null
      };
    }
    return details;
  }

  validateCartOrder(customerId, cartItems) {
    const results = [];
    let hasBlocked = false;

    for (const item of cartItems) {
      const price = store.prices.find(p => 
        p.customerId === customerId && 
        p.skuCode === item.skuCode
      );

      if (!price) {
        results.push({
          skuCode: item.skuCode,
          skuName: item.skuName,
          success: false,
          blocked: false,
          message: '该SKU无专属价配置'
        });
        continue;
      }

      if (price.status !== PRICE_STATUS.ACTIVE) {
        hasBlocked = true;
        results.push({
          skuCode: item.skuCode,
          skuName: item.skuName,
          success: false,
          blocked: true,
          currentStatus: price.status,
          currentStatusLabel: PRICE_STATUS_LABELS[price.status],
          expirationReason: price.expirationReason,
          expirationReasonLabel: EXPIRATION_REASON_LABELS[price.expirationReason],
          requestedPrice: item.unitPrice,
          effectivePrice: price.exclusivePrice,
          message: `专属价已${PRICE_STATUS_LABELS[price.status]}，下单被拦截`,
          nextStep: {
            action: '提交恢复申请',
            requiredMaterials: REQUIRED_MATERIALS[price.expirationReason] || []
          }
        });
      } else {
        results.push({
          skuCode: item.skuCode,
          skuName: item.skuName,
          success: true,
          blocked: false,
          effectivePrice: price.exclusivePrice
        });
      }
    }

    return {
      success: !hasBlocked,
      blocked: hasBlocked,
      message: hasBlocked ? '部分商品专属价已失效，下单被拦截' : '所有商品价格校验通过',
      items: results
    };
  }

  batchImport(records, operator) {
    const result = store.batchImport(records, operator);
    return {
      success: true,
      data: {
        successCount: result.success.length,
        failedCount: result.failed.length,
        conflictCount: result.conflicts.length,
        success: result.success,
        failed: result.failed.map(f => ({
          ...f,
          failedRules: f.errors
        })),
        conflicts: result.conflicts
      }
    };
  }

  exportPrices(filters = {}) {
    return {
      success: true,
      data: store.exportPrices(filters),
      exportTime: new Date().toISOString()
    };
  }

  createPrice(data) {
    const price = store.createPrice(data);
    return {
      success: true,
      data: this.enrichPrice(price)
    };
  }
}

module.exports = new PriceService();
