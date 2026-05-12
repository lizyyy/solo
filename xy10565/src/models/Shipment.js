const BaseModel = require('./BaseModel');

class Shipment extends BaseModel {
  constructor() {
    super('shipments');
  }

  findByApplicationId(applicationId) {
    return this.findOne('application_id = ?', [applicationId]);
  }

  findByTrackingNo(trackingNo) {
    return this.findOne('tracking_no = ?', [trackingNo]);
  }
}

module.exports = new Shipment();
