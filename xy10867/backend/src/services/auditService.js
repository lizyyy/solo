const Database = require('../db');

class AuditService {
  static async log(data) {
    const { vulnerabilityId, action, previousStatus, newStatus, operator, requestData, responseData } = data;
    const id = Database.generateId();
    
    await Database.run(
      `INSERT INTO audit_logs (id, vulnerability_id, action, previous_status, new_status, operator, request_data, response_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, vulnerabilityId, action, previousStatus, newStatus, operator, JSON.stringify(requestData), JSON.stringify(responseData)]
    );
    
    return id;
  }

  static async getLogsByVulnerability(vulnerabilityId) {
    return await Database.all(
      `SELECT * FROM audit_logs WHERE vulnerability_id = ? ORDER BY created_at DESC`,
      [vulnerabilityId]
    );
  }

  static async getAllLogs() {
    return await Database.all(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
    );
  }
}

module.exports = AuditService;
