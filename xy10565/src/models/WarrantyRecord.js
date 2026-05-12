const BaseModel = require('./BaseModel');

class WarrantyRecord extends BaseModel {
  constructor() {
    super('warranty_records');
  }

  findByApplicationId(applicationId) {
    return this.findOne('application_id = ?', [applicationId]);
  }

  findByDeviceId(deviceId) {
    return this.findAll('device_id = ?', [deviceId]);
  }
}

module.exports = new WarrantyRecord();
