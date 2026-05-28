const moment = require('moment');
const HolidayService = require('./HolidayService');
const { PaymentPlan } = require('../models');

class GracePeriodService {
  constructor(storageService) {
    this.storageService = storageService;
    this.holidayService = new HolidayService();
  }

  calculateGracePeriod(paymentPlan, policy, options = {}) {
    const { extendForHolidays = true, customGraceDays = null } = options;
    
    if (!paymentPlan || !paymentPlan.dueDate) {
      return {
        success: false,
        error: '缺少应缴日期信息',
        graceEndDate: null,
        graceDays: 0
      };
    }

    const graceDays = customGraceDays || policy?.gracePeriodDays || 60;
    const graceEndDate = this.holidayService.calculateGraceEndDate(
      paymentPlan.dueDate,
      graceDays,
      extendForHolidays
    );

    const holidaysInGrace = this.holidayService.getHolidaysBetween(
      paymentPlan.dueDate,
      graceEndDate
    );

    const calendarDays = this.holidayService.getCalendarDaysBetween(
      paymentPlan.dueDate,
      graceEndDate
    );

    const workdays = this.holidayService.getWorkdaysBetween(
      paymentPlan.dueDate,
      graceEndDate
    );

    const now = moment();
    const isOverdue = now.isAfter(moment(paymentPlan.dueDate), 'day');
    const isInGracePeriod = isOverdue && now.isSameOrBefore(moment(graceEndDate), 'day');
    const isGraceExpired = now.isAfter(moment(graceEndDate), 'day');
    
    const daysOverdue = isOverdue ? now.diff(moment(paymentPlan.dueDate), 'days') : 0;
    const daysRemaining = isInGracePeriod 
      ? moment(graceEndDate).diff(now, 'days') + 1
      : (isGraceExpired ? 0 : graceDays);

    const urgency = this.getUrgencyLevel(daysRemaining, isInGracePeriod, isGraceExpired);

    return {
      success: true,
      policyNo: policy?.policyNo || paymentPlan.policyNo,
      dueDate: paymentPlan.dueDate,
      graceDays,
      graceEndDate,
      actualGraceDays: calendarDays,
      workdaysInGrace: workdays,
      holidaysInGrace,
      holidaysCount: holidaysInGrace.length,
      extendForHolidays,
      extendedDueToHoliday: graceEndDate !== this.holidayService.addCalendarDays(paymentPlan.dueDate, graceDays),
      isOverdue,
      isInGracePeriod,
      isGraceExpired,
      daysOverdue,
      daysRemaining,
      urgency,
      premium: paymentPlan.premium,
      period: paymentPlan.period
    };
  }

  calculateAllGracePeriods(options = {}) {
    const paymentPlans = this.storageService.getPaymentPlans();
    const policies = this.storageService.getPolicies();
    
    const policyMap = new Map();
    policies.forEach(p => policyMap.set(p.policyNo, p));

    const results = [];
    
    for (const plan of paymentPlans) {
      if (plan.status === '已缴费' || plan.status === '已还款') {
        continue;
      }
      
      const policy = policyMap.get(plan.policyNo);
      const result = this.calculateGracePeriod(plan, policy, options);
      results.push(result);
    }

    return {
      total: results.length,
      inGracePeriod: results.filter(r => r.isInGracePeriod).length,
      graceExpired: results.filter(r => r.isGraceExpired).length,
      overdue: results.filter(r => r.isOverdue).length,
      urgent: results.filter(r => r.urgency === '紧急').length,
      results,
      summary: this.generateSummary(results)
    };
  }

  getUrgencyLevel(daysRemaining, isInGracePeriod, isGraceExpired) {
    if (isGraceExpired) return '已过期';
    if (!isInGracePeriod) return '正常';
    if (daysRemaining <= 3) return '紧急';
    if (daysRemaining <= 7) return '高';
    if (daysRemaining <= 15) return '中';
    return '低';
  }

  generateSummary(results) {
    const byUrgency = {
      '紧急': 0,
      '高': 0,
      '中': 0,
      '低': 0,
      '正常': 0,
      '已过期': 0
    };

    let totalPremiumDue = 0;
    let totalPremiumOverdue = 0;
    let totalPremiumInGrace = 0;

    results.forEach(r => {
      byUrgency[r.urgency] = (byUrgency[r.urgency] || 0) + 1;
      
      if (r.premium) {
        totalPremiumDue += r.premium;
        if (r.isOverdue) totalPremiumOverdue += r.premium;
        if (r.isInGracePeriod) totalPremiumInGrace += r.premium;
      }
    });

    return {
      countByUrgency: byUrgency,
      totalPremiumDue,
      totalPremiumOverdue,
      totalPremiumInGrace,
      avgDaysRemaining: results.filter(r => r.isInGracePeriod).length > 0
        ? Math.round(results.filter(r => r.isInGracePeriod).reduce((sum, r) => sum + r.daysRemaining, 0) / 
          results.filter(r => r.isInGracePeriod).length)
        : 0
    };
  }

