const store = require('../data/store');
const { service: berthingService } = require('./berthingService');
const { service: contractService } = require('./contractService');
const meterService = require('./meterService');
const { service: interruptionService } = require('./interruptionService');
const shipService = require('./shipService');
const { createError, ErrorCodes } = require('../utils/errors');
const moment = require('moment');

const SettlementStatuses = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID'
};

const MAX_EXPECTED_USAGE_DISCREPANCY = 0.2;

class SettlementService {
  calculateSettlement(berthingId) {
    const berthing = berthingService.getBerthing(berthingId);
    
    if (!berthingService.isCompleted(berthingId)) {
      throw createError(ErrorCodes.BERTHING_NOT_COMPLETED, {
        berthingId,
        currentStatus: berthing.status
      });
    }

    const usage = meterService.calculateUsage(berthingId);
    if (usage.readingCount < 2) {
      throw createError(ErrorCodes.NO_METER_READINGS, {
        berthingId,
        readingCount: usage.readingCount,
        message: '至少需要两次读数才能计算用电量'
      });
    }

    const contract = contractService.getActiveContract(
      berthing.shipId, 
      berthing.actualDeparture
    );

    const interruptionInfo = interruptionService.calculateTotalInterruptionHours(berthingId);
    const readings = meterService.getReadingsByBerthing(berthingId);

    const berthingDurationHours = moment(berthing.actualDeparture)
      .diff(moment(berthing.actualArrival), 'hours', true);
    
    const powerUsageDurationHours = moment(usage.lastReading.readingTime)
      .diff(moment(usage.firstReading.readingTime), 'hours', true);

    const details = this.calculateDetailedCost(
      readings,
      contract,
      interruptionInfo
    );

    const reviewIssues = this.checkForReviewIssues(
      usage,
      berthing,
      berthingDurationHours,
      powerUsageDurationHours,
      interruptionInfo
    );

    return {
      berthingId,
      shipId: berthing.shipId,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      totalKwh: usage.totalKwh,
      netKwh: details.netKwh,
      interruptionDeductionKwh: details.interruptionDeductionKwh,
      totalAmount: details.totalAmount,
      currency: contract.currency,
      berthingDurationHours,
      powerUsageDurationHours,
      effectiveUsageHours: powerUsageDurationHours - interruptionInfo.totalHours,
      interruptionInfo,
      priceBreakdown: details.breakdown,
      reviewRequired: reviewIssues.issues.length > 0,
      reviewIssues: reviewIssues.issues,
      reviewWarnings: reviewIssues.warnings,
      meterReadings: readings,
      timestamp: moment().toISOString()
    };
  }

  calculateDetailedCost(readings, contract, interruptionInfo) {
    if (readings.length < 2) {
      return {
        netKwh: 0,
        interruptionDeductionKwh: interruptionInfo.totalImpactKwh,
        totalAmount: 0,
        breakdown: []
      };
    }

    const totalKwh = readings[readings.length - 1].kwh - readings[0].kwh;
    const interruptionDeductionKwh = interruptionInfo.totalImpactKwh;
    const netKwh = Math.max(0, totalKwh - interruptionDeductionKwh);

    const breakdown = [];
    let totalAmount = 0;

    for (let i = 1; i < readings.length; i++) {
      const previous = readings[i - 1];
      const current = readings[i];
      const periodKwh = current.kwh - previous.kwh;
      
      if (periodKwh <= 0) continue;

      const price = contractService.getPriceForTime(contract, current.readingTime);
      const periodAmount = periodKwh * price;

      const periodInterruptionImpact = this.calculatePeriodInterruptionImpact(
        previous.readingTime,
        current.readingTime,
        interruptionInfo.interruptions
      );

      breakdown.push({
        period: `${previous.readingTime} - ${current.readingTime}`,
        startKwh: previous.kwh,
        endKwh: current.kwh,
        periodKwh,
        pricePerKwh: price,
        periodAmount,
        interruptionImpactKwh: periodInterruptionImpact
      });

      totalAmount += periodAmount;
    }

    const interruptionDeductionAmount = interruptionDeductionKwh * contract.electricityPrice;
    const netAmount = Math.max(0, totalAmount - interruptionDeductionAmount);

    if (contract.minimumCharge && netAmount < contract.minimumCharge) {
      breakdown.push({
        period: '最低消费补差额',
        periodKwh: 0,
        pricePerKwh: 0,
        periodAmount: contract.minimumCharge - netAmount,
        isMinimumCharge: true
      });
      totalAmount = contract.minimumCharge;
    }

    return {
      totalKwh,
      netKwh,
      interruptionDeductionKwh,
      interruptionDeductionAmount,
      totalAmount: netAmount,
      breakdown
    };
  }

