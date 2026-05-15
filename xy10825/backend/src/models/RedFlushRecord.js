const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class RedFlushRecord {
  constructor(data) {
    this.id = uuidv4();
    this.originalInvoiceId = data.originalInvoiceId;
    this.originalRequestId = data.originalRequestId;
    this.reason = data.reason;
    this.operator = data.operator;
    this.status = 'pending';
    this.redInvoiceCode = null;
    this.redInvoiceNo = null;
    this.downloadUrl = null;
    this.createdAt = moment().toISOString();
    this.completedAt = null;
  }

  complete(redInvoiceCode, redInvoiceNo, downloadUrl) {
    this.status = 'completed';
    this.redInvoiceCode = redInvoiceCode;
    this.redInvoiceNo = redInvoiceNo;
    this.downloadUrl = downloadUrl;
    this.completedAt = moment().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      originalInvoiceId: this.originalInvoiceId,
      originalRequestId: this.originalRequestId,
      reason: this.reason,
      operator: this.operator,
      status: this.status,
      redInvoiceCode: this.redInvoiceCode,
      redInvoiceNo: this.redInvoiceNo,
      downloadUrl: this.downloadUrl,
      createdAt: this.createdAt,
      completedAt: this.completedAt
    };
  }
}

module.exports = { RedFlushRecord };
