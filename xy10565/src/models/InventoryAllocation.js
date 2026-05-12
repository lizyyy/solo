const BaseModel = require('./BaseModel');

class InventoryAllocation extends BaseModel {
  constructor() {
    super('inventory_allocations');
  }

  findByApplicationId(applicationId) {
    return this.findOne('application_id = ?', [applicationId]);
  }

  findByDeviceId(deviceId) {
    return this.findAll('new_device_id = ?', [deviceId]);
  }
}

module.exports = new InventoryAllocation();
