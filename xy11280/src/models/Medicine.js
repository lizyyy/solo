class Medicine {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.name = data.name || '';
    this.genericName = data.genericName || '';
    this.category = data.category || '';
    this.unit = data.unit || 'mg';
    this.specification = data.specification || '';
    this.manufacturer = data.manufacturer || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name) errors.push('药品名称不能为空');
    if (!this.unit) errors.push('药品单位不能为空');
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      genericName: this.genericName,
      category: this.category,
      unit: this.unit,
      specification: this.specification,
      manufacturer: this.manufacturer,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Medicine(json);
  }
}

export default Medicine;