  calculatePeriodInterruptionImpact(startTime, endTime, interruptions) {
    let impactKwh = 0;
    
    for (const interruption of interruptions) {
      if (!interruption.endTime) continue;
      
      const overlapStart = moment.max(moment(startTime), moment(interruption.startTime));
      const overlapEnd = moment.min(moment(endTime), moment(interruption.endTime));
      
      if (overlapStart.isBefore(overlapEnd)) {
        const overlapRatio = overlapEnd.diff(overlapStart, 'hours', true) / 
          moment(interruption.endTime).diff(moment(interruption.startTime), 'hours', true);
        
        impactKwh += (interruption.impactKwh || 0) * overlapRatio;
      }
    }
    
    return impactKwh;
  }

  checkForReviewIssues(usage, berthing, berthingDuration, powerUsageDuration, interruptionInfo) {
    const issues = [];
    const warnings = [];

    const durationDiscrepancy = Math.abs(berthingDuration - powerUsageDuration) / berthingDuration;
    if (durationDiscrepancy > MAX_EXPECTED_USAGE_DISCREPANCY) {
      issues.push({
        code: ErrorCodes.DURATION_DISCREPANCY,
        message: '用电时长与靠泊时段存在显著差异',
        details: {
          berthingDurationHours: berthingDuration,
          powerUsageDurationHours: powerUsageDuration,
          discrepancyRatio: durationDiscrepancy,
          maxAllowed: MAX_EXPECTED_USAGE_DISCREPANCY
        }
      });
    }

    if (interruptionInfo.totalHours > 0) {
      for (const interruption of interruptionInfo.interruptions) {
        const validation = interruptionService.validateInterruptionForReview(interruption);
        issues.push(...validation.issues);
        warnings.push(...validation.warnings);
      }
    }

    if (usage.readingCount < 3) {
      warnings.push({
        message: '读数次数较少，建议确认读数完整性',
        details: {
          readingCount: usage.readingCount,
          recommendedMinimum: 3
        }
      });
    }

    return { issues, warnings };
  }

  createSettlement(berthingId) {
    const calculation = this.calculateSettlement(berthingId);
    const berthing = berthingService.getBerthing(berthingId);
    const ship = shipService.getShip(berthing.shipId);

    const settlement = store.createSettlement({
      berthingId,
      shipId: berthing.shipId,
      shipName: ship.name,
      contractId: calculation.contractId,
      contractNumber: calculation.contractNumber,
      totalKwh: calculation.totalKwh,
      netKwh: calculation.netKwh,
      totalAmount: calculation.totalAmount,
      currency: calculation.currency,
      berthingDurationHours: calculation.berthingDurationHours,
      powerUsageDurationHours: calculation.powerUsageDurationHours,
      effectiveUsageHours: calculation.effectiveUsageHours,
      interruptionInfo: calculation.interruptionInfo,
      priceBreakdown: calculation.priceBreakdown,
      reviewRequired: calculation.reviewRequired,
      reviewIssues: calculation.reviewIssues,
      reviewWarnings: calculation.reviewWarnings,
      meterReadingCount: calculation.meterReadings.length,
      generatedBy: 'SYSTEM',
      generatedAt: moment().toISOString()
    });

    return settlement;
  }

