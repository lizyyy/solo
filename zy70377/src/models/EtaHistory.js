const { generateId, getCurrentTime } = require('../utils/idGenerator');

const etaHistory = new Map();
const orderEtaHistory = new Map();

class EtaHistory {
  constructor(data) {
    this.id = data.id || generateId('eta_hist');
    this.orderId = data.orderId;
    this.previousEta = data.previousEta;
    this.newEta = data.newEta;
    this.deltaMinutes = data.deltaMinutes;
    this.reason = data.reason;
    this.reasonCategory = data.reasonCategory;
    this.responsibleParty = data.responsibleParty;
    this.timestamp = data.timestamp || getCurrentTime();
    this.details = data.details || {};
  }

  static create(data) {
    const record = new EtaHistory(data);
    etaHistory.set(record.id, record);
    
    if (!orderEtaHistory.has(data.orderId)) {
      orderEtaHistory.set(data.orderId, []);
    }
    orderEtaHistory.get(data.orderId).push(record);
    
    return record;
  }

  static findByOrderId(orderId) {
    return orderEtaHistory.get(orderId) || [];
  }
}

module.exports = EtaHistory;
