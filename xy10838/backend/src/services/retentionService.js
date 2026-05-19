const moment = require('moment');
const { db, uuid, getNow, saveDatabase } = require('../database');

const validateRetentionPeriod = (domain, recordDate) => {
  const recordMoment = moment(recordDate);
  const retentionEndDate = recordMoment.add(domain.retention_days, 'days');
  
  const now = moment();
  const isExpired = now.isAfter(retentionEndDate);

  return {
    isValid: isExpired,
    domainName: domain.name,
    retentionDays: domain.retention_days,
    recordDate: recordDate,
    retentionEndDate: retentionEndDate.format('YYYY-MM-DD HH:mm:ss'),
    daysRemaining: isExpired ? 0 : retentionEndDate.diff(now, 'days')
  };
};

const getActiveDomains = () => {
  return db.data_domains.filter(d => d.is_active);
};

const getDomainById = (id) => {
  return db.data_domains.find(d => d.id === id);
};

const createDomain = (data) => {
  const id = uuid();
  const domain = {
    id,
    name: data.name,
    description: data.description || '',
    retention_days: data.retentionDays || 365,
    is_active: data.isActive !== false ? 1 : 0,
    created_at: getNow(),
    updated_at: getNow()
  };
  db.data_domains.push(domain);
  return domain;
};

const applyDeletionRules = (requestId) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const domains = getActiveDomains();
  const results = [];

  for (const domain of domains) {
    const dataCreationDate = moment(request.requested_at)
      .subtract(domain.retention_days, 'days')
      .subtract(30, 'days')
      .format();
    
    const validation = validateRetentionPeriod(domain, dataCreationDate);
    
    if (validation.isValid) {
      const taskId = uuid();
      const task = {
        id: taskId,
        request_id: requestId,
        domain_id: domain.id,
        status: 'PENDING',
        total_records: Math.floor(Math.random() * 1000) + 100,
        processed_records: 0,
        failed_records: 0,
        retry_count: 0,
        max_retries: 3,
        created_at: getNow()
      };
      db.execution_tasks.push(task);
      results.push({
        domainId: domain.id,
        domainName: domain.name,
        status: 'SCHEDULED',
        taskId,
        validation
      });
    } else {
      results.push({
        domainId: domain.id,
        domainName: domain.name,
        status: 'SKIPPED',
        reason: `保留期未到，还有 ${validation.daysRemaining} 天到期`,
        validation
      });
    }
  }

  saveDatabase();
  return results;
};

module.exports = {
  validateRetentionPeriod,
  getActiveDomains,
  getDomainById,
  createDomain,
  applyDeletionRules
};
