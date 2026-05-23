const store = require("../store");
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
      const original = store.getReceiptByReceiptNo(receipt.parentReceiptNo);
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
