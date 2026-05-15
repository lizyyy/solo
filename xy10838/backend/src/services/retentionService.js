const moment = require('moment');
const { getQuery, allQuery, runQuery, uuid } = require('../database');

const validateRetentionPeriod = async (domainId, recordDate) => {
  const domain = await getQuery('SELECT * FROM data_domains WHERE id = ?', [domainId]);
  if (!domain) {
    throw new Error('数据域不存在');
  }

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

const getActiveDomains = async () => {
  return await allQuery('SELECT * FROM data_domains WHERE is_active = 1 ORDER BY name');
};

const getDomainById = async (id) => {
  return await getQuery('SELECT * FROM data_domains WHERE id = ?', [id]);
};

const createDomain = async (data) => {
  const id = uuid();
  await runQuery(
    'INSERT INTO data_domains (id, name, description, retention_days, is_active) VALUES (?, ?, ?, ?, ?)',
    [id, data.name, data.description || '', data.retention_days || 365, data.is_active !== false ? 1 : 0]
  );
  return await getDomainById(id);
};

const getRetentionRules = async (domainId = null) => {
  let sql = 'SELECT * FROM retention_rules WHERE is_active = 1';
  let params = [];
  if (domainId) {
    sql += ' AND domain_id = ?';
    params.push(domainId);
  }
  sql += ' ORDER BY priority DESC';
  return await allQuery(sql, params);
};

const applyDeletionRules = async (requestId) => {
  const request = await getQuery('SELECT * FROM deletion_requests WHERE id = ?', [requestId]);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const domains = await getActiveDomains();
  const results = [];

  for (const domain of domains) {
    const validation = await validateRetentionPeriod(domain.id, request.requested_at);
    
    if (validation.isValid) {
      const taskId = uuid();
      await runQuery(
        `INSERT INTO execution_tasks (id, request_id, domain_id, status, total_records) 
         VALUES (?, ?, ?, 'PENDING', ?)`,
        [taskId, requestId, domain.id, Math.floor(Math.random() * 1000) + 100]
      );
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

  return results;
};

module.exports = {
  validateRetentionPeriod,
  getActiveDomains,
  getDomainById,
  createDomain,
  getRetentionRules,
  applyDeletionRules
};
