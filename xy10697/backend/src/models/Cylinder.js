const { v4: uuidv4 } = require('uuid');
const { CylinderStatus } = require('./CylinderStatus');

class Cylinder {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.cylinderNo = data.cylinderNo;
    this.specification = data.specification || '';
    this.material = data.material || '';
    this.manufactureDate = data.manufactureDate || null;
    this.lastInspectionDate = data.lastInspectionDate || null;
    this.nextInspectionDate = data.nextInspectionDate || null;
    this.currentStatus = data.currentStatus || CylinderStatus.EMPTY;
    this.currentBatchNo = data.currentBatchNo || null;
    this.currentCustomer = data.currentCustomer || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.isScrapped = data.isScrapped || false;
    this.scrapDate = data.scrapDate || null;
    this.scrapReason = data.scrapReason || '';
  }

  update(data) {
    Object.assign(this, data);
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = Cylinder;
