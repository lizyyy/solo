const store = require("../store");

class PointsCalculator {
  calculateExpectedPoints(receipt, member) {
    if (!receipt || !member) {
      return { points: 0, details: {} };
    }

    const basePoints = Math.floor(receipt.amount);
    const memberMultiplier = member.getPointsMultiplier();
    const details = {
      baseAmount: receipt.amount,
      basePoints: basePoints,
      memberLevel: member.level,
      memberMultiplier: memberMultiplier
    };

    const promotions = store.getAllPromotions();
    let appliedPromotions = [];
    let maxPromoMultiplier = 1;
    
    for (const promo of promotions) {
      if (promo.isApplicable(receipt.transactionDate, receipt.storeId, receipt.amount, member.level)) {
        if (promo.pointsMultiplier > maxPromoMultiplier) {
          maxPromoMultiplier = promo.pointsMultiplier;
          appliedPromotions = [{
            id: promo.id,
            name: promo.name,
            multiplier: promo.pointsMultiplier
          }];
        }
      }
    }
    const finalPoints = Math.floor(basePoints * memberMultiplier * maxPromoMultiplier);

    details.appliedPromotions = appliedPromotions;
    details.finalPoints = finalPoints;

    return { points: finalPoints, details };
  }

  calculatePointsForReceipt(receipt) {
    const member = store.getMember(receipt.memberNo);
    return this.calculateExpectedPoints(receipt, member);
  }

  calculateAllReconciliations() {
    const receipts = store.getAllReceipts();
    const recons = store.getAllReconciliations();
    
    for (const recon of recons) {
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
