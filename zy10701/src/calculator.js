const { CONFIG } = require('./config');

class OverageCalculator {
  constructor() {
    this.packageConfig = CONFIG.PACKAGE_CONFIG;
  }

  calculateUserOverage(records) {
    const userRecords = {};
    
    records.forEach(record => {
      const userId = record['用户ID'];
      if (!userRecords[userId]) {
        userRecords[userId] = {
          records: [],
          totalDataGB: 0,
          totalVoiceMinutes: 0,
          totalSmsCount: 0,
          totalPackageFee: 0,
          totalDiscountAmount: 0,
          totalActualPayment: 0,
        };
      }
      
      userRecords[userId].records.push(record);
      
      const dataGB = parseFloat(record['数据用量_GB']) || 0;
      const voiceMinutes = parseFloat(record['语音时长_分钟']) || 0;
      const smsCount = parseFloat(record['短信条数']) || 0;
      const packageFee = parseFloat(record['套餐费用']) || 0;
      const discountAmount = parseFloat(record['减免金额']) || 0;
      const actualPayment = parseFloat(record['实际支付']) || 0;
      
      userRecords[userId].totalDataGB += dataGB;
      userRecords[userId].totalVoiceMinutes += voiceMinutes;
      userRecords[userId].totalSmsCount += smsCount;
      userRecords[userId].totalPackageFee += packageFee;
      userRecords[userId].totalDiscountAmount += discountAmount;
      userRecords[userId].totalActualPayment += actualPayment;
    });

    const results = [];
    Object.entries(userRecords).forEach(([userId, data]) => {
      const result = this.calculateSingleUser(userId, data);
      results.push(result);
    });

    return results;
  }

  calculateSingleUser(userId, data) {
    const {
      DATA_LIMIT_GB,
      VOICE_LIMIT_MINUTES,
      SMS_LIMIT_COUNT,
      DATA_OVERAGE_RATE,
      VOICE_OVERAGE_RATE,
      SMS_OVERAGE_RATE,
    } = this.packageConfig;

    const dataOverage = Math.max(0, data.totalDataGB - DATA_LIMIT_GB);
    const voiceOverage = Math.max(0, data.totalVoiceMinutes - VOICE_LIMIT_MINUTES);
    const smsOverage = Math.max(0, data.totalSmsCount - SMS_LIMIT_COUNT);

    const dataOverageFee = dataOverage * DATA_OVERAGE_RATE;
    const voiceOverageFee = voiceOverage * VOICE_OVERAGE_RATE;
    const smsOverageFee = smsOverage * SMS_OVERAGE_RATE;

    const totalOverageFee = dataOverageFee + voiceOverageFee + smsOverageFee;

    const expectedPayment = data.totalPackageFee + totalOverageFee - data.totalDiscountAmount;
    const discountDifference = Math.abs(expectedPayment - data.totalActualPayment);

    return {
      userId,
      usageSummary: {
        dataGB: this.round2(data.totalDataGB),
        voiceMinutes: this.round2(data.totalVoiceMinutes),
        smsCount: Math.round(data.totalSmsCount),
        dataLimitGB: DATA_LIMIT_GB,
        voiceLimitMinutes: VOICE_LIMIT_MINUTES,
        smsLimitCount: SMS_LIMIT_COUNT,
      },
      overageDetails: {
        dataOverageGB: this.round2(dataOverage),
        voiceOverageMinutes: this.round2(voiceOverage),
        smsOverageCount: Math.round(smsOverage),
        dataOverageFee: this.round2(dataOverageFee),
        voiceOverageFee: this.round2(voiceOverageFee),
        smsOverageFee: this.round2(smsOverageFee),
        totalOverageFee: this.round2(totalOverageFee),
      },
      financialSummary: {
        totalPackageFee: this.round2(data.totalPackageFee),
        totalDiscountAmount: this.round2(data.totalDiscountAmount),
        totalActualPayment: this.round2(data.totalActualPayment),
        expectedPayment: this.round2(expectedPayment),
        discountDifference: this.round2(discountDifference),
      },
      sourceRecords: data.records.map(r => ({
        fileName: r._meta.fileName,
        lineNumber: r._meta.lineNumber,
        billingMonth: r['计费月份'],
        billNumber: r['账单编号'],
      })),
    };
  }

  calculateTotals(results) {
    const totals = {
      userCount: results.length,
      overageUserCount: 0,
      totalDataOverageGB: 0,
      totalVoiceOverageMinutes: 0,
      totalSmsOverageCount: 0,
      totalOverageFee: 0,
      totalDiscountDifference: 0,
    };

    results.forEach(r => {
      if (r.overageDetails.totalOverageFee > 0) {
        totals.overageUserCount++;
      }
      totals.totalDataOverageGB += r.overageDetails.dataOverageGB;
      totals.totalVoiceOverageMinutes += r.overageDetails.voiceOverageMinutes;
      totals.totalSmsOverageCount += r.overageDetails.smsOverageCount;
      totals.totalOverageFee += r.overageDetails.totalOverageFee;
      totals.totalDiscountDifference += r.financialSummary.discountDifference;
    });

    return {
      userCount: totals.userCount,
      overageUserCount: totals.overageUserCount,
      totalDataOverageGB: this.round2(totals.totalDataOverageGB),
      totalVoiceOverageMinutes: this.round2(totals.totalVoiceOverageMinutes),
      totalSmsOverageCount: totals.totalSmsOverageCount,
      totalOverageFee: this.round2(totals.totalOverageFee),
      totalDiscountDifference: this.round2(totals.totalDiscountDifference),
    };
  }

  round2(value) {
    return Math.round(value * 100) / 100;
  }
}

module.exports = OverageCalculator;
