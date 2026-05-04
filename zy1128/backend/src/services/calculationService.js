import dayjs from 'dayjs';
import subscriptionModel from '../models/subscriptionModel.js';
import expectedPayoutModel from '../models/expectedPayoutModel.js';
import payoutRuleModel from '../models/payoutRuleModel.js';
import {
  calculateInterest,
  calculateManagementFee,
  calculateRedemptionFee,
  calculateNetPayout,
  roundAmount
} from '../utils/calculationUtils.js';
import { calculateDaysBetween, isDateAfter, formatDate } from '../utils/dateUtils.js';
import db from '../config/database.js';

export const generateExpectedPayouts = (subscriptionId = null) => {
  const subscriptions = subscriptionId 
    ? [subscriptionModel.findById(subscriptionId)]
    : subscriptionModel.findAll();

  const results = [];
  const errors = [];

  db.transaction(() => {
    subscriptions.forEach(sub => {
      if (!sub) return;

      try {
        if (subscriptionId) {
          expectedPayoutModel.deleteBySubscriptionId(subscriptionId);
        }

        const rule = payoutRuleModel.findByProductId(sub.product_id) || {
          rule_type: 'actual/365',
          management_fee_calculation: 'daily_accrual',
          redemption_fee_calculation: 'fixed',
          payout_frequency: 'maturity'
        };

        const payouts = generatePayoutsForSubscription(sub, rule);
        
        payouts.forEach(payout => {
          const created = expectedPayoutModel.create({
            subscription_id: sub.id,
            payout_date: payout.payoutDate,
            expected_principal: payout.expectedPrincipal,
            expected_interest: payout.expectedInterest,
            expected_management_fee: payout.expectedManagementFee,
            expected_redemption_fee: payout.expectedRedemptionFee,
            expected_total: payout.expectedTotal,
            status: 'pending',
            period_start: payout.periodStart,
            period_end: payout.periodEnd,
            notes: payout.notes
          });
          results.push(created);
        });
      } catch (e) {
        errors.push({
          subscription_id: sub.id,
          product_name: sub.product_name,
          error: e.message
        });
      }
    });
  })();

  return {
    success: errors.length === 0,
    generatedCount: results.length,
    errors,
    results
  };
};

const generatePayoutsForSubscription = (subscription, rule) => {
  const payouts = [];
  
  const valueDate = dayjs(subscription.value_date);
  const maturityDate = subscription.maturity_date ? dayjs(subscription.maturity_date) : null;
  const today = dayjs();

  let actualDays = subscription.actual_days;
  if (!actualDays && maturityDate) {
    actualDays = calculateDaysBetween(subscription.value_date, subscription.maturity_date);
  }
  if (!actualDays) {
    actualDays = calculateDaysBetween(subscription.value_date, today.format('YYYY-MM-DD'));
  }

  const principal = subscription.principal;
  const annualRate = subscription.expected_annual_rate;
  const managementFeeRate = subscription.management_fee_rate || 0;
  const redemptionFeeRate = subscription.redemption_fee_rate || 0;

  const payoutFrequency = rule.payout_frequency || 'maturity';

  if (payoutFrequency === 'maturity' || !maturityDate) {
    const interest = calculateInterest(principal, annualRate, actualDays, rule.rule_type);
    const managementFee = calculateManagementFee(
      principal, managementFeeRate, actualDays, rule.management_fee_calculation
    );
    const redemptionFee = calculateRedemptionFee(
      principal, redemptionFeeRate, actualDays, rule.redemption_fee_calculation
    );
    const total = calculateNetPayout(principal, interest, managementFee, redemptionFee);

    const payoutDate = maturityDate 
      ? maturityDate.format('YYYY-MM-DD')
      : valueDate.add(actualDays, 'day').format('YYYY-MM-DD');

    payouts.push({
      payoutDate,
      expectedPrincipal: principal,
      expectedInterest: interest,
      expectedManagementFee: managementFee,
      expectedRedemptionFee: redemptionFee,
      expectedTotal: total,
      periodStart: subscription.value_date,
      periodEnd: payoutDate,
      notes: '到期一次性还本付息'
    });
  } else {
    const periodStart = valueDate.clone();
    let periodEnd;

    let periodCount = 0;
    while (periodStart.isBefore(maturityDate) || periodStart.isSame(maturityDate, 'day')) {
      switch (payoutFrequency) {
        case 'daily':
          periodEnd = periodStart.clone();
          break;
        case 'monthly':
          periodEnd = periodStart.clone().add(1, 'month').subtract(1, 'day');
          if (periodEnd.isAfter(maturityDate)) {
            periodEnd = maturityDate.clone();
          }
          break;
        case 'quarterly':
          periodEnd = periodStart.clone().add(3, 'month').subtract(1, 'day');
          if (periodEnd.isAfter(maturityDate)) {
            periodEnd = maturityDate.clone();
          }
          break;
        default:
          periodEnd = maturityDate.clone();
      }

      if (periodEnd.isAfter(maturityDate)) {
        periodEnd = maturityDate.clone();
      }

      const daysInPeriod = calculateDaysBetween(
        periodStart.format('YYYY-MM-DD'),
        periodEnd.format('YYYY-MM-DD')
      );

      const isLastPeriod = periodEnd.isSame(maturityDate, 'day') || periodEnd.isAfter(maturityDate);
      const periodPrincipal = isLastPeriod ? principal : 0;

      const interest = calculateInterest(principal, annualRate, daysInPeriod, rule.rule_type);
      const managementFee = calculateManagementFee(
        principal, managementFeeRate, daysInPeriod, rule.management_fee_calculation
      );
      const redemptionFee = isLastPeriod ? calculateRedemptionFee(
        principal, redemptionFeeRate, actualDays, rule.redemption_fee_calculation
      ) : 0;
      const total = calculateNetPayout(periodPrincipal, interest, managementFee, redemptionFee);

      const payoutDate = periodEnd.add(1, 'day').format('YYYY-MM-DD');

      const frequencyLabels = {
        daily: '每日',
        monthly: '每月',
        quarterly: '每季'
      };

      payouts.push({
        payoutDate,
        expectedPrincipal: periodPrincipal,
        expectedInterest: interest,
        expectedManagementFee: managementFee,
        expectedRedemptionFee: redemptionFee,
        expectedTotal: total,
        periodStart: periodStart.format('YYYY-MM-DD'),
        periodEnd: periodEnd.format('YYYY-MM-DD'),
        notes: `${frequencyLabels[payoutFrequency] || '定期'}付息 (第${periodCount + 1}期)` + 
          (isLastPeriod ? ' - 含本金' : '')
      });

      periodStart = periodEnd.add(1, 'day');
      periodCount++;

      if (periodCount > 1000) break;
    }
  }

  return payouts;
};

