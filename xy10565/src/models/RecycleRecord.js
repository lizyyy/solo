const BaseModel = require('./BaseModel');

class RecycleRecord extends BaseModel {
  constructor() {
    super('recycle_records');
  }

  findByApplicationId(applicationId) {
    return this.findOne('application_id = ?', [applicationId]);
  }

  findOverdueRecords() {
    return this.findAll(
      `status NOT IN (?, ?) AND expected_receive_date IS NOT NULL AND date(expected_receive_date) < date('now')`,
      ['COMPLETED', 'CANCELLED']
    );
  }
}

module.exports = new RecycleRecord();
