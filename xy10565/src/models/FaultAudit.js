const BaseModel = require('./BaseModel');

class FaultAudit extends BaseModel {
  constructor() {
    super('fault_audits');
  }

  findByApplicationId(applicationId) {
    return this.findOne('application_id = ?', [applicationId]);
  }
}

module.exports = new FaultAudit();
