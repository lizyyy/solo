class Garment {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.styleNo = data.styleNo || '';
    this.size = data.size || '';
    this.color = data.color || '';
    this.status = data.status || 'available';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  generateId() {
    return `GAR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getUniqueKey() {
    return `${this.styleNo}-${this.size}-${this.color}`;
  }

  toJSON() {
    return {
      id: this.id,
      styleNo: this.styleNo,
      size: this.size,
      color: this.color,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Garment;