export const calculatePayoutDetails = (expectedPayoutId) => {
  const payout = expectedPayoutModel.findById(expectedPayoutId);
  if (!payout) {
    return { success: false, error: '应到账记录不存在' };
  }

  const subscription = subscriptionModel.findById(payout.subscription_id);
  if (!subscription) {
    return { success: false, error: '认购记录不存在' };
  }

  const rule = payoutRuleModel.findByProductId(subscription.product_id) || {
    rule_type: 'actual/365',
    management_fee_calculation: 'daily_accrual',
    redemption_fee_calculation: 'fixed'
  };

  const daysInPeriod = payout.period_start && payout.period_end 
    ? calculateDaysBetween(payout.period_start, payout.period_end)
    : 0;

  const calculationBreakdown = {
    expectedPayout: payout,
    subscription,
    rule,
    calculations: {
      principal: payout.expected_principal,
      annualRate: subscription.expected_annual_rate,
      daysInPeriod,
      ruleType: rule.rule_type,
      interestCalculation: {
        formula: `利息 = 本金 × 年化收益率 × 持有天数 ÷ 年基数`,
        principal: payout.expected_principal || subscription.principal,
        annualRate: subscription.expected_annual_rate,
        holdingDays: daysInPeriod,
        daysInYear: rule.rule_type === 'actual/360' || rule.rule_type === '30/360' ? 360 : 365,
        result: payout.expected_interest
      },
      managementFeeCalculation: {
        formula: `管理费 = 本金 × 管理费率 × 持有天数 ÷ 365`,
        principal: subscription.principal,
        managementFeeRate: subscription.management_fee_rate || 0,
        holdingDays: daysInPeriod,
        calculationMethod: rule.management_fee_calculation,
        result: payout.expected_management_fee
      },
      redemptionFeeCalculation: {
        formula: `赎回费 = 本金 × 赎回费率`,
        principal: subscription.principal,
        redemptionFeeRate: subscription.redemption_fee_rate || 0,
        calculationMethod: rule.redemption_fee_calculation,
        result: payout.expected_redemption_fee
      },
      netPayout: {
        formula: `净到账 = 本金 + 利息 - 管理费 - 赎回费`,
        principal: payout.expected_principal,
        interest: payout.expected_interest,
        managementFee: payout.expected_management_fee,
        redemptionFee: payout.expected_redemption_fee,
        result: payout.expected_total
      }
    }
  };

  return {
    success: true,
    data: calculationBreakdown
  };
};

export default {
  generateExpectedPayouts,
  calculatePayoutDetails
};
