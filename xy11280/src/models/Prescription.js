class Prescription {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.prescriptionNo = data.prescriptionNo || '';
    this.petId = data.petId || '';
    this.petName = data.petName || '';
    this.species = data.species || '';
    this.breed = data.breed || '';
    this.weight = data.weight || 0;
    this.weightUnit = data.weightUnit || 'kg';
    this.age = data.age || '';
    this.doctor = data.doctor || '';
    this.diagnosis = data.diagnosis || '';
    this.medicines = data.medicines || [];
    this.notes = data.notes || '';
    this.status = data.status || 'pending';
    this.reviewedBy = data.reviewedBy || '';
    this.reviewedAt = data.reviewedAt || '';
    this.reviewNotes = data.reviewNotes || '';
    this.anomalies = data.anomalies || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.petName) errors.push('宠物名称不能为空');
    if (!this.doctor) errors.push('医生不能为空');
    if (this.weight <= 0) errors.push('体重必须大于0');
    return errors;
  }

  addAnomaly(type, message, severity = 'warning') {
    this.anomalies.push({
      id: crypto.randomUUID(),
      type,
      message,
      severity,
      createdAt: new Date().toISOString()
    });
  }

  review(reviewer, notes = '') {
    this.status = 'reviewed';
    this.reviewedBy = reviewer;
    this.reviewedAt = new Date().toISOString();
    this.reviewNotes = notes;
    this.updatedAt = new Date().toISOString();
  }

  dispense() {
    this.status = 'dispensed';
    this.updatedAt = new Date().toISOString();
  }

  cancel(reason = '') {
    this.status = 'cancelled';
    this.updatedAt = new Date().toISOString();
    this.addAnomaly('cancelled', `处方已取消: ${reason}`, 'info');
  }

  toJSON() {
    return {
      id: this.id,
      prescriptionNo: this.prescriptionNo,
      petId: this.petId,
      petName: this.petName,
      species: this.species,
      breed: this.breed,
      weight: this.weight,
      weightUnit: this.weightUnit,
      age: this.age,
      doctor: this.doctor,
      diagnosis: this.diagnosis,
      medicines: this.medicines,
      notes: this.notes,
      status: this.status,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      reviewNotes: this.reviewNotes,
      anomalies: this.anomalies,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Prescription(json);
  }
}

export default Prescription;
