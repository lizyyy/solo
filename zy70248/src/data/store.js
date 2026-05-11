const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    this.ships = new Map();
    this.berthings = new Map();
    this.contracts = new Map();
    this.meterReadings = new Map();
    this.interruptions = new Map();
    this.settlements = new Map();
    this.reconciliationReports = new Map();
  }

  generateId() {
    return uuidv4();
  }

  createShip(shipData) {
    const id = this.generateId();
    const ship = {
      id,
      ...shipData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.ships.set(id, ship);
    return ship;
  }

  getShip(id) {
    return this.ships.get(id);
  }

  getAllShips() {
    return Array.from(this.ships.values());
  }

  createBerthing(berthingData) {
    const id = this.generateId();
    const berthing = {
      id,
      status: 'ARRIVING',
      ...berthingData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.berthings.set(id, berthing);
    return berthing;
  }

  getBerthing(id) {
    return this.berthings.get(id);
  }

  updateBerthingStatus(id, status, additionalData = {}) {
    const berthing = this.berthings.get(id);
    if (!berthing) return null;
    
    const updated = {
      ...berthing,
      ...additionalData,
      status,
      updatedAt: new Date().toISOString()
    };
    this.berthings.set(id, updated);
    return updated;
  }

  getBerthingsByShip(shipId) {
    return Array.from(this.berthings.values()).filter(b => b.shipId === shipId);
  }

  getAllBerthings() {
    return Array.from(this.berthings.values());
  }

  createContract(contractData) {
    const id = this.generateId();
    const contract = {
      id,
      status: 'ACTIVE',
      ...contractData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.contracts.set(id, contract);
    return contract;
  }

  getContract(id) {
    return this.contracts.get(id);
  }

  getContractsByShip(shipId) {
    return Array.from(this.contracts.values()).filter(c => c.shipId === shipId);
  }

  getActiveContract(shipId, date) {
    const targetDate = date ? new Date(date) : new Date();
    return Array.from(this.contracts.values()).find(c => 
      c.shipId === shipId &&
      c.status === 'ACTIVE' &&
      new Date(c.startDate) <= targetDate &&
      (!c.endDate || new Date(c.endDate) >= targetDate)
    );
  }

  getAllContracts() {
    return Array.from(this.contracts.values());
  }

  createMeterReading(readingData) {
    const id = this.generateId();
    const reading = {
      id,
      ...readingData,
      createdAt: new Date().toISOString()
    };
    this.meterReadings.set(id, reading);
    return reading;
  }

  getMeterReadingsByBerthing(berthingId) {
    return Array.from(this.meterReadings.values())
      .filter(r => r.berthingId === berthingId)
      .sort((a, b) => new Date(a.readingTime) - new Date(b.readingTime));
  }

  getLatestMeterReading(berthingId) {
    const readings = this.getMeterReadingsByBerthing(berthingId);
    return readings.length > 0 ? readings[readings.length - 1] : null;
  }

  createInterruption(interruptionData) {
    const id = this.generateId();
    const interruption = {
      id,
      status: 'ACTIVE',
      ...interruptionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.interruptions.set(id, interruption);
    return interruption;
  }

  getInterruption(id) {
    return this.interruptions.get(id);
  }

  updateInterruption(id, data) {
    const interruption = this.interruptions.get(id);
    if (!interruption) return null;
    
    const updated = {
      ...interruption,
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.interruptions.set(id, updated);
    return updated;
  }

  getInterruptionsByBerthing(berthingId) {
    return Array.from(this.interruptions.values())
      .filter(i => i.berthingId === berthingId)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  createSettlement(settlementData) {
    const id = this.generateId();
    const settlement = {
      id,
      status: 'PENDING_REVIEW',
      ...settlementData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.settlements.set(id, settlement);
    return settlement;
  }

  getSettlement(id) {
    return this.settlements.get(id);
  }

  getSettlementsByBerthing(berthingId) {
    return Array.from(this.settlements.values()).filter(s => s.berthingId === berthingId);
  }

  updateSettlementStatus(id, status, additionalData = {}) {
    const settlement = this.settlements.get(id);
    if (!settlement) return null;
    
    const updated = {
      ...settlement,
      ...additionalData,
      status,
      updatedAt: new Date().toISOString()
    };
    this.settlements.set(id, updated);
    return updated;
  }

  getAllSettlements() {
    return Array.from(this.settlements.values());
  }

  createReconciliationReport(reportData) {
    const id = this.generateId();
    const report = {
      id,
      status: 'GENERATED',
      ...reportData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.reconciliationReports.set(id, report);
    return report;
  }

  getReconciliationReport(id) {
    return this.reconciliationReports.get(id);
  }

  getAllReconciliationReports() {
    return Array.from(this.reconciliationReports.values());
  }
}

module.exports = new DataStore();
