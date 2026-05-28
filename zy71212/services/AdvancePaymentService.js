const moment = require('moment');
const { AdvancePaymentRecord, PaymentPlan } = require('../models');

class AdvancePaymentService {
  constructor(storageService) {
    this.storageService = storageService;
    this.config = this.storageService.getConfig();
  }

  canAdvancePayment(policy, paymentPlan) {
    if (!policy?.autoAdvanceEnabled) {
      return {
        canAdvance: false,
        reason: '保单未开启自动垫交功能'
      };
    }

    if (!policy?.cashValue || policy.cashValue <= 0) {
      return {
        canAdvance: false,
        reason: '保单现金价值不足'
      };
    }

    if (paymentPlan?.premium > policy.cashValue) {
      return {
        canAdvance: false,
        reason: '保费金额超过现金价值'
      };
    }

    if (paymentPlan?.status === '已缴费' || paymentPlan?.status === '已垫交') {
      return {
        canAdvance: false,
        reason: '该期保费已缴纳或已垫交'
      };
    }

    const existingAdvance = this.storageService.getAdvancePayments().find(
      a => a.policyNo === policy.policyNo && a.period === paymentPlan.period && !a.repaid
    );

    if (existingAdvance) {
      return {
        canAdvance: false,
        reason: '该期保费已存在未偿还的垫交记录'
      };
    }

    return {
      canAdvance: true,
      maxAdvanceAmount: policy.cashValue,
      interestRate: this.config.defaultInterestRate || 0.05
    };
  }

