const moment = require('moment');
const db = require('../config/database');

class BusinessRules {
  static validateDeadlineChange(oldDeadline, newDeadline, reason) {
    const oldDate = moment(oldDeadline);
    const newDate = moment(newDeadline);
    
    if (newDate.isBefore(oldDate)) {
      return { valid: false, reason: '新期限不能早于原期限' };
    }
    
    const maxExtension = 7;
    if (newDate.diff(oldDate, 'days') > maxExtension) {
      return { valid: false, reason: `延期不能超过${maxExtension}天，需人工审批` };
    }
    
    if (!reason || reason.length < 10) {
      return { valid: false, reason: '延期理由长度不足10个字符' };
    }
    
    return { valid: true };
  }

  static validateReviewOpinion(hazardStatus, opinion) {
    if (hazardStatus !== '待复查') {
      return { valid: false, reason: '当前状态不允许提交复查意见' };
    }
    
    if (!opinion || opinion.length < 5) {
      return { valid: false, reason: '复查意见过短，需详细说明' };
    }
    
    const abnormalKeywords = ['看不懂', '不知道', '随便', '无所谓'];
    for (const keyword of abnormalKeywords) {
      if (opinion.includes(keyword)) {
        return { valid: false, reason: `复查意见包含异常关键词: ${keyword}` };
      }
    }
    
    return { valid: true };
  }

  static calculateOverdueFine(deadline, reviewDate, riskLevel) {
    const daysOverdue = moment(reviewDate).diff(moment(deadline), 'days');
    
    if (daysOverdue <= 0) {
      return { overdue: false, amount: 0 };
    }
    
    const baseRates = {
      '低': 50,
      '中': 100,
      '高': 200,
      '极高': 500
    };
    
    const baseRate = baseRates[riskLevel] || 100;
    const totalFine = baseRate * Math.min(daysOverdue, 30);
    
    return {
      overdue: true,
      daysOverdue,
      amount: totalFine,
      reason: `逾期${daysOverdue}天，按${riskLevel}风险等级计算`
    };
  }

  static validateFineReview(fineStatus, newStatus, reviewer) {
    if (fineStatus !== '待复核') {
      return { valid: false, reason: '只有待复核状态的罚款可以复核' };
    }
    
    if (!reviewer) {
      return { valid: false, reason: '复核人不能为空' };
    }
    
    return { valid: true };
  }

  static isHighRisk(hazard) {
    return ['高', '极高'].includes(hazard.risk_level);
  }
}

module.exports = BusinessRules;