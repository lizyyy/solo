class Asset {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.category = data.category;
    this.sn = data.sn;
    this.status = data.status || 'available';
    this.location = data.location;
    this.purchaseDate = data.purchaseDate;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      sn: this.sn,
      status: this.status,
      location: this.location,
      purchaseDate: this.purchaseDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Asset;
