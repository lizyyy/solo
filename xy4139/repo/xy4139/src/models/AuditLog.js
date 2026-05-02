const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class AuditLog {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.action = data.action;
    this.entity_type = data.entity_type;
    this.entity_id = data.entity_id;
    this.entity_name = data.entity_name;
    this.description = data.description;
    this.old_value = data.old_value ? JSON.stringify(data.old_value) : null;
    this.new_value = data.new_value ? JSON.stringify(data.new_value) : null;
    this.user_id = data.user_id;
    this.user_name = data.user_name;
    this.user_role = data.user_role;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
    this.created_at = data.created_at || moment().toISOString();
  }

  static actions = {
    CHEMICAL_CREATE: 'chemical.create',
    CHEMICAL_UPDATE: 'chemical.update',
    CHEMICAL_DELETE: 'chemical.delete',
    
    BATCH_CREATE: 'batch.create',
    BATCH_UPDATE: 'batch.update',
    BATCH_IMPORT: 'batch.import',
    
    REQUEST_CREATE: 'request.create',
    REQUEST_SUBMIT: 'request.submit',
    REQUEST_APPROVE: 'request.approve',
    REQUEST_REJECT: 'request.reject',
    REQUEST_EXECUTE: 'request.execute',
    REQUEST_RETURN: 'request.return',
    REQUEST_DISPOSE: 'request.dispose',
    
    STOCK_ALERT: 'stock.alert',
    EXPIRY_ALERT: 'expiry.alert',
    
    REPORT_EXPORT: 'report.export'
  };

  static entityTypes = {
    CHEMICAL: 'chemical',
    BATCH: 'batch',
    REQUEST: 'request',
    AUDIT_LOG: 'audit_log',
    SYSTEM: 'system'
  };

  static validate(data) {
    const errors = [];
    
    if (!data.action) {
      errors.push('操作类型不能为空');
    }
    
    if (!data.entity_type) {
      errors.push('实体类型不能为空');
    }
    
    if (!data.user_id) {
      errors.push('用户ID不能为空');
    }
    
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      action: this.action,
      entity_type: this.entity_type,
      entity_id: this.entity_id,
      entity_name: this.entity_name,
      description: this.description,
      old_value: this.old_value ? JSON.parse(this.old_value) : null,
      new_value: this.new_value ? JSON.parse(this.new_value) : null,
      user_id: this.user_id,
      user_name: this.user_name,
      user_role: this.user_role,
      ip_address: this.ip_address,
      user_agent: this.user_agent,
      created_at: this.created_at
    };
  }

  static fromJSON(json) {
    return new AuditLog({
      ...json,
      old_value: json.old_value ? JSON.stringify(json.old_value) : null,
      new_value: json.new_value ? JSON.stringify(json.new_value) : null
    });
  }
}

module.exports = AuditLog;