  createAdvancePayment(policyNo, period, advanceAmount, options = {}) {
    const { advanceType = '自动垫交', remark = '', operator = '' } = options;
    
    const policies = this.storageService.getPolicies();
    const paymentPlans = this.storageService.getPaymentPlans();
    
    const policy = policies.find(p => p.policyNo === policyNo);
    const paymentPlan = paymentPlans.find(p => p.policyNo === policyNo && p.period === period);

    if (!policy) {
      return { success: false, error: '保单不存在' };
    }

    if (!paymentPlan) {
      return { success: false, error: '缴费计划不存在' };
    }

    const canAdvance = this.canAdvancePayment(policy, paymentPlan);
    if (!canAdvance.canAdvance) {
      return { success: false, error: canAdvance.reason };
    }

    const actualAmount = advanceAmount || paymentPlan.premium;
    
    if (actualAmount > policy.cashValue) {
      return { success: false, error: '垫交金额超过现金价值' };
    }

    const advanceRecord = new AdvancePaymentRecord({
      recordId: `ADV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyNo,
      period,
      advanceDate: moment().format('YYYY-MM-DD'),
      advanceAmount: actualAmount,
      advanceType,
      interestRate: this.config.defaultInterestRate || 0.05,
      remainingPrincipal: actualAmount,
      remark,
      createdBy: operator
    });

    const advancePayments = this.storageService.getAdvancePayments();
    advancePayments.push(advanceRecord.toJSON());
    this.storageService.saveAdvancePayments(advancePayments);

    const planIndex = paymentPlans.findIndex(p => p.policyNo === policyNo && p.period === period);
    if (planIndex >= 0) {
      paymentPlans[planIndex].status = '已垫交';
      paymentPlans[planIndex].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      this.storageService.savePaymentPlans(paymentPlans);
    }

    const policyIndex = policies.findIndex(p => p.policyNo === policyNo);
    if (policyIndex >= 0) {
      policies[policyIndex].cashValue = Number((policy.cashValue - actualAmount).toFixed(2));
      policies[policyIndex].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      this.storageService.savePolicies(policies);
    }

    return {
      success: true,
      advancePayment: advanceRecord.toJSON(),
      updatedPaymentPlan: planIndex >= 0 ? paymentPlans[planIndex] : null,
      updatedPolicy: policyIndex >= 0 ? policies[policyIndex] : null
    };
  }

  repayAdvancePayment(recordId, repayAmount, options = {}) {
    const { repayDate = null, remark = '', operator = '' } = options;
    
    const advancePayments = this.storageService.getAdvancePayments();
    const recordIndex = advancePayments.findIndex(a => a.recordId === recordId);
    
    if (recordIndex < 0) {
      return { success: false, error: '垫交记录不存在' };
    }

    const record = advancePayments[recordIndex];
    
    if (record.repaid) {
      return { success: false, error: '该垫交记录已偿还' };
    }

    const currentInterest = this.calculateInterest(record);
    const totalOwed = record.remainingPrincipal + currentInterest;
    
    if (repayAmount < totalOwed) {
      return { 
        success: false, 
        error: `还款金额不足，应还总额 ${totalOwed.toFixed(2)} 元（本金 ${record.remainingPrincipal.toFixed(2)} + 利息 ${currentInterest.toFixed(2)}）` 
      };
    }

    const actualRepayDate = repayDate || moment().format('YYYY-MM-DD');
    
    advancePayments[recordIndex].repaid = true;
    advancePayments[recordIndex].repaidDate = actualRepayDate;
    advancePayments[recordIndex].repaidAmount = Number(repayAmount.toFixed(2));
    advancePayments[recordIndex].remainingPrincipal = 0;
    advancePayments[recordIndex].remainingInterest = 0;
    advancePayments[recordIndex].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    advancePayments[recordIndex].remark = record.remark + (remark ? ` | ${remark}` : '');
    
    this.storageService.saveAdvancePayments(advancePayments);

    const paymentPlans = this.storageService.getPaymentPlans();
    const planIndex = paymentPlans.findIndex(
      p => p.policyNo === record.policyNo && p.period === record.period
    );
    if (planIndex >= 0) {
      paymentPlans[planIndex].status = '已还款';
      paymentPlans[planIndex].paidDate = actualRepayDate;
      paymentPlans[planIndex].paidAmount = Number(repayAmount.toFixed(2));
      paymentPlans[planIndex].paymentMethod = '垫交还款';
      paymentPlans[planIndex].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      this.storageService.savePaymentPlans(paymentPlans);
    }

    const policies = this.storageService.getPolicies();
    const policyIndex = policies.findIndex(p => p.policyNo === record.policyNo);
    if (policyIndex >= 0) {
      policies[policyIndex].cashValue = Number((policies[policyIndex].cashValue + record.advanceAmount).toFixed(2));
      policies[policyIndex].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      this.storageService.savePolicies(policies);
    }

    return {
      success: true,
      advancePayment: advancePayments[recordIndex],
      interestPaid: currentInterest,
      principalPaid: record.advanceAmount,
      totalPaid: Number(repayAmount.toFixed(2))
    };
  }

  calculateInterest(advanceRecord, asOfDate = null) {
    if (advanceRecord.repaid) return 0;
    
    const checkDate = asOfDate ? moment(asOfDate) : moment();
    const advanceDate = moment(advanceRecord.advanceDate);
    const days = checkDate.diff(advanceDate, 'days');
    
    return Number((advanceRecord.remainingPrincipal * advanceRecord.interestRate * days / 365).toFixed(2));
  }

  getAdvancePaymentStatus(policyNo, period = null) {
    const advancePayments = this.storageService.getAdvancePayments();
    let filtered = advancePayments.filter(a => a.policyNo === policyNo);
    
    if (period) {
      filtered = filtered.filter(a => a.period === period);
    }

    return filtered.map(record => {
      const currentInterest = this.calculateInterest(record);
      return {
        ...record,
        currentInterest,
        totalAmountOwed: Number((record.remainingPrincipal + currentInterest).toFixed(2)),
        daysSinceAdvance: moment().diff(moment(record.advanceDate), 'days')
      };
    }).sort((a, b) => moment(b.advanceDate) - moment(a.advanceDate));
  }

  getAllAdvancePayments(status = 'all') {
    const advancePayments = this.storageService.getAdvancePayments();
    
    let filtered = advancePayments;
    if (status === 'unrepaid') {
      filtered = advancePayments.filter(a => !a.repaid);
    } else if (status === 'repaid') {
      filtered = advancePayments.filter(a => a.repaid);
    }

    return filtered.map(record => {
      const currentInterest = this.calculateInterest(record);
      return {
        ...record,
        currentInterest,
        totalAmountOwed: Number((record.remainingPrincipal + currentInterest).toFixed(2)),
        daysSinceAdvance: moment().diff(moment(record.advanceDate), 'days')
      };
    }).sort((a, b) => moment(b.advanceDate) - moment(a.advanceDate));
  }

  getPoliciesEligibleForAdvance() {
    const policies = this.storageService.getPolicies();
    const paymentPlans = this.storageService.getPaymentPlans();
    const gracePeriodService = new GracePeriodService(this.storageService);
    
    const graceResults = gracePeriodService.calculateAllGracePeriods();
    
    const eligible = [];
    
    for (const grace of graceResults.results) {
      if (!grace.isInGracePeriod) continue;
      if (grace.daysRemaining > 3) continue;
      
      const policy = policies.find(p => p.policyNo === grace.policyNo);
      const paymentPlan = paymentPlans.find(p => p.policyNo === grace.policyNo && p.period === grace.period);
      
      if (!policy || !paymentPlan) continue;
      
      const canAdvance = this.canAdvancePayment(policy, paymentPlan);
      
      eligible.push({
        policyNo: grace.policyNo,
        policyholder: policy.policyholder,
        phone: policy.phone,
        period: grace.period,
        premium: grace.premium,
        dueDate: grace.dueDate,
        graceEndDate: grace.graceEndDate,
        daysRemaining: grace.daysRemaining,
        cashValue: policy.cashValue,
        autoAdvanceEnabled: policy.autoAdvanceEnabled,
        canAdvance: canAdvance.canAdvance,
        reason: canAdvance.reason,
        interestRate: this.config.defaultInterestRate || 0.05
      });
    }

    return eligible.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  getAdvancePaymentStatistics() {
    const allAdvances = this.getAllAdvancePayments();
    const unrepaid = allAdvances.filter(a => !a.repaid);
    
    const totalPrincipal = unrepaid.reduce((sum, a) => sum + a.remainingPrincipal, 0);
    const totalInterest = unrepaid.reduce((sum, a) => sum + a.currentInterest, 0);
    const totalAmountOwed = totalPrincipal + totalInterest;

    const byPolicy = {};
    unrepaid.forEach(a => {
      if (!byPolicy[a.policyNo]) {
        byPolicy[a.policyNo] = { count: 0, principal: 0, interest: 0 };
      }
      byPolicy[a.policyNo].count++;
      byPolicy[a.policyNo].principal += a.remainingPrincipal;
      byPolicy[a.policyNo].interest += a.currentInterest;
    });

    const overdueAdvances = unrepaid.filter(a => a.daysSinceAdvance > 365);

    return {
      totalAdvances: allAdvances.length,
      unrepaidCount: unrepaid.length,
      repaidCount: allAdvances.filter(a => a.repaid).length,
      totalPrincipal: Number(totalPrincipal.toFixed(2)),
      totalInterest: Number(totalInterest.toFixed(2)),
      totalAmountOwed: Number(totalAmountOwed.toFixed(2)),
      averageDaysSinceAdvance: unrepaid.length > 0 
        ? Math.round(unrepaid.reduce((sum, a) => sum + a.daysSinceAdvance, 0) / unrepaid.length)
        : 0,
      overdueCount: overdueAdvances.length,
      overdueAmount: Number(overdueAdvances.reduce((sum, a) => sum + a.totalAmountOwed, 0).toFixed(2)),
      byPolicy: Object.entries(byPolicy).map(([policyNo, stats]) => ({
        policyNo,
        ...stats,
        totalOwed: Number((stats.principal + stats.interest).toFixed(2))
      })).sort((a, b) => b.totalOwed - a.totalOwed)
    };
  }

  autoProcessAdvancePayments(options = {}) {
    const { minDaysRemaining = 3, dryRun = false, operator = 'system' } = options;
    
    const eligible = this.getPoliciesEligibleForAdvance();
    const toProcess = eligible.filter(e => e.canAdvance && e.daysRemaining <= minDaysRemaining);
    
    const results = {
      processed: [],
      failed: [],
      skipped: []
    };

    if (dryRun) {
      return {
        ...results,
        wouldProcess: toProcess,
        message: '预览模式，未实际执行垫交'
      };
    }

    for (const item of toProcess) {
      try {
        const result = this.createAdvancePayment(
          item.policyNo,
          item.period,
          item.premium,
          { operator }
        );
        
        if (result.success) {
          results.processed.push(result);
        } else {
          results.failed.push({ ...item, error: result.error });
        }
      } catch (error) {
        results.failed.push({ ...item, error: error.message });
      }
    }

    return {
      ...results,
      totalEligible: eligible.length,
      totalProcessed: results.processed.length,
      totalFailed: results.failed.length
    };
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    return this.storageService.saveConfig(this.config);
  }
}

const GracePeriodService = require('./GracePeriodService');

module.exports = AdvancePaymentService;
