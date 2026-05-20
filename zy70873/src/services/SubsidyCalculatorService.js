const moment = require('moment');
const { CalculationResult } = require('../models/CalculationResult');

class SubsidyCalculatorService {
  constructor() {
    this.dailySubsidyTracker = new Map();
    this.totalSubsidyTracker = new Map();
  }

  calculate(showtimes, boxOffices, contractRules, batchId = null) {
    const result = new CalculationResult();
    if (batchId) result.setBatchId(batchId);

    const activeRules = contractRules.filter(rule => rule.isActive);

    for (const showtime of showtimes) {
      this.processShowtime(showtime, activeRules, result, boxOffices);
    }

    return result.finalize();
  }

  processShowtime(showtime, activeRules, result, boxOffices) {
    const validationErrors = showtime.validate();
    if (validationErrors.length > 0) {
      result.addFailedItem(
        showtime,
        { boxOffice: showtime.getNetBoxOffice() },
        validationErrors,
        '请检查并修正场次数据中的必填字段'
      );
      return;
    }

    const applicableRules = this.findApplicableRules(showtime, activeRules);

    if (applicableRules.length === 0) {
      result.addPendingItem(
        showtime,
        { boxOffice: showtime.getNetBoxOffice() },
        '未找到匹配的合同规则',
        '请检查该影片/影院是否有对应的补贴规则，或确认规则生效日期'
      );
      return;
    }

    this.calculateShowtimeSubsidy(showtime, applicableRules, result, boxOffices);
  }

  findApplicableRules(showtime, activeRules) {
    return activeRules.filter(rule => {
      return rule.isEffective(showtime.showDate) &&
             rule.matchesCinema(showtime.cinemaId) &&
             rule.matchesFilm(showtime.filmId);
    }).sort((a, b) => b.priority - a.priority);
  }

  calculateShowtimeSubsidy(showtime, applicableRules, result, boxOffices) {
    let totalSubsidy = 0;
    const calculationDetails = [];
    const warnings = [];

    const isCrossDay = showtime.isCrossDay();
    const refundDeduction = this.calculateRefundDeduction(showtime, applicableRules);

    result.addRefundDeduction(refundDeduction);

    for (const rule of applicableRules) {
      const ruleResult = this.applyRule(showtime, rule, isCrossDay);
      
      if (ruleResult.applicable) {
        const cappedAmount = this.applySubsidyCaps(ruleResult.amount, showtime, rule);
        
        if (cappedAmount < ruleResult.amount) {
          warnings.push(`规则"${rule.ruleName}"因达到补贴上限，补贴金额从${ruleResult.amount}调整为${cappedAmount}`);
        }

        totalSubsidy += cappedAmount;
        calculationDetails.push({
          ruleId: rule.id,
          ruleName: rule.ruleName,
          baseAmount: ruleResult.baseAmount,
          crossDayMultiplier: ruleResult.crossDayMultiplier,
          calculatedAmount: ruleResult.amount,
          cappedAmount: cappedAmount
        });
      }
    }

    const boxOfficeCheck = this.checkBoxOfficeCommitment(showtime, applicableRules, boxOffices);
    if (boxOfficeCheck.needsConfirmation) {
      warnings.push(boxOfficeCheck.message);
    }

    const ticketPriceCheck = this.checkTicketPriceRange(showtime, applicableRules);
    if (ticketPriceCheck.needsConfirmation) {
      warnings.push(ticketPriceCheck.message);
    }

    const finalDetail = {
      boxOffice: showtime.getNetBoxOffice(),
      isCrossDay: isCrossDay,
      refundDeduction: refundDeduction,
      subsidyAmount: Math.round(totalSubsidy * 100) / 100,
      ruleDetails: calculationDetails
    };

    if (warnings.length > 0) {
      result.addPendingItem(
        showtime,
        finalDetail,
        warnings.join('; '),
        '请人工确认上述警告事项后再通过'
      );
    } else {
      result.addNormalItem(showtime, finalDetail);
    }
  }

