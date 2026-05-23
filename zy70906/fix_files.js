const fs = require('fs');

const pointsCalculatorPath = '/Users/lzy/pro/solo/workspaces/zy70906/src/services/pointsCalculator.js';
const discrepancyDetectorPath = '/Users/lzy/pro/solo/workspaces/zy70906/src/services/discrepancyDetector.js';

const pointsCalculatorContent = `const store = require("../store");

class PointsCalculator {
  calculateExpectedPoints(receipt, member) {
    if (!receipt || !member) {
      return { points: 0, details: {} };
    }

    const basePoints = Math.floor(receipt.amount);
    const memberMultiplier = member.getPointsMultiplier();
    let finalPoints = basePoints * memberMultiplier;
    const details = {
      baseAmount: receipt.amount,
      basePoints: basePoints,
      memberLevel: member.level,
      memberMultiplier: memberMultiplier
    };

    const promotions = store.getAllPromotions();
    let appliedPromotions = [];
    
    for (const promo of promotions) {
      if (promo.isApplicable(receipt.transactionDate, receipt.storeId, receipt.amount)) {
        finalPoints *= promo.pointsMultiplier;
        appliedPromotions.push({
          id: promo.id,
          name: promo.name,
          multiplier: promo.pointsMultiplier,
          points: finalPoints
        });
      }
    }

    details.appliedPromotions = appliedPromotions;
    details.finalPoints = Math.floor(finalPoints);

    return { points: Math.floor(finalPoints), details };
  }

  calculatePointsForReceipt(receipt) {
    const member = store.getMember(receipt.memberNo);
    return this.calculateExpectedPoints(receipt, member);
  }

  calculateAllReconciliations() {
    const receipts = store.getAllReceipts();
    const recons = store.getAllReconciliations();
    
    for (const recon of recons) {
      if (recon.status === 'approved' || recon.status === 'rejected') continue;
      const receipt = store.getReceipt(recon.receiptId);
      const member = store.getMember(recon.memberNo);
      if (receipt) {
        const result = this.calculateExpectedPoints(receipt, member);
        recon.expectedPoints = result.points;
        recon.calculationDetails = result.details;
        recon.pointsDiff = recon.expectedPoints - recon.actualPoints;
      }
    }
    return { count: recons.length };
  }
}

module.exports = new PointsCalculator();
`;

const discrepancyDetectorContent = `const store = require("../store");
const RECON_STATUS = require("../models/Reconciliation").RECON_STATUS;
const DISCREPANCY_TYPES = require("../models/Reconciliation").DISCREPANCY_TYPES;

class DiscrepancyDetector {
  detectDiscrepancies(recon, receipt, member) {
    if (!recon || !receipt) return;
    
    if (recon.status === RECON_STATUS.APPROVED || recon.status === RECON_STATUS.REJECTED) {
      return recon;
    }
    
    recon.discrepancyTypes = [];
    recon.discrepancyReasons = [];
    
    if (recon.expectedPoints !== recon.actualPoints) {
      const diff = recon.expectedPoints - recon.actualPoints;
      recon.addDiscrepancy(
        DISCREPANCY_TYPES.POINTS_MISMATCH, 
        "Expected " + recon.expectedPoints + " points, but got " + recon.actualPoints + ". Difference: " + diff
      );
    }
    
    if (receipt.isReturn()) {
      const original = store.getReceipt(receipt.parentReceiptNo);
      if (!original) {
        recon.addDiscrepancy(
          DISCREPANCY_TYPES.RETURN_WITHOUT_ORIGINAL,
          "Return without corresponding original receipt: " + receipt.parentReceiptNo
        );
      }
    }
    
    if (receipt.isManual()) {
      recon.addDiscrepancy(
        DISCREPANCY_TYPES.MANUAL_RECORD,
        "Manual points adjustment requires manual review"
      );
    }
    
    const duplicates = this.findDuplicates(receipt);
    if (duplicates.length > 0) {
      recon.addDiscrepancy(
        DISCREPANCY_TYPES.DUPLICATE_RECEIPT,
        "Found " + duplicates.length + " duplicate record(s)"
      );
    }
  
    if (recon.discrepancyTypes.length === 0) {
      recon.status = RECON_STATUS.MATCHED;
    }
    
    return recon;
  }

  findDuplicates(receipt) {
    const allReceipts = store.getAllReceipts();
    return allReceipts.filter(r => r.id !== receipt.id && r.receiptNo === receipt.receiptNo);
  }

  checkAllReconciliations() {
    const recons = store.getAllReconciliations();
    for (const recon of recons) {
      if (recon.status === RECON_STATUS.APPROVED || recon.status === RECON_STATUS.REJECTED) continue;
      const receipt = store.getReceipt(recon.receiptId);
      const member = store.getMember(recon.memberNo);
      this.detectDiscrepancies(recon, receipt, member);
    }
    return { count: recons.length };
  }
}

module.exports = new DiscrepancyDetector();
`;

fs.writeFileSync(pointsCalculatorPath, pointsCalculatorContent);
console.log('Fixed pointsCalculator.js');

fs.writeFileSync(discrepancyDetectorPath, discrepancyDetectorContent);
console.log('Fixed discrepancyDetector.js');

console.log('All fixes applied successfully!');
