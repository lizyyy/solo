const COMPENSATION_CONFIG = {
  weightTolerance: {
    enabled: true,
    tolerancePercent: 2,
    toleranceFixed: 0.02,
    unit: 'kg'
  },
  duplicateCheck: {
    enabled: true,
    timeWindowDays: 7
  },
  timeLimit: {
    enabled: true,
    complaintTimeLimitHours: 48,
    fromDelivery: true
  },
  partialCompensation: {
    enabled: true,
    minimumShortagePercent: 5,
    minimumShortageWeight: 0.05
  },
  compensationRatio: {
    baseRatio: 1.0,
    penaltyRatio: 2.0,
    applyPenalty: true,
    penaltyThresholdPercent: 10
  }
};

class CompensationRuleEngine {
  constructor(config = COMPENSATION_CONFIG) {
    this.config = config;
  }

  checkWeightTolerance(expectedWeight, actualWeight) {
    if (!this.config.weightTolerance.enabled) {
      return { isWithinTolerance: false, diff: actualWeight - expectedWeight };
    }

    const diff = actualWeight - expectedWeight;
    const isShortage = diff < 0;
    
    if (!isShortage) {
      return { isWithinTolerance: true, diff };
    }

    const shortageAmount = Math.abs(diff);
    const toleranceByPercent = expectedWeight * (this.config.weightTolerance.tolerancePercent / 100);
    const maxTolerance = Math.max(toleranceByPercent, this.config.weightTolerance.toleranceFixed);

    return {
      isWithinTolerance: shortageAmount <= maxTolerance,
      diff,
      shortageAmount,
      maxTolerance,
      toleranceByPercent,
      toleranceFixed: this.config.weightTolerance.toleranceFixed
    };
  }

  checkTimeLimit(deliveryTime, filedTime) {
    if (!this.config.timeLimit.enabled || !deliveryTime) {
      return { withinLimit: true };
    }

    const delivery = new Date(deliveryTime);
    const filed = new Date(filedTime);
    const hoursDiff = (filed - delivery) / (1000 * 60 * 60);
    const limitHours = this.config.timeLimit.complaintTimeLimitHours;

    return {
      withinLimit: hoursDiff <= limitHours,
      hoursDiff,
      limitHours,
      exceededBy: hoursDiff - limitHours
    };
  }

  checkPartialShortage(itemShortages) {
    if (!this.config.partialCompensation.enabled) {
      return { eligible: false, items: [] };
    }

    const eligibleItems = [];
    
    for (const item of itemShortages) {
      const shortagePercent = (Math.abs(item.shortageWeight) / item.expectedWeight) * 100;
      const meetsMinWeight = Math.abs(item.shortageWeight) >= this.config.partialCompensation.minimumShortageWeight;
      const meetsMinPercent = shortagePercent >= this.config.partialCompensation.minimumShortagePercent;

      if (meetsMinWeight || meetsMinPercent) {
        eligibleItems.push({
          ...item,
          shortagePercent,
          meetsMinWeight,
          meetsMinPercent
        });
      }
    }

    return {
      eligible: eligibleItems.length > 0,
      items: eligibleItems
    };
  }

  calculateCompensation(item) {
    const { expectedWeight, actualWeight, unitPrice, ...otherFields } = item;
    const shortageWeight = expectedWeight - actualWeight;
    const shortagePercent = (shortageWeight / expectedWeight) * 100;
    
    let compensationRatio = this.config.compensationRatio.baseRatio;
    let penaltyApplied = false;
    
    if (this.config.compensationRatio.applyPenalty && 
        shortagePercent >= this.config.compensationRatio.penaltyThresholdPercent) {
      compensationRatio = this.config.compensationRatio.penaltyRatio;
      penaltyApplied = true;
    }

    const baseCompensation = shortageWeight * unitPrice;
    const finalCompensation = baseCompensation * compensationRatio;

    return {
      ...otherFields,
      expectedWeight,
      actualWeight,
      shortageWeight,
      shortagePercent,
      unitPrice,
      baseCompensation,
      compensationRatio,
      penaltyApplied,
      finalCompensation
    };
  }

  calculateBatchCompensation(items) {
    const results = items.map(item => this.calculateCompensation(item));
    const totalShortageWeight = results.reduce((sum, r) => sum + r.shortageWeight, 0);
    const totalBaseCompensation = results.reduce((sum, r) => sum + r.baseCompensation, 0);
    const totalFinalCompensation = results.reduce((sum, r) => sum + r.finalCompensation, 0);

    return {
      items: results,
      totalShortageWeight,
      totalBaseCompensation,
      totalFinalCompensation,
      rulesApplied: {
        tolerance: this.config.weightTolerance,
        ratio: this.config.compensationRatio,
        partial: this.config.partialCompensation
      }
    };
  }

  checkDuplicateComplaint(existingComplaints, newComplaint) {
    if (!this.config.duplicateCheck.enabled) {
      return { isDuplicate: false };
    }

    const windowMs = this.config.duplicateCheck.timeWindowDays * 24 * 60 * 60 * 1000;
    const now = new Date();

    for (const existing of existingComplaints) {
      if (existing.orderId !== newComplaint.orderId) continue;
      if (existing.status === 'CANCELLED') continue;
      
      const filedDate = new Date(existing.filedTime);
      const timeDiff = now - filedDate;
      
      if (timeDiff <= windowMs) {
        const sameItems = this.hasSameItems(existing.complaintItems, newComplaint.complaintItems);
        if (sameItems) {
          return {
            isDuplicate: true,
            existingComplaintNo: existing.complaintNo,
            existingComplaintId: existing.id,
            timeDiffMs: timeDiff,
            windowMs
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  hasSameItems(items1, items2) {
    if (items1.length !== items2.length) return false;
    
    const productIds1 = new Set(items1.map(i => i.productId));
    const productIds2 = new Set(items2.map(i => i.productId));
    
    if (productIds1.size !== productIds2.size) return false;
    
    for (const id of productIds1) {
      if (!productIds2.has(id)) return false;
    }
    
    return true;
  }
}

module.exports = {
  CompensationRuleEngine,
  COMPENSATION_CONFIG
};
