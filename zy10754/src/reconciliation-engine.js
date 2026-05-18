const RELEASE_STATUS = ['已释放', '已完成', '已取消', 'RELEASED', 'COMPLETED', 'CANCELLED'];
const PAYMENT_SUCCESS_STATUS = ['支付成功', 'SUCCESS', '已支付'];
const PAYMENT_FAIL_STATUS = ['支付失败', 'FAIL', '未支付'];

function isPaymentFailed(payment) {
  return PAYMENT_FAIL_STATUS.includes(payment.status);
}

function isTimeoutExpired(preOccupation, currentTime = new Date()) {
  if (!preOccupation.expireTime) return false;
  const expireTime = new Date(preOccupation.expireTime);
  return expireTime < currentTime;
}

function isManualExchange(preOccupation) {
  const manualKeywords = ['手工兑换', '人工兑换', '线下兑换', 'MANUAL', 'OFFLINE'];
  const source = (preOccupation.orderSource || '').toLowerCase();
  const remark = (preOccupation.remark || '').toLowerCase();
  return manualKeywords.some(keyword => 
    source.includes(keyword.toLowerCase()) || remark.includes(keyword.toLowerCase())
  );
}

function isPreOccupationReleased(preOccupation) {
  return RELEASE_STATUS.includes(preOccupation.status);
}

function reconcile(preOccupations, payments, inventory) {
  const paymentMap = new Map();
  payments.forEach(p => {
    if (p.preOccupationId) {
      paymentMap.set(p.preOccupationId, p);
    }
  });

  const unreleasedList = [];
  const paymentFailedList = [];
  const timeoutList = [];
  const manualExchangeList = [];
  const normalReleasedList = [];

  preOccupations.forEach(preOcc => {
    const payment = paymentMap.get(preOcc.preOccupationId);
    const isReleased = isPreOccupationReleased(preOcc);
    const hasPaymentFailed = payment && isPaymentFailed(payment);
    const isExpired = isTimeoutExpired(preOcc);
    const isManual = isManualExchange(preOcc);

    const reconciliationResult = {
      preOccupationId: preOcc.preOccupationId,
      skuCode: preOcc.skuCode,
      skuName: preOcc.skuName,
      quantity: preOcc.quantity,
      createTime: preOcc.createTime,
      expireTime: preOcc.expireTime,
      preOccupationStatus: preOcc.status,
      orderSource: preOcc.orderSource,
      operator: preOcc.operator,
      remark: preOcc.remark,
      paymentStatus: payment ? payment.status : '无支付记录',
      paymentTime: payment ? payment.paymentTime : '',
      paymentMethod: payment ? payment.paymentMethod : '',
      failReason: payment ? payment.failReason : '',
      reconciliationType: '',
      reconciliationStatus: '',
      reconciliationRemark: ''
    };

    if (!isReleased) {
      if (hasPaymentFailed) {
        reconciliationResult.reconciliationType = '支付失败';
        reconciliationResult.reconciliationStatus = '待释放';
        reconciliationResult.reconciliationRemark = `支付失败原因：${payment.failReason || '未知'}`;
        paymentFailedList.push(reconciliationResult);
        unreleasedList.push(reconciliationResult);
      } else if (isManual) {
        reconciliationResult.reconciliationType = '手工兑换';
        reconciliationResult.reconciliationStatus = '待复核';
        reconciliationResult.reconciliationRemark = '手工兑换订单需人工复核确认是否释放';
        manualExchangeList.push(reconciliationResult);
        unreleasedList.push(reconciliationResult);
      } else if (isExpired) {
        reconciliationResult.reconciliationType = '超时取消';
        reconciliationResult.reconciliationStatus = '待释放';
        reconciliationResult.reconciliationRemark = `预占已过期，过期时间：${preOcc.expireTime}`;
        timeoutList.push(reconciliationResult);
        unreleasedList.push(reconciliationResult);
      } else {
        reconciliationResult.reconciliationType = '其他未释放';
        reconciliationResult.reconciliationStatus = '待核查';
        reconciliationResult.reconciliationRemark = '预占未释放且无明确异常类型，需人工核查';
        unreleasedList.push(reconciliationResult);
      }
    } else {
      reconciliationResult.reconciliationType = '正常释放';
      reconciliationResult.reconciliationStatus = '已释放';
      reconciliationResult.reconciliationRemark = '预占已正常释放';
      normalReleasedList.push(reconciliationResult);
    }
  });

  const inventoryVerification = verifyInventory(unreleasedList, inventory);

  return {
    summary: {
      totalPreOccupations: preOccupations.length,
      totalPayments: payments.length,
      totalSKUs: inventory.length,
      totalUnreleased: unreleasedList.length,
      paymentFailedCount: paymentFailedList.length,
      timeoutCount: timeoutList.length,
      manualExchangeCount: manualExchangeList.length,
      normalReleasedCount: normalReleasedList.length,
      reconciliationTime: new Date().toISOString()
    },
    unreleasedList,
    paymentFailedList,
    timeoutList,
    manualExchangeList,
    normalReleasedList,
    inventoryVerification
  };
}

function verifyInventory(unreleasedList, inventory) {
  const inventoryMap = new Map();
  inventory.forEach(inv => {
    inventoryMap.set(inv.skuCode, inv);
  });

  const unreleasedBySKU = {};
  unreleasedList.forEach(item => {
    if (!unreleasedBySKU[item.skuCode]) {
      unreleasedBySKU[item.skuCode] = { skuName: item.skuName, quantity: 0, items: [] };
    }
    unreleasedBySKU[item.skuCode].quantity += item.quantity;
    unreleasedBySKU[item.skuCode].items.push(item);
  });

  const verificationResults = [];
  Object.keys(unreleasedBySKU).forEach(skuCode => {
    const unreleased = unreleasedBySKU[skuCode];
    const inv = inventoryMap.get(skuCode);
    const result = {
      skuCode,
      skuName: unreleased.skuName,
      unreleasedQuantity: unreleased.quantity,
      systemOccupiedInventory: inv ? inv.occupiedInventory : 0,
      inventoryDiff: inv ? inv.occupiedInventory - unreleased.quantity : 0,
      verificationStatus: '',
      verificationRemark: ''
    };

    if (!inv) {
      result.verificationStatus = '库存不存在';
      result.verificationRemark = 'SKU在库存快照中不存在，需核查';
    } else if (Math.abs(result.inventoryDiff) > 0) {
      result.verificationStatus = '库存不一致';
      result.verificationRemark = `系统预占库存(${inv.occupiedInventory})与对账未释放数量(${unreleased.quantity})存在差异`;
    } else {
      result.verificationStatus = '一致';
      result.verificationRemark = '库存数据核对一致';
    }

    verificationResults.push(result);
  });

  return verificationResults;
}

module.exports = {
  reconcile,
  isPaymentFailed,
  isTimeoutExpired,
  isManualExchange
};
