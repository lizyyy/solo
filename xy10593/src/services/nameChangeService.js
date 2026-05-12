const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory, getStatusHistory } = require('../utils');
const { getBooking, BOOKING_STATUS } = require('./bookingService');
const { getCustomer } = require('./customerService');
const { freezeCommission, getCommissionByBooking, COMMISSION_STATUS } = require('./commissionService');

const NAME_CHANGE_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed'
};

const createNameChangeApplication = (data) => {
  const id = uuid();
  const applicationCode = generateCode('NC');
  
  const booking = getBooking(data.booking_id);
  if (!booking) throw new Error('认购单不存在');
  
  if (booking.status !== BOOKING_STATUS.LOCKED &&
      booking.status !== BOOKING_STATUS.DEPOSITED) {
    throw new Error(`认购单状态异常，当前状态: ${booking.status}，无法申请改名`);
  }
  
  const oldCustomer = getCustomer(data.old_customer_id || booking.customer_id);
  if (!oldCustomer) throw new Error('原客户不存在');
  
  const newCustomer = getCustomer(data.new_customer_id);
  if (!newCustomer) throw new Error('新客户不存在');
  
  if (oldCustomer.id === newCustomer.id) {
    throw new Error('新客户与原客户不能相同');
  }
  
  prepare(`
    INSERT INTO name_change_applications (
      id, application_code, booking_id, old_customer_id, new_customer_id,
      reason, status, approver, approval_notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, applicationCode, data.booking_id,
    data.old_customer_id, data.new_customer_id,
    data.reason, NAME_CHANGE_STATUS.DRAFT, null, null,
    data.created_by || 'system', now(), now()
  ]);
  
  addStatusHistory('name_change', id, null, NAME_CHANGE_STATUS.DRAFT, '创建改名申请', data.created_by || 'system');
  
  return getNameChangeApplication(id);
};

const getNameChangeApplication = (id) => {
  return prepare(`
    SELECT nca.*,
           b.booking_code, b.status as booking_status,
           oc.name as old_customer_name, oc.phone as old_customer_phone, oc.customer_code as old_customer_code,
           nc.name as new_customer_name, nc.phone as new_customer_phone, nc.customer_code as new_customer_code,
           p.property_code, pr.project_name
    FROM name_change_applications nca
    LEFT JOIN bookings b ON nca.booking_id = b.id
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE nca.id = ?
  `).get([id]);
};

const getNameChangeApplicationByCode = (code) => {
  return prepare(`
    SELECT nca.*,
           b.booking_code,
           oc.name as old_customer_name,
           nc.name as new_customer_name,
           p.property_code, pr.project_name
    FROM name_change_applications nca
    LEFT JOIN bookings b ON nca.booking_id = b.id
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE nca.application_code = ?
  `).get([code]);
};

const listNameChangeApplications = (bookingId = null, status = null) => {
  let sql = `
    SELECT nca.*,
           b.booking_code,
           oc.name as old_customer_name,
           nc.name as new_customer_name,
           p.property_code, pr.project_name
    FROM name_change_applications nca
    LEFT JOIN bookings b ON nca.booking_id = b.id
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND nca.booking_id = ?';
    params.push(bookingId);
  }
  if (status) {
    sql += ' AND nca.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY nca.created_at DESC';
  
  return prepare(sql).all(params);
};

const submitForApproval = (applicationId, operator = 'system') => {
  const application = prepare('SELECT * FROM name_change_applications WHERE id = ?').get([applicationId]);
  if (!application) throw new Error('改名申请不存在');
  
  if (application.status !== NAME_CHANGE_STATUS.DRAFT) {
    throw new Error(`申请状态异常，当前状态: ${application.status}，无法提交审批`);
  }
  
  prepare(`
    UPDATE name_change_applications SET status = ?, updated_at = ? WHERE id = ?
  `).run([NAME_CHANGE_STATUS.PENDING_APPROVAL, now(), applicationId]);
  
  addStatusHistory('name_change', applicationId, NAME_CHANGE_STATUS.DRAFT, NAME_CHANGE_STATUS.PENDING_APPROVAL, '提交审批', operator);
  
  const booking = getBooking(application.booking_id);
  addStatusHistory('booking', application.booking_id, booking.status, booking.status, '改名审批中', operator, {
    name_change_id: applicationId
  });
  
  return getNameChangeApplication(applicationId);
};

const approveNameChange = (applicationId, approvalNotes, operator = 'system') => {
  const application = prepare('SELECT * FROM name_change_applications WHERE id = ?').get([applicationId]);
  if (!application) throw new Error('改名申请不存在');
  
  if (application.status !== NAME_CHANGE_STATUS.PENDING_APPROVAL) {
    throw new Error(`申请状态异常，当前状态: ${application.status}，无法审批`);
  }
  
  prepare(`
    UPDATE name_change_applications
    SET status = ?, approver = ?, approval_notes = ?, updated_at = ?
    WHERE id = ?
  `).run([NAME_CHANGE_STATUS.APPROVED, operator, approvalNotes, now(), applicationId]);
  
  addStatusHistory('name_change', applicationId, NAME_CHANGE_STATUS.PENDING_APPROVAL, NAME_CHANGE_STATUS.APPROVED, '审批通过', operator, {
    approval_notes: approvalNotes
  });
  
  return executeNameChange(applicationId, operator);
};

const executeNameChange = (applicationId, operator = 'system') => {
  const application = prepare('SELECT * FROM name_change_applications WHERE id = ?').get([applicationId]);
  if (!application) throw new Error('改名申请不存在');
  
  if (application.status !== NAME_CHANGE_STATUS.APPROVED) {
    throw new Error(`申请状态异常，当前状态: ${application.status}，无法执行改名`);
  }
  
  const booking = prepare('SELECT * FROM bookings WHERE id = ?').get([application.booking_id]);
  if (!booking) throw new Error('认购单不存在');
  
  const oldCustomerId = booking.customer_id;
  const newCustomerId = application.new_customer_id;
  
  prepare(`
    UPDATE bookings SET customer_id = ?, updated_at = ? WHERE id = ?
  `).run([newCustomerId, now(), application.booking_id]);
  
  prepare(`
    UPDATE name_change_applications SET status = ?, updated_at = ? WHERE id = ?
  `).run([NAME_CHANGE_STATUS.COMPLETED, now(), applicationId]);
  
  addStatusHistory('name_change', applicationId, NAME_CHANGE_STATUS.APPROVED, NAME_CHANGE_STATUS.COMPLETED, '改名执行完成', operator);
  
  addStatusHistory('booking', application.booking_id, booking.status, booking.status, '客户改名', operator, {
    old_customer_id: oldCustomerId,
    new_customer_id: newCustomerId,
    name_change_id: applicationId
  });
  
  const commissions = getCommissionByBooking(application.booking_id);
  commissions.forEach(c => {
    if (c.status !== COMMISSION_STATUS.VOID && c.status !== COMMISSION_STATUS.SETTLED) {
      freezeCommission(c.id, '客户改名，佣金冻结待确认', operator);
    }
  });
  
  return getNameChangeApplication(applicationId);
};

const rejectNameChange = (applicationId, approvalNotes, operator = 'system') => {
  const application = prepare('SELECT * FROM name_change_applications WHERE id = ?').get([applicationId]);
  if (!application) throw new Error('改名申请不存在');
  
  if (application.status !== NAME_CHANGE_STATUS.PENDING_APPROVAL) {
    throw new Error(`申请状态异常，当前状态: ${application.status}，无法驳回`);
  }
  
  prepare(`
    UPDATE name_change_applications
    SET status = ?, approver = ?, approval_notes = ?, updated_at = ?
    WHERE id = ?
  `).run([NAME_CHANGE_STATUS.REJECTED, operator, approvalNotes, now(), applicationId]);
  
  addStatusHistory('name_change', applicationId, NAME_CHANGE_STATUS.PENDING_APPROVAL, NAME_CHANGE_STATUS.REJECTED, '审批驳回', operator, {
    approval_notes: approvalNotes
  });
  
  addStatusHistory('booking', application.booking_id, null, null, '改名申请驳回', operator, {
    name_change_id: applicationId,
    reason: approvalNotes
  });
  
  return getNameChangeApplication(applicationId);
};

const getCustomerChanges = (bookingId = null) => {
  let sql = `
    SELECT nca.*,
           oc.name as old_customer_name, oc.phone as old_customer_phone,
           nc.name as new_customer_name, nc.phone as new_customer_phone,
           b.booking_code,
           p.property_code, pr.project_name
    FROM name_change_applications nca
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    LEFT JOIN bookings b ON nca.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    WHERE nca.status = 'completed'
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND nca.booking_id = ?';
    params.push(bookingId);
  }
  
  sql += ' ORDER BY nca.updated_at DESC';
  
  const changes = prepare(sql).all(params);
  
  return {
    count: changes.length,
    changes: changes.map(c => ({
      ...c,
      history: getStatusHistory('name_change', c.id)
    }))
  };
};

module.exports = {
  NAME_CHANGE_STATUS,
  createNameChangeApplication,
  getNameChangeApplication,
  getNameChangeApplicationByCode,
  listNameChangeApplications,
  submitForApproval,
  approveNameChange,
  rejectNameChange,
  executeNameChange,
  getCustomerChanges
};
