const storage = require('../storage');

function recordPayment(params) {
  const payment = {
    orderNo: params.orderNo,
    studentId: params.studentId,
    arrearId: params.arrearId,
    installmentPlanId: params.installmentPlanId,
    installmentPeriod: params.installmentPeriod,
    amount: params.amount,
    paymentMethod: params.paymentMethod || 'online',
    channel: params.channel || 'alipay',
    status: params.status || 'pending',
    paidAt: params.paidAt || null,
    remark: params.remark || '',
    callbackData: params.callbackData || null
  };
  return storage.insert('paymentRecords', payment);
}

function handlePaymentCallback(orderNo, callbackData) {
  const payment = storage.findOne('paymentRecords', p => p.orderNo === orderNo);
  if (!payment) {
    throw new Error('支付订单不存在');
  }

  const success = callbackData.success;
  const paidAmount = callbackData.amount || payment.amount;

  let updates = {
    callbackData: callbackData,
    callbackAt: new Date().toISOString()
  };

  if (success) {
    updates.status = 'success';
    updates.paidAt = new Date().toISOString();
    updates.paidAmount = paidAmount;

    if (payment.arrearId) {
      const arrear = storage.findById('arrearRecords', payment.arrearId);
      if (arrear) {
        const newPaid = arrear.paidAmount + paidAmount;
        const newRemaining = Math.max(0, arrear.totalAmount - newPaid);
        const newStatus = newRemaining === 0 ? 'paid' : 
          (newPaid > 0 ? 'partial' : 'unpaid');

        storage.update('arrearRecords', payment.arrearId, {
          paidAmount: newPaid,
          remainingAmount: newRemaining,
          status: newStatus
        });
      }
    }

    if (payment.installmentPlanId && payment.installmentPeriod) {
      const plan = storage.findById('installmentPlans', payment.installmentPlanId);
      if (plan) {
        const installment = plan.installments.find(i => i.period === payment.installmentPeriod);
        if (installment) {
          installment.paidAmount += paidAmount;
          installment.status = installment.paidAmount >= installment.amount ? 'paid' : 'partial';
          installment.paidAt = new Date().toISOString();

          const allPaid = plan.installments.every(i => i.status === 'paid');
          plan.status = allPaid ? 'completed' : 'active';

          storage.update('installmentPlans', payment.installmentPlanId, plan);

          if (plan.arrearId) {
            const arrear = storage.findById('arrearRecords', plan.arrearId);
            if (arrear) {
              const newPaid = arrear.paidAmount + paidAmount;
              const newRemaining = Math.max(0, arrear.totalAmount - newPaid);
              storage.update('arrearRecords', plan.arrearId, {
                paidAmount: newPaid,
                remainingAmount: newRemaining,
                status: newRemaining === 0 ? 'paid' : 'installment'
              });
            }
          }
        }
      }
    }
  } else {
    updates.status = 'failed';
    updates.failReason = callbackData.reason || '支付失败';
  }

  return storage.update('paymentRecords', payment.id, updates);
}

function getPaymentRecord(orderNo) {
  return storage.findOne('paymentRecords', p => p.orderNo === orderNo);
}

function getStudentPayments(studentId) {
  return storage.findMany('paymentRecords', p => p.studentId === studentId);
}

function createReconciliation(params) {
  const recon = {
    reconciliationDate: params.reconciliationDate,
    channel: params.channel,
    totalAmount: params.totalAmount,
    totalCount: params.totalCount,
    matchedAmount: 0,
    matchedCount: 0,
    unmatchedAmount: 0,
    unmatchedCount: 0,
    status: 'pending',
    matchedOrders: [],
    unmatchedOrders: []
  };

  const payments = storage.findMany('paymentRecords', p => 
    p.channel === params.channel && p.status === 'success'
  );

  const paymentMap = {};
  for (const p of payments) {
    paymentMap[p.orderNo] = p;
    recon.totalAmount += p.amount;
    recon.totalCount++;
  }

  for (const channelOrder of params.channelOrders || []) {
    const local = paymentMap[channelOrder.orderNo];
    if (local) {
      if (Math.abs(local.amount - channelOrder.amount) < 0.01) {
        recon.matchedCount++;
        recon.matchedAmount += local.amount;
        recon.matchedOrders.push({
          orderNo: channelOrder.orderNo,
          amount: local.amount
        });
        delete paymentMap[channelOrder.orderNo];
      } else {
        recon.unmatchedCount++;
        recon.unmatchedAmount += Math.abs(local.amount - channelOrder.amount);
        recon.unmatchedOrders.push({
          orderNo: channelOrder.orderNo,
          localAmount: local.amount,
          channelAmount: channelOrder.amount,
          type: 'amount_mismatch'
        });
        delete paymentMap[channelOrder.orderNo];
      }
    } else {
      recon.unmatchedCount++;
      recon.unmatchedAmount += channelOrder.amount;
      recon.unmatchedOrders.push({
        orderNo: channelOrder.orderNo,
        channelAmount: channelOrder.amount,
        type: 'missing_local'
      });
    }
  }

  for (const orderNo in paymentMap) {
    const p = paymentMap[orderNo];
    recon.unmatchedCount++;
    recon.unmatchedAmount += p.amount;
    recon.unmatchedOrders.push({
      orderNo: orderNo,
      localAmount: p.amount,
      type: 'missing_channel'
    });
  }

  recon.status = recon.unmatchedCount === 0 ? 'matched' : 'unmatched';

  return storage.insert('reconciliationRecords', recon);
}

function getReconciliation(reconId) {
  return storage.findById('reconciliationRecords', reconId);
}

function getUnmatchedPayments() {
  const recons = storage.findMany('reconciliationRecords', r => r.status === 'unmatched');
  const unmatched = [];
  for (const recon of recons) {
    unmatched.push(...recon.unmatchedOrders);
  }
  return unmatched;
}

module.exports = {
  recordPayment,
  handlePaymentCallback,
  getPaymentRecord,
  getStudentPayments,
  createReconciliation,
  getReconciliation,
  getUnmatchedPayments
};
