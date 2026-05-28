const moment = require('moment');

class DataConsistencyManager {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validatePolicyPaymentPlanConsistency(policy, paymentPlans) {
    const issues = [];
    
    if (!policy || !policy.policyNo) {
      issues.push({ type: 'error', message: '保单信息不完整，缺少保单号' });
      return issues;
    }

    const policyPlans = paymentPlans.filter(p => p.policyNo === policy.policyNo);
    
    if (policyPlans.length === 0) {
      issues.push({ type: 'warning', message: `保单 ${policy.policyNo} 没有关联的缴费计划` });
    }

    const totalPremium = policyPlans.reduce((sum, p) => sum + (Number(p.premium) || 0), 0);
    if (policy.premium && totalPremium > 0) {
      const diff = Math.abs(totalPremium - policy.premium * policyPlans.length);
      if (diff > 0.01 && policyPlans.length > 0) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 保费金额与缴费计划总和可能不一致，请核对` 
        });
      }
    }

    policyPlans.forEach(plan => {
      if (plan.status === '已缴费' && !plan.paidDate) {
        issues.push({ 
          type: 'error', 
          message: `保单 ${policy.policyNo} 缴费计划 ${plan.period} 状态为已缴费但缺少缴费日期` 
        });
      }
      
      if (plan.paidAmount && plan.premium) {
        if (plan.paidAmount > plan.premium * 1.1) {
          issues.push({ 
            type: 'warning', 
            message: `保单 ${policy.policyNo} 缴费计划 ${plan.period} 实缴金额远大于应缴金额` 
          });
        }
      }

      if (plan.graceEndDate && plan.dueDate) {
        const graceDays = moment(plan.graceEndDate).diff(moment(plan.dueDate), 'days');
        if (graceDays <= 0) {
          issues.push({ 
            type: 'error', 
            message: `保单 ${policy.policyNo} 缴费计划 ${plan.period} 宽限期结束日期早于应缴日期` 
          });
        }
        if (graceDays > policy.gracePeriodDays + 10) {
          issues.push({ 
            type: 'warning', 
            message: `保单 ${policy.policyNo} 缴费计划 ${plan.period} 宽限期 ${graceDays} 天超过保单约定的 ${policy.gracePeriodDays} 天` 
          });
        }
      }
    });

    return issues;
  }

  validateAdvancePaymentConsistency(policy, paymentPlans, advancePayments) {
    const issues = [];
    
    if (!policy || !policy.policyNo) return issues;

    const policyAdvances = advancePayments.filter(a => a.policyNo === policy.policyNo);
    
    if (policyAdvances.length > 0 && !policy.autoAdvanceEnabled) {
      issues.push({ 
        type: 'warning', 
        message: `保单 ${policy.policyNo} 有垫交记录但未开启自动垫交功能` 
      });
    }

    policyAdvances.forEach(advance => {
      const matchingPlan = paymentPlans.find(
        p => p.policyNo === policy.policyNo && p.period === advance.period
      );
      
      if (!matchingPlan) {
        issues.push({ 
          type: 'error', 
          message: `保单 ${policy.policyNo} 垫交记录 ${advance.period} 找不到对应的缴费计划` 
        });
      } else {
        if (advance.advanceAmount > matchingPlan.premium * 1.1) {
          issues.push({ 
            type: 'warning', 
            message: `保单 ${policy.policyNo} 垫交金额 ${advance.advanceAmount} 大于应缴保费 ${matchingPlan.premium}` 
          });
        }

        if (!advance.repaid && advance.advanceDate) {
          const daysSinceAdvance = moment().diff(moment(advance.advanceDate), 'days');
          if (daysSinceAdvance > 365 * 2) {
            issues.push({ 
              type: 'warning', 
              message: `保单 ${policy.policyNo} 垫交记录 ${advance.period} 已超过2年未偿还` 
            });
          }
        }

        if (advance.repaid && advance.repaidAmount && advance.advanceAmount) {
          if (advance.repaidAmount < advance.advanceAmount) {
            issues.push({ 
              type: 'warning', 
              message: `保单 ${policy.policyNo} 垫交记录 ${advance.period} 还款金额 ${advance.repaidAmount} 小于垫交金额 ${advance.advanceAmount}` 
            });
          }
        }
      }

      if (policy.cashValue && advance.advanceAmount > policy.cashValue) {
        issues.push({ 
          type: 'error', 
          message: `保单 ${policy.policyNo} 垫交金额 ${advance.advanceAmount} 超过现金价值 ${policy.cashValue}` 
        });
      }
    });

    return issues;
  }

  validateVisitRecordConsistency(policy, visitRecords) {
    const issues = [];
    
    if (!policy || !policy.policyNo) return issues;

    const policyVisits = visitRecords.filter(v => v.policyNo === policy.policyNo)
      .sort((a, b) => moment(a.visitDate) - moment(b.visitDate));
    
    let lastIntent = null;
    let lastIntentConfirmed = false;

    policyVisits.forEach((visit, index) => {
      if (visit.intentConfirmed && visit.customerIntent) {
        if (lastIntent && lastIntent !== visit.customerIntent && lastIntentConfirmed) {
          issues.push({ 
            type: 'warning', 
            message: `保单 ${policy.policyNo} 客户意愿发生变化: ${lastIntent} -> ${visit.customerIntent}，请确认` 
          });
        }
        lastIntent = visit.customerIntent;
        lastIntentConfirmed = true;
      }

      if (visit.promisedPaymentDate && moment(visit.promisedPaymentDate).isBefore(moment(visit.visitDate))) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 承诺缴费日期早于回访日期` 
        });
      }

      if (visit.nextFollowUpDate && moment(visit.nextFollowUpDate).isBefore(moment(visit.visitDate))) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 下次跟进日期早于本次回访日期` 
        });
      }

      if (index > 0) {
        const prevVisit = policyVisits[index - 1];
        if (moment(visit.visitDate).isBefore(moment(prevVisit.visitDate))) {
          issues.push({ 
            type: 'warning', 
            message: `保单 ${policy.policyNo} 回访记录时间顺序可能有误` 
          });
        }
      }
    });

    return issues;
  }

  validateReminderConsistency(policy, paymentPlans, reminderRecords, visitRecords) {
    const issues = [];
    
    if (!policy || !policy.policyNo) return issues;

    const policyReminders = reminderRecords.filter(r => r.policyNo === policy.policyNo);
    const policyVisits = visitRecords.filter(v => v.policyNo === policy.policyNo);

    const stopIntentVisit = policyVisits.find(v => v.isStopIntent === true);
    if (stopIntentVisit && policyReminders.length > 0) {
      const remindersAfterStop = policyReminders.filter(r => 
        moment(r.reminderDate).isAfter(moment(stopIntentVisit.visitDate))
      );
      if (remindersAfterStop.length > 0) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 客户已表示停保意愿，但仍有 ${remindersAfterStop.length} 次催缴记录` 
        });
      }
    }

    const deduplicationMap = new Map();
    policyReminders.forEach(reminder => {
      const key = reminder.deduplicationKey || 
        `${reminder.policyNo}_${reminder.period}_${reminder.reminderType}_${moment(reminder.reminderDate).format('YYYY-MM-DD')}`;
      
      if (deduplicationMap.has(key)) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 存在重复催缴记录: ${reminder.reminderType} ${moment(reminder.reminderDate).format('YYYY-MM-DD')}` 
        });
      }
      deduplicationMap.set(key, true);
    });

    const advancePayments = [];
    const hasAdvance = advancePayments.some(a => a.policyNo === policy.policyNo && !a.repaid);
    if (hasAdvance) {
      const remindersAfterAdvance = policyReminders.filter(r => {
        const advance = advancePayments.find(a => 
          a.policyNo === policy.policyNo && 
          a.period === r.period && 
          !a.repaid
        );
        return advance && moment(r.reminderDate).isAfter(moment(advance.advanceDate));
      });
      if (remindersAfterAdvance.length > 0) {
        issues.push({ 
          type: 'warning', 
          message: `保单 ${policy.policyNo} 已自动垫交，但仍有 ${remindersAfterAdvance.length} 次催缴记录` 
        });
      }
    }

    return issues;
  }

  validateAllConsistency(data) {
    const { policies, paymentPlans, advancePayments, visitRecords, reminderRecords } = data;
    
    this.errors = [];
    this.warnings = [];
    const allIssues = [];

    policies.forEach(policy => {
      const policyIssues = [
        ...this.validatePolicyPaymentPlanConsistency(policy, paymentPlans),
        ...this.validateAdvancePaymentConsistency(policy, paymentPlans, advancePayments),
        ...this.validateVisitRecordConsistency(policy, visitRecords),
        ...this.validateReminderConsistency(policy, paymentPlans, reminderRecords, visitRecords)
      ];

      policyIssues.forEach(issue => {
        allIssues.push({
          policyNo: policy.policyNo,
          policyholder: policy.policyholder,
          ...issue
        });

        if (issue.type === 'error') {
          this.errors.push({
            policyNo: policy.policyNo,
            policyholder: policy.policyholder,
            ...issue
          });
        } else {
          this.warnings.push({
            policyNo: policy.policyNo,
            policyholder: policy.policyholder,
            ...issue
          });
        }
      });
    });

    return {
      issues: allIssues,
      errors: this.errors,
      warnings: this.warnings,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      isValid: this.errors.length === 0
    };
  }

  canUpdateRecord(existingRecord, newRecord, fieldName) {
    if (!existingRecord) return true;
    
    const protectedFields = [
      'policyNo', 'planId', 'recordId', 'visitId', 'reminderId',
      'createdAt', 'advanceDate', 'dueDate', 'visitDate', 'reminderDate'
    ];
    
    if (protectedFields.includes(fieldName)) {
      if (existingRecord[fieldName] && newRecord[fieldName] && 
          existingRecord[fieldName] !== newRecord[fieldName]) {
        return false;
      }
    }

    const numericFields = ['premium', 'advanceAmount', 'paidAmount', 'remainingPrincipal'];
    if (numericFields.includes(fieldName)) {
      const oldVal = Number(existingRecord[fieldName]) || 0;
      const newVal = Number(newRecord[fieldName]) || 0;
      if (oldVal > 0 && newVal > 0 && oldVal !== newVal) {
        return {
          allowed: false,
          reason: `字段 ${fieldName} 已存在数值 ${oldVal}，不能修改为 ${newVal}`
        };
      }
    }

    if (fieldName === 'status') {
      const statusTransitions = {
        '待缴费': ['宽限期内', '已缴费', '已垫交', '停效'],
        '宽限期内': ['已缴费', '已垫交', '停效'],
        '已垫交': ['已还款', '停效'],
        '已缴费': [],
        '停效': ['复效', '终止'],
        '已还款': []
      };
      
      const allowedTransitions = statusTransitions[existingRecord[fieldName]] || [];
      if (!allowedTransitions.includes(newRecord[fieldName])) {
        return {
          allowed: false,
          reason: `状态不能从 ${existingRecord[fieldName]} 变更为 ${newRecord[fieldName]}`
        };
      }
    }

    return true;
  }

  safeUpdateRecord(existingRecord, newRecord) {
    const updates = {};
    const conflicts = [];

    for (const field of Object.keys(newRecord)) {
      if (field === 'updatedAt') continue;
      
      const canUpdate = this.canUpdateRecord(existingRecord, newRecord, field);
      
      if (canUpdate === true) {
        updates[field] = newRecord[field];
      } else if (canUpdate && typeof canUpdate === 'object') {
        conflicts.push({
          field,
          oldValue: existingRecord[field],
          newValue: newRecord[field],
          reason: canUpdate.reason
        });
      }
    }

    return {
      updates,
      conflicts,
      hasConflicts: conflicts.length > 0
    };
  }

  getErrors() {
    return this.errors;
  }

  getWarnings() {
    return this.warnings;
  }

  clear() {
    this.errors = [];
    this.warnings = [];
  }
}

module.exports = DataConsistencyManager;
