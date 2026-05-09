const storage = require('../storage');

function createInstallmentPlan(params) {
  if (!params.arrearId) {
    throw new Error('必须指定欠费记录');
  }
  if (!params.installmentCount || params.installmentCount < 1) {
    throw new Error('分期次数必须大于0');
  }

  const arrear = storage.findById('arrearRecords', params.arrearId);
  if (!arrear) throw new Error('欠费记录不存在');

  if (arrear.remainingAmount <= 0) {
    throw new Error('该欠费已结清，无需分期');
  }

  const amountPerPeriod = Math.floor(arrear.remainingAmount / params.installmentCount * 100) / 100;
  const lastPeriodAmount = Math.round((arrear.remainingAmount - amountPerPeriod * (params.installmentCount - 1)) * 100) / 100;

  const installments = [];
  for (let i = 0; i < params.installmentCount; i++) {
    const isLast = i === params.installmentCount - 1;
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    dueDate.setDate(1);

    installments.push({
      period: i + 1,
      amount: isLast ? lastPeriodAmount : amountPerPeriod,
      paidAmount: 0,
      status: 'pending',
      dueDate: dueDate.toISOString()
    });
  }

  const plan = storage.insert('installmentPlans', {
    arrearId: params.arrearId,
    studentId: arrear.studentId,
    totalAmount: arrear.remainingAmount,
    installmentCount: params.installmentCount,
    installments: installments,
    status: 'active',
    description: params.description || ''
  });

  storage.update('arrearRecords', params.arrearId, {
    status: 'installment',
    installmentPlanId: plan.id
  });

  return plan;
}

function getInstallmentPlan(planId) {
  return storage.findById('installmentPlans', planId);
}

function getStudentInstallmentPlans(studentId, status) {
  const predicate = p => p.studentId === studentId;
  if (status) {
    return storage.findMany('installmentPlans', p => 
      predicate(p) && p.status === status
    );
  }
  return storage.findMany('installmentPlans', predicate);
}

function payInstallment(planId, period, paidAmount) {
  const plan = storage.findById('installmentPlans', planId);
  if (!plan) throw new Error('分期计划不存在');

  const installment = plan.installments.find(i => i.period === period);
  if (!installment) throw new Error('期次不存在');

  if (installment.status === 'paid') {
    throw new Error('该期已付清');
  }

  const remainingAmount = installment.amount - installment.paidAmount;
  if (paidAmount > remainingAmount + 0.01) {
    throw new Error('支付金额超过该期剩余应缴金额');
  }

  const newPaidAmount = installment.paidAmount + paidAmount;
  const isFullyPaid = newPaidAmount >= installment.amount - 0.01;

  installment.paidAmount = newPaidAmount;
  installment.status = isFullyPaid ? 'paid' : 'partial';
  installment.paidAt = new Date().toISOString();

  const allPaid = plan.installments.every(i => i.status === 'paid');
  plan.status = allPaid ? 'completed' : 'active';

  storage.update('installmentPlans', planId, plan);

  if (plan.arrearId) {
    const arrear = storage.findById('arrearRecords', plan.arrearId);
    if (arrear) {
      const totalPaid = plan.installments.reduce((sum, i) => sum + i.paidAmount, 0);
      const newRemaining = Math.max(0, arrear.totalAmount - totalPaid);
      const newStatus = newRemaining === 0 ? 'paid' : 'installment';

      storage.update('arrearRecords', plan.arrearId, {
        paidAmount: totalPaid,
        remainingAmount: newRemaining,
        status: newStatus
      });
    }
  }

  return installment;
}

function getOverdueInstallments() {
  const now = new Date();
  const plans = storage.findMany('installmentPlans', p => p.status === 'active');
  const overdue = [];

  for (const plan of plans) {
    for (const installment of plan.installments) {
      if (installment.status === 'pending' && 
          new Date(installment.dueDate) < now) {
        overdue.push({
          planId: plan.id,
          studentId: plan.studentId,
          ...installment
        });
      }
    }
  }

  return overdue;
}

module.exports = {
  createInstallmentPlan,
  getInstallmentPlan,
  getStudentInstallmentPlans,
  payInstallment,
  getOverdueInstallments
};
