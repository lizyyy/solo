
const { v4: uuidv4 } = require('uuid');

class Vehicle {
  constructor(vin, plateNumber, ownerName, ownerPhone) {
    this.id = uuidv4();
    this.vin = vin;
    this.plateNumber = plateNumber;
    this.ownerName = ownerName;
    this.ownerPhone = ownerPhone;
    this.plateHistory = [plateNumber];
  }

  updatePlateNumber(newPlateNumber) {
    if (newPlateNumber !== this.plateNumber) {
      this.plateNumber = newPlateNumber;
      this.plateHistory.push(newPlateNumber);
    }
  }
}

class Package {
  constructor(id, name, packageType, totalServices, services = [], materials = []) {
    this.id = id;
    this.name = name;
    this.packageType = packageType;
    this.totalServices = totalServices;
    this.services = services;
    this.materials = materials;
  }
}

class PackageRight {
  constructor(id, vehicleId, packageId, purchaseDate, totalServices, remainingServices, materials = [], purchasePrice = 0) {
    this.id = id;
    this.vehicleId = vehicleId;
    this.packageId = packageId;
    this.purchaseDate = purchaseDate;
    this.totalServices = totalServices;
    this.remainingServices = remainingServices;
    this.materials = materials;
    this.purchasePrice = purchasePrice;
    this.isRefunded = false;
    this.refundDate = null;
  }

  useService() {
    if (this.remainingServices > 0) {
      this.remainingServices--;
      return true;
    }
    return false;
  }

  refundService() {
    if (this.remainingServices < this.totalServices) {
      this.remainingServices++;
      return true;
    }
    return false;
  }

  processRefund(date) {
    this.isRefunded = true;
    this.refundDate = date;
  }
}

class VerificationRecord {
  constructor(id, packageRightId, shopId, date, materials = [], status = 'pending') {
    this.id = id;
    this.packageRightId = packageRightId;
    this.shopId = shopId;
    this.date = date;
    this.materials = materials;
    this.status = status;
    this.sourceFile = null;
    this.action = null;
    this.finalResult = null;
  }

  verify() {
    this.status = 'verified';
  }

  cancel() {
    this.status = 'cancelled';
  }

  setTraceInfo(sourceFile, action, finalResult) {
    this.sourceFile = sourceFile;
    this.action = action;
    this.finalResult = finalResult;
  }
}

class Shop {
  constructor(id, name, address, phone) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.phone = phone;
  }
}

module.exports = {
  Vehicle,
  Package,
  PackageRight,
  VerificationRecord,
  Shop
};
