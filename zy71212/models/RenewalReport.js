const moment = require('moment');

class RenewalReport {
  constructor(data = {}) {
    this.reportId = data.reportId || '';
    this.reportDate = data.reportDate || moment().format('YYYY-MM-DD');
    this.reportPeriod = data.reportPeriod || '';
    this.generatedBy = data.generatedBy || '';
    this.summary = data.summary || {
      totalPolicies: 0,
      duePolicies: 0,
      overduePolicies: 0,
      inGracePolicies: 0,
      graceExpiredPolicies: 0,
      paidPolicies: 0,
      advancePaymentPolicies: 0,
      stopIntentPolicies: 0,
      pendingFollowUp: 0,
      totalPremiumDue: 0,
      totalPremiumPaid: 0,
      totalPremiumOverdue: 0
    };
    this.details = data.details || [];
    this.recommendations = data.recommendations || [];
    this.status = data.status || '草稿';
    this.createdAt = data.createdAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.updatedAt = data.updatedAt || moment().format('YYYY-MM-DD HH:mm:ss');
    this.missingFields = [];
  }

  validate() {
    this.missingFields = [];
    if (!this.reportDate) this.missingFields.push('报告日期');
    return this.missingFields.length === 0;
  }

  addRecommendation(type, description, priority = '中') {
    this.recommendations.push({
      id: `REC_${Date.now()}_${this.recommendations.length}`,
      type,
      description,
      priority,
      status: '待处理',
      createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  addPolicyDetail(policyDetail) {
    this.details.push({
      ...policyDetail,
      addedAt: moment().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  updateSummary() {
    const summary = {
      totalPolicies: this.details.length,
      duePolicies: this.details.filter(d => d.status === '待缴费' || d.status === '宽限期内').length,
      overduePolicies: this.details.filter(d => d.isOverdue).length,
      inGracePolicies: this.details.filter(d => d.isInGracePeriod).length,
      graceExpiredPolicies: this.details.filter(d => d.isGraceExpired).length,
      paidPolicies: this.details.filter(d => d.status === '已缴费').length,
      advancePaymentPolicies: this.details.filter(d => d.hasAdvancePayment).length,
      stopIntentPolicies: this.details.filter(d => d.hasStopIntent).length,
      pendingFollowUp: this.details.filter(d => d.needsFollowUp).length,
      totalPremiumDue: this.details.reduce((sum, d) => sum + (d.premium || 0), 0),
      totalPremiumPaid: this.details.reduce((sum, d) => sum + (d.paidAmount || 0), 0),
      totalPremiumOverdue: this.details.filter(d => d.isOverdue).reduce((sum, d) => sum + (d.premium || 0), 0)
    };
    this.summary = summary;
    return summary;
  }

  generateRecommendations() {
    this.recommendations = [];
    
    const urgentGrace = this.details.filter(d => d.isInGracePeriod && d.daysRemainingInGrace <= 7 && !d.hasStopIntent);
    if (urgentGrace.length > 0) {
      this.addRecommendation(
        '紧急催缴',
        `${urgentGrace.length}份保单宽限期剩余7天以内，需立即跟进`,
        '高'
      );
    }

    const expiredGrace = this.details.filter(d => d.isGraceExpired && !d.hasStopIntent && d.status !== '已缴费');
    if (expiredGrace.length > 0) {
      this.addRecommendation(
        '宽限期已满',
        `${expiredGrace.length}份保单宽限期已满，需确认是否办理复效或退保`,
        '高'
      );
    }

    const pendingFollowUp = this.details.filter(d => d.needsFollowUp);
    if (pendingFollowUp.length > 0) {
      this.addRecommendation(
        '待跟进回访',
        `${pendingFollowUp.length}份保单需要跟进回访`,
        '中'
      );
    }

    const advancePayment = this.details.filter(d => d.hasAdvancePayment && !d.advanceRepaid);
    if (advancePayment.length > 0) {
      this.addRecommendation(
        '垫交还款提醒',
        `${advancePayment.length}份保单存在自动垫交，需提醒客户还款`,
        '中'
      );
    }

    const stopIntent = this.details.filter(d => d.hasStopIntent);
    if (stopIntent.length > 0) {
      this.addRecommendation(
        '停意愿确认',
        `${stopIntent.length}份保单客户表示停保意愿，需最终确认并办理相关手续`,
        '中'
      );
    }

    const noContact = this.details.filter(d => d.lastContactResult === '未联系上' && d.needsFollowUp);
    if (noContact.length > 0) {
      this.addRecommendation(
        '失联客户处理',
        `${noContact.length}份保单客户多次联系不上，需考虑其他联系方式或上门回访`,
        '中'
      );
    }

    return this.recommendations;
  }

  toJSON() {
    return {
      reportId: this.reportId,
      reportDate: this.reportDate,
      reportPeriod: this.reportPeriod,
      generatedBy: this.generatedBy,
      summary: this.summary,
      details: this.details,
      recommendations: this.recommendations,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      missingFields: this.missingFields
    };
  }

  static fromJSON(json) {
    return new RenewalReport(json);
  }
}

module.exports = RenewalReport;
