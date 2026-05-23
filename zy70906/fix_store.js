const fs = require('fs');

const content = `const Member = require("./models/Member");
const Receipt = require("./models/Receipt");
const Promotion = require("./models/Promotion");
const Reconciliation = require("./models/Reconciliation");

class DataStore {
  constructor() {
    this.members = new Map();
    this.receipts = new Map();
    this.promotions = new Map();
    this.reconciliations = new Map();
    this.initSampleData();
  }

  initSampleData() {
    const sampleMembers = [
      { memberNo: "M001", name: "John Doe", phone: "13800000001", level: "GOLD", totalPoints: 6000, joinDate: "2024-01-01" },
      { memberNo: "M002", name: "Jane Smith", phone: "13800000002", level: "SILVER", totalPoints: 1500, joinDate: "2024-02-01" },
      { memberNo: "M003", name: "Bob Wilson", phone: "13800000003", level: "PLATINUM", totalPoints: 25000, joinDate: "2023-06-01" },
      { memberNo: "M004", name: "Alice Wang", phone: "13800000004", level: "NORMAL", totalPoints: 500, joinDate: "2024-03-01" }
    ];
    sampleMembers.forEach(m => {
      const member = new Member(m);
      this.members.set(member.memberNo, member);
    });

    const samplePromotions = [
      { name: "New Year Promotion", description: "2x points for New Year", pointsMultiplier: 2, startDate: "2024-12-25", endDate: "2025-01-05", storeIds: [], minAmount: 0, maxPoints: 2000 },
      { name: "Gold Member Bonus", description: "Extra bonus for gold members", pointsMultiplier: 1.5, startDate: "2024-01-01", endDate: "2025-12-31", storeIds: [], minAmount: 100, maxPoints: null }
    ];
    samplePromotions.forEach(p => {
      const promotion = new Promotion(p);
      this.promotions.set(promotion.id, promotion);
    });
  }

  addMember(memberData) {
    const member = new Member(memberData);
    this.members.set(member.memberNo, member);
    return member;
  }

  getMember(memberNo) {
    return this.members.get(memberNo);
  }

  getAllMembers() {
    return Array.from(this.members.values());
  }

  addReceipt(receipt) {
    this.receipts.set(receipt.id, receipt);
    const recon = new Reconciliation({
      receiptId: receipt.id,
      receiptNo: receipt.receiptNo,
      memberNo: receipt.memberNo,
      actualPoints: receipt.points
    });
    this.reconciliations.set(recon.id, recon);
    return receipt;
  }

  getReceipt(id) {
    return this.receipts.get(id);
  }

  getAllReceipts() {
    return Array.from(this.receipts.values());
  }

  getReceiptsByMember(memberNo) {
    return Array.from(this.receipts.values()).filter(r => r.memberNo === memberNo);
  }

  getPromotion(id) {
    return this.promotions.get(id);
  }

  getAllPromotions() {
    return Array.from(this.promotions.values());
  }

  getReconciliation(id) {
    return this.reconciliations.get(id);
  }

  getAllReconciliations() {
    return Array.from(this.reconciliations.values());
  }

  clearReconciliations() {
    this.reconciliations.clear();
  }
}

module.exports = new DataStore();
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70906/src/store.js', content);
console.log('store.js created successfully');
