const Member = require('./models/Member');
const Receipt = require('./models/Receipt');
const Promotion = require('./models/Promotion');
const Reconciliation = require('./models/Reconciliation');

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
      { memberNo: 'M001', name: 'John Doe', phone: '13800000001', level: 'GOLD', totalPoints: 6000, joinDate: '2024-01-01' },
      { memberNo: 'M002', name: 'Jane Smith', phone: '13800000002', level: 'SILVER', totalPoints: 1500, joinDate: '2024-02-01' },
      { memberNo: 'M003', name: 'Bob Wilson', phone: '13800000003', level: 'PLATINUM', totalPoints: 25000, joinDate: '2023-06-01' },
      { memberNo: 'M004', name: 'Alice Wanker', phone: '13800000004', level: 'NORMAL', totalPoints: 500, joinDate: '2024-03-01' }
    ];
    sampleMembers.forEach(m => {
      the member = new Member(m);
      this.members.set(member.memberNo, member);
    });

    const samplePromotions = [
      { name: 'New Year Promotion', description: '20x points for New Year', pointsMultiplier: 2, startDate: '2024-12-25', endDate: '2025-01-05', storeIds: [], minAmount: 0, maxPoints: 2000 },
      { name: 'Gold Member Bonus', description: 'Extra bonus for gold members', pointsMultiplier: 1.5, startDate: '2024-01-01', endDate: '2025-12-31', storeIds: [], minAmount: 100, maxPoints: null }
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

  addReceipt(receiptData) {
    const receipt = new Receipt(receiptData);
    this.receipts.set(receipt.receiptNo, receipt);
    return receipt;
  }

  getReceipt(receiptNo) {
    return this.receipts.get(receiptNo);
  }

  getAllReceipts() {
    return Array.from(this.receipts.values());
  }

  addPromotion(promotionData) {
    const promotion = new Promotion(promotionData);
    this.promotions.set(promotion.id, promotion);
    return promotion;
  }

  getPromotion(id) {
    return this.promotions.get(id);
  }

  getAllPromotions() {
    return Array.from(this.promotions.values());
  }

  addReconciliation(reconData) {
    const recon = new Reconciliation(reconData);
    this.reconciliations.set(recon.id, recon);
    return recon;
  }

  getReconciliation(id) {
    return this.reconciliations.get(id);
  }

  getReconciliationByReceipt(receiptNo) {
    for (const recon of this.reconciliations.values()) {
      if (recon.receiptNo === receiptNo) {
        return recon;
