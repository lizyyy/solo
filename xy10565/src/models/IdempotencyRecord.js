const BaseModel = require('./BaseModel');

class IdempotencyRecord extends BaseModel {
  constructor() {
    super('idempotency_records');
  }

  findByRequestKey(requestKey) {
    return this.findOne('request_key = ?', [requestKey]);
  }
}

module.exports = new IdempotencyRecord();
