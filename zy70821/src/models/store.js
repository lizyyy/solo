const crypto = require('crypto');

class DataStore {
  constructor() {
    this.appointments = new Map();
    this.vaccineInventory = new Map();
    this.contraindicationRules = [];
    this.processedBatches = new Map();
    this.processResults = new Map();
  }

  generateBatchId(files) {
    const hash = crypto.createHash('md5');
    files.forEach(file => {
      hash.update(file.originalname + file.size);
    });
    return hash.digest('hex');
  }

  isBatchProcessed(batchId) {
    return this.processedBatches.has(batchId);
  }

  markBatchProcessed(batchId, metadata = {}) {
    this.processedBatches.set(batchId, {
      processedAt: new Date(),
      metadata
    });
  }

  saveProcessResult(batchId, result) {
    this.processResults.set(batchId, result);
  }

  getProcessResult(batchId) {
    return this.processResults.get(batchId);
  }

  addAppointment(appointment) {
    const id = appointment.id || `${appointment.childId}_${appointment.vaccineCode}_${appointment.appointmentDate}`;
    this.appointments.set(id, { ...appointment, id, createdAt: new Date() });
    return id;
  }

  getAppointment(id) {
    return this.appointments.get(id);
  }

  updateVaccineInventory(vaccines) {
    vaccines.forEach(vaccine => {
      this.vaccineInventory.set(vaccine.code, {
        ...vaccine,
        updatedAt: new Date()
      });
    });
  }

  getVaccineInventory(code) {
    return this.vaccineInventory.get(code);
  }

  getAllVaccines() {
    return Array.from(this.vaccineInventory.values());
  }

  updateContraindicationRules(rules) {
    this.contraindicationRules = rules;
  }

  getContraindicationRules() {
    return this.contraindicationRules;
  }

  checkDuplicateReschedule(childId, vaccineCode, originalDate) {
    return Array.from(this.appointments.values()).some(apt => 
      apt.childId === childId && 
      apt.vaccineCode === vaccineCode && 
      apt.originalAppointmentDate === originalDate &&
      apt.status === 'rescheduled'
    );
  }
}

module.exports = new DataStore();
