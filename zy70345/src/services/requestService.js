const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { verifyCustomerIdentity, getCustomerProfile } = require('./identityService');

const createDeletionRequest = (customerId, requestData) => {
  const { request_type, data_scope, verification_info } = requestData;

  const existingRequest = db.prepare(`
    SELECT * FROM deletion_requests 
    WHERE customer_id = ? 
      AND data_scope = ? 
      AND status IN ('pending', 'scanning', 'analyzing', 'executing', 'failed')
  `).get(customerId, data_scope);

  if (existingRequest) {
    throw new Error(`该客户的${data_scope}范围删除请求已存在（ID: ${existingRequest.id}），状态: ${existingRequest.status}`);
  }

  const identityResult = verifyCustomerIdentity(customerId, verification_info);
  
  if (!identityResult.verified) {
    return {
      success: false,
      reason: identityResult.reason,
      request: null
    };
  }

  const profile = getCustomerProfile(customerId);
  const requestId = uuidv4();

  const insertRequest = db.prepare(`
    INSERT INTO deletion_requests (
      id, customer_id, customer_name, customer_email, 
      identity_verified, status, request_type, data_scope, 
      requested_at, retry_count, max_retries
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRequest.run(
    requestId,
    customerId,
    profile.name,
    profile.email,
    1,
    'pending',
    request_type || 'full_deletion',
    data_scope || 'all_data',
    moment().toISOString(),
    0,
    3
  );

  const request = db.prepare(`SELECT * FROM deletion_requests WHERE id = ?`).get(requestId);

  return {
    success: true,
    reason: '请求创建成功',
    request
  };
};

const getRequestById = (requestId) => {
  return db.prepare(`SELECT * FROM deletion_requests WHERE id = ?`).get(requestId);
};

const getRequestsByCustomer = (customerId) => {
  return db.prepare(`SELECT * FROM deletion_requests WHERE customer_id = ? ORDER BY created_at DESC`).all(customerId);
};

const getAllRequests = () => {
  return db.prepare(`SELECT * FROM deletion_requests ORDER BY created_at DESC`).all();
};

const updateRequestStatus = (requestId, status, errorMessage = null) => {
  const updateStmt = db.prepare(`
    UPDATE deletion_requests 
    SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  updateStmt.run(status, errorMessage, requestId);
  return getRequestById(requestId);
};

const incrementRetryCount = (requestId) => {
  const request = getRequestById(requestId);
  const newRetryCount = request.retry_count + 1;
  
  const updateStmt = db.prepare(`
    UPDATE deletion_requests 
    SET retry_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  updateStmt.run(newRetryCount, requestId);
  
  return getRequestById(requestId);
};

const canRetry = (requestId) => {
  const request = getRequestById(requestId);
  return request && request.retry_count < request.max_retries;
};

const checkDuplicateRequest = (customerId, dataScope) => {
  const existing = db.prepare(`
    SELECT * FROM deletion_requests 
    WHERE customer_id = ? 
      AND data_scope = ? 
      AND status NOT IN ('completed', 'cancelled', 'rejected')
  `).get(customerId, dataScope);
  
  return !!existing;
};

const markAsCompleted = (requestId, certificateId) => {
  const updateStmt = db.prepare(`
    UPDATE deletion_requests 
    SET status = 'completed', certificate_id = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  updateStmt.run(certificateId, moment().toISOString(), requestId);
  return getRequestById(requestId);
};

module.exports = {
  createDeletionRequest,
  getRequestById,
  getRequestsByCustomer,
  getAllRequests,
  updateRequestStatus,
  incrementRetryCount,
  canRetry,
  checkDuplicateRequest,
  markAsCompleted
};