  getSettlement(id) {
    const settlement = store.getSettlement(id);
    if (!settlement) {
      throw createError(ErrorCodes.SETTLEMENT_NOT_FOUND, { settlementId: id });
    }
    return settlement;
  }

  getSettlementsByBerthing(berthingId) {
    berthingService.getBerthing(berthingId);
    return store.getSettlementsByBerthing(berthingId);
  }

  getAllSettlements() {
    return store.getAllSettlements();
  }

  approveSettlement(id, reviewer = 'UNKNOWN') {
    const settlement = this.getSettlement(id);
    
    if (settlement.status !== SettlementStatuses.PENDING_REVIEW) {
      throw createError(ErrorCodes.SETTLEMENT_ALREADY_REVIEWED, {
        currentStatus: settlement.status
      });
    }

    return store.updateSettlementStatus(id, SettlementStatuses.APPROVED, {
      reviewedBy: reviewer,
      reviewedAt: moment().toISOString(),
      reviewNotes: '已通过复核'
    });
  }

  rejectSettlement(id, reason, reviewer = 'UNKNOWN') {
    const settlement = this.getSettlement(id);
    
    if (settlement.status !== SettlementStatuses.PENDING_REVIEW) {
      throw createError(ErrorCodes.SETTLEMENT_ALREADY_REVIEWED, {
        currentStatus: settlement.status
      });
    }

    return store.updateSettlementStatus(id, SettlementStatuses.REJECTED, {
      reviewedBy: reviewer,
      reviewedAt: moment().toISOString(),
      reviewNotes: reason || '被驳回'
    });
  }

  markAsPaid(id, paymentReference = null) {
    const settlement = this.getSettlement(id);
    
    if (settlement.status !== SettlementStatuses.APPROVED) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus: settlement.status,
        message: '只有已批准的结算可以标记为已支付'
      });
    }

    return store.updateSettlementStatus(id, SettlementStatuses.PAID, {
      paidAt: moment().toISOString(),
      paymentReference
    });
  }

  generateReconciliationReport(settlementIds = null) {
    const settlements = settlementIds 
      ? settlementIds.map(id => this.getSettlement(id))
      : this.getAllSettlements();

    const approvedSettlements = settlements.filter(s => 
      s.status === SettlementStatuses.APPROVED || s.status === SettlementStatuses.PAID
    );

    const stats = {
      totalCount: settlements.length,
      pendingCount: settlements.filter(s => s.status === SettlementStatuses.PENDING_REVIEW).length,
      approvedCount: approvedSettlements.length,
      rejectedCount: settlements.filter(s => s.status === SettlementStatuses.REJECTED).length,
      paidCount: settlements.filter(s => s.status === SettlementStatuses.PAID).length,
      totalKwh: 0,
      netKwh: 0,
      totalAmount: 0,
      paidAmount: 0,
      currency: 'CNY'
    };

    approvedSettlements.forEach(s => {
      stats.totalKwh += s.totalKwh;
      stats.netKwh += s.netKwh;
      stats.totalAmount += s.totalAmount;
      if (s.status === SettlementStatuses.PAID) {
        stats.paidAmount += s.totalAmount;
      }
    });

    const report = store.createReconciliationReport({
      period: moment().format('YYYY-MM-DD'),
      stats,
      settlements: approvedSettlements.map(s => ({
        id: s.id,
        berthingId: s.berthingId,
        shipName: s.shipName,
        totalKwh: s.totalKwh,
        netKwh: s.netKwh,
        totalAmount: s.totalAmount,
        status: s.status
      })),
      generatedAt: moment().toISOString()
    });

    return report;
  }

  getReconciliationReport(id) {
    return store.getReconciliationReport(id);
  }

  getAllReconciliationReports() {
    return store.getAllReconciliationReports();
  }
}

module.exports = {
  service: new SettlementService(),
  SettlementStatuses
};
