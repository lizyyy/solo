const BaseModel = require('./BaseModel');

class OperationLog extends BaseModel {
  constructor() {
    super('operation_logs');
  }

  findByApplicationId(applicationId) {
    return this.findAll('application_id = ?', [applicationId], 'created_at DESC');
  }

  findByModule(module) {
    return this.findAll('module = ?', [module], 'created_at DESC');
  }
}

module.exports = new OperationLog();
