const { formatDate, now } = require('../utils/date');

class MemoryStore {
  constructor() {
    this.waybills = new Map();
    this.shipments = new Map();
    this.evidences = new Map();
    this.liabilityJudgments = new Map();
    this.compensations = new Map();
    this.reviews = new Map();
    this.appeals = new Map();
    this.histories = new Map();
    this.idempotencyKeys = new Map();
    
    this.shipmentIdCounter = 1;
    this.evidenceIdCounter = 1;
    this.liabilityIdCounter = 1;
    this.compensationIdCounter = 1;
    this.reviewIdCounter = 1;
    this.appealIdCounter = 1;
    this.historyIdCounter = 1;
  }

  checkIdempotency(key, operation) {
    if (this.idempotencyKeys.has(key)) {
      return this.idempotencyKeys.get(key);
    }
    return null;
  }

  saveIdempotency(key, operation, result) {
    this.idempotencyKeys.set(key, {
      operation,
      result,
      timestamp: formatDate(now())
    });
  }

  addWaybill(waybill) {
    this.waybills.set(waybill.waybillId, waybill);
    return waybill;
  }

  getWaybill(waybillId) {
    return this.waybills.get(waybillId) || null;
  }

  getAllWaybills() {
    return Array.from(this.waybills.values());
  }

  addShipment(shipment) {
    const id = `SH${String(this.shipmentIdCounter).padStart(6, '0')}`;
    this.shipmentIdCounter++;
    shipment.shipmentId = id;
    this.shipments.set(id, shipment);
    return shipment;
  }

  getShipment(shipmentId) {
    return this.shipments.get(shipmentId) || null;
  }

  updateShipment(shipmentId, updates) {
    const shipment = this.shipments.get(shipmentId);
    if (!shipment) return null;
    
    const updated = { ...shipment, ...updates, updatedAt: formatDate(now()) };
    this.shipments.set(shipmentId, updated);
    return updated;
  }

  getAllShipments(filters = {}) {
    let result = Array.from(this.shipments.values());
    
    if (filters.status) {
      result = result.filter(s => s.status === filters.status);
    }
    if (filters.waybillId) {
      result = result.filter(s => s.waybillId === filters.waybillId);
    }
    if (filters.type) {
      result = result.filter(s => s.type === filters.type);
    }
    if (filters.customerLevel) {
      result = result.filter(s => s.customerLevel === filters.customerLevel);
    }
    
    return result;
  }

  addEvidence(evidence) {
    const id = `EV${String(this.evidenceIdCounter).padStart(6, '0')}`;
    this.evidenceIdCounter++;
    evidence.evidenceId = id;
    this.evidences.set(id, evidence);
    return evidence;
  }

  getEvidencesByShipment(shipmentId) {
    return Array.from(this.evidences.values()).filter(e => e.shipmentId === shipmentId);
  }

  addLiabilityJudgment(judgment) {
    const id = `LJ${String(this.liabilityIdCounter).padStart(6, '0')}`;
    this.liabilityIdCounter++;
    judgment.liabilityId = id;
    this.liabilityJudgments.set(id, judgment);
    return judgment;
  }

  getLiabilityByShipment(shipmentId) {
    return Array.from(this.liabilityJudgments.values()).filter(j => j.shipmentId === shipmentId);
  }

  addCompensation(compensation) {
    const id = `CP${String(this.compensationIdCounter).padStart(6, '0')}`;
    this.compensationIdCounter++;
    compensation.compensationId = id;
    this.compensations.set(id, compensation);
    return compensation;
  }

  getCompensationByShipment(shipmentId) {
    return Array.from(this.compensations.values()).filter(c => c.shipmentId === shipmentId);
  }

  addReview(review) {
    const id = `RV${String(this.reviewIdCounter).padStart(6, '0')}`;
    this.reviewIdCounter++;
    review.reviewId = id;
    this.reviews.set(id, review);
    return review;
  }

  getReviewByShipment(shipmentId) {
    return Array.from(this.reviews.values()).filter(r => r.shipmentId === shipmentId);
  }

  addAppeal(appeal) {
    const id = `AP${String(this.appealIdCounter).padStart(6, '0')}`;
    this.appealIdCounter++;
    appeal.appealId = id;
    this.appeals.set(id, appeal);
    return appeal;
  }

  getAppealsByShipment(shipmentId) {
    return Array.from(this.appeals.values()).filter(a => a.shipmentId === shipmentId);
  }

  addHistory(history) {
    const id = `HT${String(this.historyIdCounter).padStart(6, '0')}`;
    this.historyIdCounter++;
    history.historyId = id;
    this.histories.set(id, history);
    return history;
  }

  getHistoryByShipment(shipmentId) {
    return Array.from(this.histories.values())
      .filter(h => h.shipmentId === shipmentId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getStatistics() {
    const shipments = this.getAllShipments();
    const statusCounts = {};
    const typeCounts = {};
    const totalCompensation = {
      approved: 0,
      pending: 0,
      rejected: 0,
      total: 0
    };

    shipments.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    });

    Array.from(this.compensations.values()).forEach(c => {
      totalCompensation.total += c.calculatedAmount;
      if (c.status === 'approved') {
        totalCompensation.approved += c.calculatedAmount;
      } else if (c.status === 'pending') {
        totalCompensation.pending += c.calculatedAmount;
      } else if (c.status === 'rejected') {
        totalCompensation.rejected += c.calculatedAmount;
      }
    });

    return {
      totalShipments: shipments.length,
      statusCounts,
      typeCounts,
      compensationAmounts: totalCompensation
    };
  }
}

const store = new MemoryStore();

module.exports = store;