  getPoliciesNeedingReminder(options = {}) {
    const { minDaysRemaining = 15, includeStopIntent = false } = options;
    
    const graceResults = this.calculateAllGracePeriods();
    const visitRecords = this.storageService.getVisitRecords();
    const advancePayments = this.storageService.getAdvancePayments();
    const reminderRecords = this.storageService.getReminderRecords();

    const visitMap = new Map();
    visitRecords.forEach(v => {
      if (!visitMap.has(v.policyNo) || 
          moment(v.visitDate).isAfter(moment(visitMap.get(v.policyNo).visitDate))) {
        visitMap.set(v.policyNo, v);
      }
    });

    const advanceMap = new Map();
    advancePayments.forEach(a => {
      if (!a.repaid) {
        advanceMap.set(`${a.policyNo}_${a.period}`, a);
      }
    });

    const reminderMap = new Map();
    reminderRecords.forEach(r => {
      const key = `${r.policyNo}_${r.period}`;
      if (!reminderMap.has(key) || 
          moment(r.reminderDate).isAfter(moment(reminderMap.get(key).reminderDate))) {
        reminderMap.set(key, r);
      }
    });

    const needingReminder = [];

    for (const result of graceResults.results) {
      if (result.isGraceExpired && !includeStopIntent) continue;
      
      const lastVisit = visitMap.get(result.policyNo);
      const hasStopIntent = lastVisit?.isStopIntent === true;
      const intentLocked = lastVisit?.isIntentLocked === true;
      
      if (hasStopIntent && !includeStopIntent) continue;

      const hasAdvancePayment = advanceMap.has(`${result.policyNo}_${result.period}`);
      if (hasAdvancePayment) continue;

      const lastReminder = reminderMap.get(`${result.policyNo}_${result.period}`);
      const daysSinceLastReminder = lastReminder 
        ? moment().diff(moment(lastReminder.reminderDate), 'days')
        : 999;

      const reminderIntervals = [3, 7, 15, 30];
      let reminderInterval = 7;
      if (result.urgency === '紧急') reminderInterval = 1;
      else if (result.urgency === '高') reminderInterval = 3;
      else if (result.urgency === '中') reminderInterval = 7;

      if (daysSinceLastReminder >= reminderInterval) {
        const policy = this.storageService.getPolicies().find(p => p.policyNo === result.policyNo);
        
        needingReminder.push({
          ...result,
          policyholder: policy?.policyholder || '',
          phone: policy?.phone || '',
          agent: policy?.agent || '',
          lastVisit,
          hasStopIntent,
          intentLocked,
          hasAdvancePayment,
          lastReminder,
          daysSinceLastReminder,
          suggestedReminderType: this.getSuggestedReminderType(result.urgency),
          nextAction: this.getNextAction(result, lastVisit, hasStopIntent, intentLocked)
        });
      }
    }

    return needingReminder.sort((a, b) => {
      const urgencyOrder = { '紧急': 0, '高': 1, '中': 2, '低': 3, '正常': 4, '已过期': 5 };
      return (urgencyOrder[a.urgency] || 99) - (urgencyOrder[b.urgency] || 99);
    });
  }

  getSuggestedReminderType(urgency) {
    switch (urgency) {
      case '紧急':
        return ['电话', '短信', '微信'];
      case '高':
        return ['电话', '短信'];
      case '中':
        return ['短信', '微信'];
      case '低':
        return ['短信'];
      default:
        return ['短信'];
    }
  }

  getNextAction(result, lastVisit, hasStopIntent, intentLocked) {
    if (result.isGraceExpired) {
      return {
        action: '办理复效或退保',
        description: '宽限期已满，需通知客户办理复效或退保手续'
      };
    }

    if (hasStopIntent && intentLocked) {
      return {
        action: '确认停保手续',
        description: '客户已确认停保意愿，需协助办理相关手续'
      };
    }

    if (hasStopIntent && !intentLocked) {
      return {
        action: '再次确认停保意愿',
        description: '客户表示停保意愿但未最终确认，需再次核实'
      };
    }

    if (lastVisit?.promisedPaymentDate) {
      const promisedDate = moment(lastVisit.promisedPaymentDate);
      if (promisedDate.isBefore(moment(), 'day')) {
        return {
          action: '跟进承诺缴费',
          description: `客户承诺于 ${lastVisit.promisedPaymentDate} 缴费但未兑现，需跟进`
        };
      }
      return {
        action: '等待承诺缴费',
        description: `客户承诺于 ${lastVisit.promisedPaymentDate} 缴费，到期后跟进`
      };
    }

    if (result.daysRemaining <= 3) {
      return {
        action: '紧急催缴',
        description: '宽限期即将结束，需立即联系客户缴费'
      };
    }

    return {
      action: '常规催缴',
      description: '提醒客户按时缴费，了解缴费困难原因'
    };
  }

  updatePaymentPlanGraceEndDate(paymentPlan, policy, options = {}) {
    const graceResult = this.calculateGracePeriod(paymentPlan, policy, options);
    
    if (!graceResult.success) {
      return graceResult;
    }

    const paymentPlans = this.storageService.getPaymentPlans();
    const index = paymentPlans.findIndex(p => p.planId === paymentPlan.planId);
    
    if (index >= 0) {
      paymentPlans[index].graceEndDate = graceResult.graceEndDate;
      paymentPlans[index].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
      this.storageService.savePaymentPlans(paymentPlans);
    }

    return {
      ...graceResult,
      updated: index >= 0
    };
  }

  updateAllGraceEndDates(options = {}) {
    const paymentPlans = this.storageService.getPaymentPlans();
    const policies = this.storageService.getPolicies();
    const policyMap = new Map();
    policies.forEach(p => policyMap.set(p.policyNo, p));

    const updated = [];
    const failed = [];

    for (const plan of paymentPlans) {
      if (plan.status === '已缴费' || plan.status === '已还款') {
        continue;
      }

      const policy = policyMap.get(plan.policyNo);
      const result = this.updatePaymentPlanGraceEndDate(plan, policy, options);
      
      if (result.success && result.updated) {
        updated.push(result);
      } else {
        failed.push({ plan, error: result.error });
      }
    }

    return {
      updatedCount: updated.length,
      failedCount: failed.length,
      updated,
      failed
    };
  }
}

module.exports = GracePeriodService;