  applyRule(showtime, rule, isCrossDay) {
    let baseAmount = 0;
    let crossDayMultiplier = 1;

    switch (rule.subsidyType) {
      case 'per_show':
        baseAmount = rule.subsidyAmount;
        break;
      case 'per_ticket':
        baseAmount = (showtime.soldSeats - showtime.refundedCount) * rule.subsidyAmount;
        break;
      case 'box_office_percentage':
        baseAmount = showtime.getNetBoxOffice() * rule.subsidyRate;
        break;
      default:
        return { applicable: false, amount: 0 };
    }

    if (isCrossDay) {
      crossDayMultiplier = rule.crossDaySubsidyMultiplier;
      baseAmount *= crossDayMultiplier;
    }

    return {
      applicable: true,
      baseAmount: rule.subsidyAmount,
      crossDayMultiplier: crossDayMultiplier,
      amount: baseAmount
    };
  }

  calculateRefundDeduction(showtime, applicableRules) {
    if (showtime.refundedCount === 0) return 0;

    const maxDeductionRate = Math.max(...applicableRules.map(r => r.refundDeductionRate));
    const deduction = showtime.refundedCount * showtime.ticketPrice * maxDeductionRate;
    
    return deduction;
  }

  applySubsidyCaps(amount, showtime, rule) {
    const dateKey = `${showtime.showDate}_${rule.id || 'default'}`;
    const ruleKey = rule.id || 'default';

    if (rule.dailySubsidyCap !== null) {
      const currentDaily = this.dailySubsidyTracker.get(dateKey) || 0;
      const remaining = rule.dailySubsidyCap - currentDaily;
      
      if (remaining <= 0) return 0;
      amount = Math.min(amount, remaining);
      this.dailySubsidyTracker.set(dateKey, currentDaily + amount);
    }

    if (rule.totalSubsidyCap !== null) {
      const currentTotal = this.totalSubsidyTracker.get(ruleKey) || 0;
      const remaining = rule.totalSubsidyCap - currentTotal;
      
      if (remaining <= 0) return 0;
      amount = Math.min(amount, remaining);
      this.totalSubsidyTracker.set(ruleKey, currentTotal + amount);
    }

    return amount;
  }

  checkBoxOfficeCommitment(showtime, applicableRules, boxOffices) {
    const ruleWithCommitment = applicableRules.find(r => r.minBoxOfficeCommitment > 0);
    
    if (!ruleWithCommitment) {
      return { needsConfirmation: false };
    }

    const dailyBoxOffice = boxOffices.find(bo => 
      bo.cinemaId === showtime.cinemaId &&
      bo.filmId === showtime.filmId &&
      bo.statDate === showtime.showDate
    );

    if (!dailyBoxOffice) {
      return {
        needsConfirmation: true,
        message: `缺少${showtime.showDate}的票房数据，无法验证最低票房承诺`
      };
    }

    if (dailyBoxOffice.netBoxOffice < ruleWithCommitment.minBoxOfficeCommitment) {
      return {
        needsConfirmation: true,
        message: `当日净票房(${dailyBoxOffice.netBoxOffice})低于最低票房承诺(${ruleWithCommitment.minBoxOfficeCommitment})`
      };
    }

    return { needsConfirmation: false };
  }

  checkTicketPriceRange(showtime, applicableRules) {
    const ruleWithPriceCheck = applicableRules.find(r => r.minTicketPrice > 0 || r.maxTicketPrice !== null);
    
    if (!ruleWithPriceCheck) {
      return { needsConfirmation: false };
    }

    if (ruleWithPriceCheck.minTicketPrice > 0 && showtime.ticketPrice < ruleWithPriceCheck.minTicketPrice) {
      return {
        needsConfirmation: true,
        message: `票价(${showtime.ticketPrice})低于规则最低票价要求(${ruleWithPriceCheck.minTicketPrice})`
      };
    }

    if (ruleWithPriceCheck.maxTicketPrice !== null && showtime.ticketPrice > ruleWithPriceCheck.maxTicketPrice) {
      return {
        needsConfirmation: true,
        message: `票价(${showtime.ticketPrice})高于规则最高票价限制(${ruleWithPriceCheck.maxTicketPrice})`
      };
    }

    return { needsConfirmation: false };
  }
}

module.exports = SubsidyCalculatorService;
