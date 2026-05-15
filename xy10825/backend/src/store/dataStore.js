const { Invoice } = require('../models/Invoice');
const { RedFlushRecord } = require('../models/RedFlushRecord');

class DataStore {
  constructor() {
    this.invoices = new Map();
    this.redFlushRecords = new Map();
  }

  addInvoice(invoiceData) {
    const invoice = new Invoice(invoiceData);
    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  getInvoice(id) {
    return this.invoices.get(id);
  }

  getInvoiceByRequestId(requestId) {
    for (const invoice of this.invoices.values()) {
      if (invoice.requestId === requestId) {
        return invoice;
      }
    }
    return null;
  }

  queryInvoices(filters = {}) {
    let results = Array.from(this.invoices.values());
    
    if (filters.platform) {
      results = results.filter(i => i.platform === filters.platform);
    }
    if (filters.callbackStatus) {
      results = results.filter(i => i.callbackStatus === filters.callbackStatus);
    }
    if (filters.businessNo) {
      results = results.filter(i => i.businessNo.includes(filters.businessNo));
    }
    if (filters.buyerName) {
      results = results.filter(i => i.buyerName.includes(filters.buyerName));
    }
    if (filters.startDate) {
      results = results.filter(i => i.createdAt >= filters.startDate);
    }
    if (filters.endDate) {
      results = results.filter(i => i.createdAt <= filters.endDate);
    }

    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getAllInvoices() {
    return Array.from(this.invoices.values());
  }

  addRedFlushRecord(recordData) {
    const record = new RedFlushRecord(recordData);
    this.redFlushRecords.set(record.id, record);
    return record;
  }

  getRedFlushRecord(id) {
    return this.redFlushRecords.get(id);
  }

  getRedFlushRecordsByInvoiceId(invoiceId) {
    return Array.from(this.redFlushRecords.values()).filter(
      r => r.originalInvoiceId === invoiceId
    );
  }
}

module.exports = new DataStore();
