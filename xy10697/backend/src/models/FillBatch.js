const { v4: uuidv4 } = require('uuid');

class FillBatch {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.batchNo = data.batchNo;
    this.fillDate = data.fillDate || new Date().toISOString();
    this.gasType = data.gasType || '';
    this.pressure = data.pressure || null;
    this.operator = data.operator || '';
    this.remark = data.remark || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

module.exports = FillBatch;
