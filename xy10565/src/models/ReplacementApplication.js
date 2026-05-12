const BaseModel = require('./BaseModel');
const { v4: uuidv4 } = require('uuid');

class ReplacementApplication extends BaseModel {
  constructor() {
    super('replacement_applications');
  }

  findByApplicationNo(applicationNo) {
    return this.findOne('application_no = ?', [applicationNo]);
  }

  findByOriginalDeviceId(deviceId) {
    return this.findOne('original_device_id = ? AND status NOT IN (?, ?)', [deviceId, 'COMPLETED', 'CANCELLED']);
  }

  findByCustomerId(customerId) {
    return this.findAll('customer_id = ?', [customerId]);
  }

  findByStatus(status) {
    return this.findAll('status = ?', [status]);
  }

  generateApplicationNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `RH${dateStr}${random}`;
  }

  createApplication(data) {
    const applicationNo = this.generateApplicationNo();
    return this.create({
      ...data,
      application_no: applicationNo
    });
  }
}

module.exports = new ReplacementApplication();
