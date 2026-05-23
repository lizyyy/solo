const { v4: uuidv4 } = require('uuid');

const RECEIPT_TYPES = {
  PURCHASE: "purchase",
  RETURN: "return",
  MANUAL_ADD: "manual_add",
  MANUAL_DEDUCT: "manual_deduct"
};

class Receipt {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.receiptNo = data.receiptNo;
    this.storeId = data.storeId;
    this.storeName = data.storeName;
    this.memberNo = data.memberNo;
    this.type = data.type || RECEIPT_TYPES.PURCHASE;
    this.amount = parseFloat(data.amount) || 0;
    this.points = parseInt(data.points) || 0;
    this.transactionDate = data.transactionDate;
    this.cashier = data.cashier;
    this.remark = data.remark || "";
    this.parentReceiptNo = data.parentReceiptNo || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  isReturn() {
    return this.type === RECEIPT_TYPES.RETURN;
  }

  isManual() {
    return this.type === RECEIPT_TYPES.MANUAL_ADD || this.type === RECEIPT_TYPES.MANUAL_DEDUCT;
}

  toJSON() {
    return {
      id: this.id,
      receiptNo: this.receiptNo,
      storeId: this.storeId,
      storeName: this.storeName,
      memberNo: this.memberNo,
      type: this.type,
      amount: this.amount,
      points: this.points,
      transactionDate: this.transactionDate,
      cashier: this.cashier,
      remark: this.remark,
      parentReceiptNo: this.parentReceiptNo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

Receipt.RECEIPT_TYPES = RECEIPT_TYPES;

module.exports = Receipt;
