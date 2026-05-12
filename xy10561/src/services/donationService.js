const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, get, all } = require('../models/database');
const { DonationStatus, EntityType, ERROR_CODES } = require('../utils/states');
const { recordHistory, getDonationHistory } = require('../utils/history');

function generateOrderNo() {
  return `ORD-${moment().format('YYYYMMDDHHmmss')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function createProject(name, description) {
  const id = uuidv4();
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO projects (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, description, createdAt, createdAt]
  );

  return getProject(id);
}

function getProject(projectId) {
  return get('SELECT * FROM projects WHERE id = ?', [projectId]);
}

function getAllProjects() {
  return all('SELECT * FROM projects ORDER BY created_at DESC');
}

function createDonation(options) {
  const {
    projectId,
    amount,
    donorType,
    donorName,
    donorTaxId,
    donorPhone,
    donorEmail
  } = options;

  if (!projectId || !amount || !donorType) {
    const error = new Error('Missing required fields: projectId, amount, donorType');
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  const project = getProject(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (donorType === 'ENTERPRISE' && !donorTaxId) {
    const error = new Error('Enterprise donor requires tax ID');
    error.code = ERROR_CODES.TAX_ID_MISSING;
    error.statusCode = 400;
    throw error;
  }

  const id = uuidv4();
  const orderNo = generateOrderNo();
  const status = DonationStatus.PENDING;
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO donations (
      id, project_id, order_no, amount, donor_type, donor_name,
      donor_tax_id, donor_phone, donor_email, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, projectId, orderNo, amount, donorType, donorName,
      donorTaxId, donorPhone, donorEmail, status, createdAt, createdAt
    ]
  );

  const donation = getDonation(id);
  
  recordHistory({
    entityType: EntityType.DONATION,
    entityId: id,
    action: 'CREATE',
    toStatus: status,
    afterData: donation,
    operator: options.operator || 'SYSTEM',
    reason: 'Create donation record'
  });

  return donation;
}

function getDonation(donationId) {
  const donation = get('SELECT * FROM donations WHERE id = ?', [donationId]);
  if (!donation) return null;
  
  return {
    ...donation,
    history: getDonationHistory(donationId)
  };
}

function getDonationByOrderNo(orderNo) {
  const donation = get('SELECT * FROM donations WHERE order_no = ?', [orderNo]);
  if (!donation) return null;
  
  return {
    ...donation,
    history: getDonationHistory(donation.id)
  };
}

function getAllDonations(filters = {}) {
  let sql = 'SELECT * FROM donations WHERE 1=1';
  const params = [];

  if (filters.projectId) {
    sql += ' AND project_id = ?';
    params.push(filters.projectId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.donorType) {
    sql += ' AND donor_type = ?';
    params.push(filters.donorType);
  }

  sql += ' ORDER BY created_at DESC';
  return all(sql, params);
}

function confirmDonation(donationId, options = {}) {
  const donation = get('SELECT * FROM donations WHERE id = ?', [donationId]);
  if (!donation) {
    const error = new Error('Donation not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (donation.status !== DonationStatus.PENDING) {
    const error = new Error(`Cannot confirm donation in ${donation.status} status`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const beforeData = { ...donation };
  const newStatus = DonationStatus.CONFIRMED;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    'UPDATE donations SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, updatedAt, donationId]
  );

  const updatedDonation = getDonation(donationId);

  recordHistory({
    entityType: EntityType.DONATION,
    entityId: donationId,
    action: 'CONFIRM',
    fromStatus: donation.status,
    toStatus: newStatus,
    beforeData,
    afterData: updatedDonation,
    operator: options.operator || 'SYSTEM',
    reason: options.reason || 'Donation payment confirmed'
  });

  return updatedDonation;
}

function refundDonation(donationId, options = {}) {
  const donation = get('SELECT * FROM donations WHERE id = ?', [donationId]);
  if (!donation) {
    const error = new Error('Donation not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  if (donation.status !== DonationStatus.CONFIRMED) {
    const error = new Error(`Cannot refund donation in ${donation.status} status. Only CONFIRMED donations can be refunded.`);
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const invoices = all('SELECT * FROM invoices WHERE donation_id = ?', [donationId]);
  const activeInvoices = invoices.filter(i => i.status !== 'CANCELLED');
  
  if (activeInvoices.length > 0) {
    const error = new Error('Cannot refund donation with active invoices. Please cancel invoices first.');
    error.code = ERROR_CODES.INVALID_STATUS_TRANSITION;
    error.statusCode = 400;
    throw error;
  }

  const beforeData = { ...donation };
  const newStatus = DonationStatus.REFUNDED;
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    'UPDATE donations SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, updatedAt, donationId]
  );

  const updatedDonation = getDonation(donationId);

  recordHistory({
    entityType: EntityType.DONATION,
    entityId: donationId,
    action: 'REFUND',
    fromStatus: donation.status,
    toStatus: newStatus,
    beforeData,
    afterData: updatedDonation,
    operator: options.operator || 'SYSTEM',
    reason: options.reason || 'Donation refunded'
  });

  return updatedDonation;
}

function addFundUsage(projectId, amount, purpose, description, operator) {
  const project = getProject(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.code = ERROR_CODES.NOT_FOUND;
    error.statusCode = 404;
    throw error;
  }

  const donations = all('SELECT * FROM donations WHERE project_id = ? AND status = ?', [projectId, DonationStatus.CONFIRMED]);
  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);
  
  const usages = all('SELECT * FROM fund_usages WHERE project_id = ?', [projectId]);
  const totalUsed = usages.reduce((sum, u) => sum + u.amount, 0);

  if (totalUsed + amount > totalDonated) {
    const error = new Error(`Insufficient funds. Available: ${totalDonated - totalUsed}, Requested: ${amount}`);
    error.code = ERROR_CODES.VALIDATION_ERROR;
    error.statusCode = 400;
    throw error;
  }

  const id = uuidv4();
  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

  run(
    `INSERT INTO fund_usages (id, project_id, amount, purpose, description, operator, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, amount, purpose, description, operator || 'SYSTEM', createdAt]
  );

  return get('SELECT * FROM fund_usages WHERE id = ?', [id]);
}

function getProjectFundUsage(projectId) {
  return all('SELECT * FROM fund_usages WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
}

function getProjectFundSummary(projectId) {
  const donations = all('SELECT * FROM donations WHERE project_id = ? AND status = ?', [projectId, DonationStatus.CONFIRMED]);
  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);

  const usages = all('SELECT * FROM fund_usages WHERE project_id = ?', [projectId]);
  const totalUsed = usages.reduce((sum, u) => sum + u.amount, 0);

  return {
    projectId,
    totalDonated,
    totalUsed,
    availableBalance: totalDonated - totalUsed,
    usageCount: usages.length,
    donationCount: donations.length
  };
}

module.exports = {
  createProject,
  getProject,
  getAllProjects,
  createDonation,
  getDonation,
  getDonationByOrderNo,
  getAllDonations,
  confirmDonation,
  refundDonation,
  addFundUsage,
  getProjectFundUsage,
  getProjectFundSummary
};
