class DosageRule {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.medicineId = data.medicineId || '';
    this.medicineName = data.medicineName || '';
    this.species = data.species || '通用';
    this.breed = data.breed || '';
    this.minWeight = data.minWeight || 0;
    this.maxWeight = data.maxWeight || Infinity;
    this.weightUnit = data.weightUnit || 'kg';
    this.dosagePerKg = data.dosagePerKg || 0;
    this.dosageUnit = data.dosageUnit || 'mg';
    this.minDosage = data.minDosage || 0;
    this.maxDosage = data.maxDosage || Infinity;
    this.frequency = data.frequency || '';
    this.route = data.route || '';
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.medicineId) errors.push('药品ID不能为空');
    if (this.dosagePerKg <= 0) errors.push('每公斤剂量必须大于0');
    if (this.minWeight < 0) errors.push('最小体重不能为负数');
    if (this.maxWeight <= this.minWeight) errors.push('最大体重必须大于最小体重');
    return errors;
  }

  matches(species, weight, weightUnit = 'kg') {
    if (this.species !== '通用' && this.species !== species) {
      return false;
    }
    const normalizedWeight = this.normalizeWeight(weight, weightUnit);
    return normalizedWeight >= this.minWeight && normalizedWeight <= this.maxWeight;
  }

  normalizeWeight(weight, weightUnit) {
    if (weightUnit === 'g' && this.weightUnit === 'kg') {
      return weight / 1000;
    }
    if (weightUnit === 'kg' && this.weightUnit === 'g') {
      return weight * 1000;
    }
    return weight;
  }

  calculateDosage(weight, weightUnit = 'kg') {
    const normalizedWeight = this.normalizeWeight(weight, weightUnit);
    let dosage = normalizedWeight * this.dosagePerKg;
    
    if (dosage < this.minDosage) {
      dosage = this.minDosage;
    }
    if (dosage > this.maxDosage) {
      dosage = this.maxDosage;
    }
    
    return {
      dosage: Math.round(dosage * 1000) / 1000,
      unit: this.dosageUnit,
      frequency: this.frequency,
      route: this.route,
      notes: this.notes,
      isMinDosage: dosage === this.minDosage,
      isMaxDosage: dosage === this.maxDosage
    };
  }

  toJSON() {
    return {
      id: this.id,
      medicineId: this.medicineId,
      medicineName: this.medicineName,
      species: this.species,
      breed: this.breed,
      minWeight: this.minWeight,
      maxWeight: this.maxWeight,
      weightUnit: this.weightUnit,
      dosagePerKg: this.dosagePerKg,
      dosageUnit: this.dosageUnit,
      minDosage: this.minDosage,
      maxDosage: this.maxDosage,
      frequency: this.frequency,
      route: this.route,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new DosageRule(json);
  }
}

export default DosageRule;
