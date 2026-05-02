const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config');

class Request {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.request_number = data.request_number || this.generateRequestNumber();
    this.requester_id = data.requester_id;
    this.requester_name = data.requester_name;
    this.chemical_id = data.chemical_id;
    this.batch_id = data.batch_id;
    this.quantity = data.quantity;
    this.unit = data.unit;
    this.purpose = data.purpose;
    this.status = data.status || config.request_status.draft;
    this.requested_at = data.requested_at || moment().toISOString();
    this.approver_id = data.approver_id;
    this.approver_name = data.approver_name;
    this.approved_at = data.approved_at;
    this.rejection_reason = data.rejection_reason;
    this.executor_id = data.executor_id;
    this.executor_name = data.executor_name;
    this.executed_at = data.executed_at;
    this.returned_at = data.returned_at;
    this.return_quantity = data.return_quantity;
    this.disposed_at = data.disposed_at;
    this.disposal_reason = data.disposal_reason;
    this.created_at = data.created_at || moment().toISOString();
    this.updated_at = data.updated_at || moment().toISOString();
    this.created_by = data.created_by;
    this.updated_by = data.updated_by;
  }

  generateRequestNumber() {
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REQ-${timestamp}-${random}`;
  }

  static validate(data) {
    const errors = [];
    
    if (!data.requester_id) {
      errors.push('申请人ID不能为空');
    }
    
    if (!data.chemical_id) {
      errors.push('试剂ID不能为空');
    }
    
    if (!data.batch_id) {
      errors.push('批次ID不能为空');
    }
    
    if (!data.quantity) {
      errors.push('领用数量不能为空');
    }
    
    if (data.quantity && data.quantity <= 0) {
      errors.push('领用数量必须大于0');
    }
    
    if (!data.purpose) {
      errors.push('领用用途不能为空');
    }
    
    return errors;
  }

  canTransitionTo(newStatus) {
    const transitions = {
      [config.request_status.draft]: [config.request_status.pending],
      [config.request_status.pending]: [config.request_status.approved, config.request_status.rejected],
      [config.request_status.approved]: [config.request_status.executed],
      [config.request_status.rejected]: [],
      [config.request_status.executed]: [config.request_status.returned, config.request_status.disposed],
      [config.request_status.returned]: [],
      [config.request_status.disposed]: []
    };
    
    return transitions[this.status]?.includes(newStatus) || false;
  }

  getStatusText() {
    const statusTexts = {
      [config.request_status.draft]: '草稿',
      [config.request_status.pending]: '待审批',
      [config.request_status.approved]: '已批准',
      [config.request_status.rejected]: '已驳回',
      [config.request_status.executed]: '已领出',
      [config.request_status.returned]: '已归还',
      [config.request_status.disposed]: '已报废'
    };
    return statusTexts[this.status] || this.status;
  }

  toJSON() {
    return {
      id: this.id,
      request_number: this.request_number,
      requester_id: this.requester_id,
      requester_name: this.requester_name,
      chemical_id: this.chemical_id,
      batch_id: this.batch_id,
      quantity: this.quantity,
      unit: this.unit,
      purpose: this.purpose,
      status: this.status,
      status_text: this.getStatusText(),
      requested_at: this.requested_at,
      approver_id: this.approver_id,
      approver_name: this.approver_name,
      approved_at: this.approved_at,
      rejection_reason: this.rejection_reason,
      executor_id: this.executor_id,
      executor_name: this.executor_name,
      executed_at: this.executed_at,
      returned_at: this.returned_at,
      return_quantity: this.return_quantity,
      disposed_at: this.disposed_at,
      disposal_reason: this.disposal_reason,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      updated_by: this.updated_by
    };
  }
}

module.exports = Request;
