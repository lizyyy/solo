const store = require("../store");

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
        const promoPoints = promo.calculatePoints(basePoints);
        if (promoPoints > finalPoints) {
          finalPoints = promoPoints;
          appliedPromotions.push({
            id: promo.id,
            name: promo.name,
            multiplier: promo.pointsMultiplier,
            points: promoPoints
          });
        }
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
