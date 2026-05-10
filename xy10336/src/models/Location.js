class Location {
  static generateId(locationCode) {
    return `LOC_${locationCode.toUpperCase()}`;
  }

  static parseLocation(locationCode) {
    const match = locationCode.match(/^([A-Z]+)-(\d+)-(\d+)$/i);
    if (match) {
      return {
        zone: match[1].toUpperCase(),
        aisle: parseInt(match[2], 10),
        bin: parseInt(match[3], 10)
      };
    }
    return { zone: null, aisle: null, bin: null };
  }

  constructor(data) {
    this.locationId = Location.generateId(data.locationCode);
    this.locationCode = data.locationCode.toUpperCase();
    this.productId = Product.generateId(data.sku);
    this.sku = data.sku.toUpperCase();
    this.zone = data.zone || Location.parseLocation(data.locationCode).zone;
    this.aisle = data.aisle || Location.parseLocation(data.locationCode).aisle;
    this.bin = data.bin || Location.parseLocation(data.locationCode).bin;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      locationId: this.locationId,
      locationCode: this.locationCode,
      productId: this.productId,
      sku: this.sku,
      zone: this.zone,
      aisle: this.aisle,
      bin: this.bin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const Product = require('./Product');
module.exports = Location;
