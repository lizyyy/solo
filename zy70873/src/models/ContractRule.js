const moment = require('moment');

class ContractRule {
  constructor(data) {
    this.id = data.id || data.rule_id || null;
    this.ruleName = data.rule_name || data.ruleName || null;
    this.filmId = data.film_id || data.filmId || null;
    this.filmName = data.film_name || data.filmName || null;
    this.cinemaId = data.cinema_id || data.cinemaId || null;
    this.cinemaName = data.cinema_name || data.cinemaName || null;
    this.startDate = data.start_date || data.startDate || null;
    this.endDate = data.end_date || data.endDate || null;
    this.ruleType = data.rule_type || data.ruleType || 'subsidy';
    this.subsidyType = data.subsidy_type || data.subsidyType || 'per_show';
    this.subsidyAmount = parseFloat(data.subsidy_amount || data.subsidyAmount || 0);
    this.subsidyRate = parseFloat(data.subsidy_rate || data.subsidyRate || 0);
    this.dailySubsidyCap = parseFloat(data.daily_subsidy_cap || data.dailySubsidyCap || null);
    this.totalSubsidyCap = parseFloat(data.total_subsidy_cap || data.totalSubsidyCap || null);
    this.minBoxOfficeCommitment = parseFloat(data.min_box_office_commitment || data.minBoxOfficeCommitment || 0);
    this.minShowCount = parseInt(data.min_show_count || data.minShowCount || 0);
    this.refundDeductionRate = parseFloat(data.refund_deduction_rate || data.refundDeductionRate || 0.3);
    this.crossDaySubsidyMultiplier = parseFloat(data.cross_day_subsidy_multiplier || data.crossDaySubsidyMultiplier || 1.2);
    this.minTicketPrice = parseFloat(data.min_ticket_price || data.minTicketPrice || 0);
    this.maxTicketPrice = parseFloat(data.max_ticket_price || data.maxTicketPrice || null);
    this.isActive = data.is_active !== undefined ? data.is_active : true;
    this.priority = parseInt(data.priority || 0);
    this.batchId = data.batchId || null;
    this.sourceFile = data.sourceFile || null;
  }

  isEffective(date) {
    if (!this.startDate && !this.endDate) return true;
    const checkDate = moment(date, 'YYYY-MM-DD');
    if (this.startDate && checkDate.isBefore(moment(this.startDate, 'YYYY-MM-DD'), 'day')) return false;
    if (this.endDate && checkDate.isAfter(moment(this.endDate, 'YYYY-MM-DD'), 'day')) return false;
    return true;
  }

  matchesCinema(cinemaId) {
    if (!this.cinemaId) return true;
    return this.cinemaId === cinemaId;
  }

  matchesFilm(filmId) {
    if (!this.filmId) return true;
    return this.filmId === filmId;
  }

  validate() {
    const errors = [];
    if (!this.ruleName) errors.push('规则名称不能为空');
    if (this.subsidyAmount < 0) errors.push('补贴金额不能为负数');
    if (this.subsidyRate < 0 || this.subsidyRate > 1) errors.push('补贴比例必须在0-1之间');
    if (this.minBoxOfficeCommitment < 0) errors.push('最低票房承诺不能为负数');
    if (this.refundDeductionRate < 0 || this.refundDeductionRate > 1) errors.push('退票扣减比例必须在0-1之间');
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      ruleName: this.ruleName,
      filmId: this.filmId,
      filmName: this.filmName,
      cinemaId: this.cinemaId,
      cinemaName: this.cinemaName,
      startDate: this.startDate,
      endDate: this.endDate,
      ruleType: this.ruleType,
      subsidyType: this.subsidyType,
      subsidyAmount: this.subsidyAmount,
      subsidyRate: this.subsidyRate,
      dailySubsidyCap: this.dailySubsidyCap,
      totalSubsidyCap: this.totalSubsidyCap,
      minBoxOfficeCommitment: this.minBoxOfficeCommitment,
      minShowCount: this.minShowCount,
      refundDeductionRate: this.refundDeductionRate,
      crossDaySubsidyMultiplier: this.crossDaySubsidyMultiplier,
      minTicketPrice: this.minTicketPrice,
      maxTicketPrice: this.maxTicketPrice,
      isActive: this.isActive,
      priority: this.priority
    };
  }
}

module.exports = ContractRule;
