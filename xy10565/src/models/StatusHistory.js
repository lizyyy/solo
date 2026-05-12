const BaseModel = require('./BaseModel');

class StatusHistory extends BaseModel {
  constructor() {
    super('status_history');
  }

  findByApplicationId(applicationId) {
    return this.findAll('application_id = ?', [applicationId], 'created_at ASC');
  }

  getLastStatus(applicationId) {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE application_id = ? ORDER BY created_at DESC LIMIT 1`
    );
    return stmt.get(applicationId);
  }
}

module.exports = new StatusHistory();
