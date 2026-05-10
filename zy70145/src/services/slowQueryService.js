const db = require('../db');
const fingerprintService = require('./fingerprint');
const exceptionService = require('./exceptionService');
const taskService = require('./taskService');
const logger = require('./logger');

const FINGERPRINT_STATUSES = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  OPTIMIZED: 'optimized',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const OPTIMIZATION_STATUSES = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const RERUN_STATUSES = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  IMPROVED: 'improved',
  REGRESSED: 'regressed'
};

function validateSlowQuery(query) {
  const errors = [];
  
  if (!query || typeof query !== 'object') {
    errors.push('Query must be an object');
    return errors;
  }
  
  if (!query.sql || typeof query.sql !== 'string' || query.sql.trim().length === 0) {
    errors.push('SQL is required');
  }
  
  if (query.execution_time === undefined || query.execution_time === null) {
    errors.push('execution_time is required');
  } else if (typeof query.execution_time !== 'number' || query.execution_time <= 0) {
    errors.push('execution_time must be a positive number');
  }
  
  if (query.occurred_at && typeof query.occurred_at !== 'number') {
    errors.push('occurred_at must be a Unix timestamp');
  }
  
  return errors;
}

function recordStatusChange(entityType, entityId, fromStatus, toStatus, changedBy, note) {
  db.insert('status_history', {
    entity_type: entityType,
    entity_id: entityId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy || null,
    note: note || null
  });
  logger.info(`Status change: ${entityType}#${entityId} ${fromStatus} -> ${toStatus}`, { changedBy, note });
}

function ingestSlowQuery(query) {
  const errors = validateSlowQuery(query);
  
  if (errors.length > 0) {
    const errorMsg = errors.join('; ');
    exceptionService.recordException(
      exceptionService.EXCEPTION_TYPES.VALIDATION_ERROR,
      'ingestSlowQuery',
      query,
      errorMsg
    );
    throw new Error(errorMsg);
  }
  
  const occurredAt = query.occurred_at || db.now();
  let fingerprintId = null;
  let fingerprintHash = null;
  let isNewFingerprint = false;
  
  try {
    const fingerprint = fingerprintService.generateFingerprint(query.sql);
    fingerprintHash = fingerprint.hash;
    
    let fingerprintRecord = db.findOne('query_fingerprints', f => f.fingerprint === fingerprintHash);
    
    if (!fingerprintRecord) {
      const newFingerprint = db.insert('query_fingerprints', {
        fingerprint: fingerprintHash,
        normalized_sql: fingerprint.normalized,
        sample_sql: query.sql.substring(0, 2000),
        owner_id: null,
        status: FINGERPRINT_STATUSES.PENDING,
        total_count: 1,
        avg_execution_time: query.execution_time,
        max_execution_time: query.execution_time,
        first_seen_at: occurredAt,
        last_seen_at: occurredAt
      });
      fingerprintId = newFingerprint.id;
      isNewFingerprint = true;
      
      logger.info('New fingerprint created', { fingerprintId, hash: fingerprintHash.substring(0, 16) });
      
      taskService.queueTask(
        taskService.TASK_TYPES.FINGERPRINT_ANALYSIS,
        { fingerprintId, fingerprintHash },
        10
      );
    } else {
      fingerprintId = fingerprintRecord.id;
      const newCount = fingerprintRecord.total_count + 1;
      const newAvg = (fingerprintRecord.avg_execution_time * fingerprintRecord.total_count + query.execution_time) / newCount;
      const newMax = Math.max(fingerprintRecord.max_execution_time, query.execution_time);
      
      db.update('query_fingerprints', fingerprintId, {
        total_count: newCount,
        avg_execution_time: newAvg,
        max_execution_time: newMax,
        last_seen_at: occurredAt
      });
    }
    
    const newQuery = db.insert('slow_queries', {
      fingerprint_id: fingerprintId,
      raw_sql: query.sql,
      execution_time: query.execution_time,
      source: query.source || null,
      database_name: query.database_name || null,
      user_name: query.user_name || null,
      occurred_at: occurredAt
    });
    
    logger.debug('Slow query ingested', { 
      queryId: newQuery.id,
      fingerprintId,
      executionTime: query.execution_time
    });
    
    return {
      queryId: newQuery.id,
      fingerprintId,
      fingerprintHash,
      isNewFingerprint
    };
    
  } catch (e) {
    exceptionService.recordException(
      exceptionService.EXCEPTION_TYPES.FINGERPRINT_FAILED,
      'ingestSlowQuery',
      query,
      e.message
    );
    
    const newQuery = db.insert('slow_queries', {
      fingerprint_id: null,
      raw_sql: query.sql,
      execution_time: query.execution_time,
      source: query.source || null,
      database_name: query.database_name || null,
      user_name: query.user_name || null,
      occurred_at: occurredAt
    });
    
    logger.warn('Query stored without fingerprint', { queryId: newQuery.id, error: e.message });
    
    return {
      queryId: newQuery.id,
      fingerprintId: null,
      error: e.message
    };
  }
}

function ingestBatch(queries) {
  if (!Array.isArray(queries)) {
    throw new Error('Batch must be an array');
  }
  
  const results = [];
  const errors = [];
  
  for (const query of queries) {
    try {
      const result = ingestSlowQuery(query);
      results.push(result);
    } catch (e) {
      errors.push({ query, error: e.message });
    }
  }
  
  return {
    success: results.length,
    failed: errors.length,
    results,
    errors
  };
}

function listFingerprints(filters = {}) {
  let fingerprints = db.findAll('query_fingerprints');
  
  if (filters.status) {
    fingerprints = fingerprints.filter(f => f.status === filters.status);
  }
  if (filters.owner_id) {
    fingerprints = fingerprints.filter(f => f.owner_id === filters.owner_id);
  }
  
  const owners = db.findAll('owners');
  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  
  return fingerprints
    .map(f => ({
      ...f,
      owner_name: ownerMap.get(f.owner_id) || null
    }))
    .sort((a, b) => b.last_seen_at - a.last_seen_at);
}

function getFingerprintDetail(id) {
  const fingerprint = db.findById('query_fingerprints', id);
  if (!fingerprint) {
    return null;
  }
  
  const queries = db.findAll('slow_queries', q => q.fingerprint_id === id)
    .sort((a, b) => b.occurred_at - a.occurred_at)
    .slice(0, 20);
  
  const optimizations = db.findAll('optimization_records', o => o.fingerprint_id === id)
    .sort((a, b) => b.created_at - a.created_at)
    .map(opt => {
      const owner = db.findById('owners', opt.owner_id);
      return {
        ...opt,
        owner_name: owner ? owner.name : null
      };
    });
  
  const history = db.findAll('status_history', h => h.entity_type === 'fingerprint' && h.entity_id === id)
    .sort((a, b) => b.created_at - a.created_at)
    .map(h => {
      const owner = db.findById('owners', h.changed_by);
      return {
        ...h,
        changed_by_name: owner ? owner.name : null
      };
    });
  
  return {
    ...fingerprint,
    recent_queries: queries,
    optimizations,
    history
  };
}

function claimFingerprint(fingerprintId, ownerId, note) {
  const fingerprint = db.findById('query_fingerprints', fingerprintId);
  if (!fingerprint) {
    throw new Error(`Fingerprint ${fingerprintId} not found`);
  }
  
  const owner = db.findById('owners', ownerId);
  if (!owner) {
    throw new Error(`Owner ${ownerId} not found`);
  }
  
  const oldStatus = fingerprint.status;
  const newStatus = FINGERPRINT_STATUSES.CLAIMED;
  
  db.update('query_fingerprints', fingerprintId, {
    owner_id: ownerId,
    status: newStatus
  });
  
  recordStatusChange('fingerprint', fingerprintId, oldStatus, newStatus, ownerId, note || 'Claimed by owner');
  
  logger.info('Fingerprint claimed', { fingerprintId, ownerId, ownerName: owner.name });
  
  return {
    fingerprintId,
    ownerId,
    status: newStatus
  };
}

function createOptimization(fingerprintId, ownerId, data) {
  const fingerprint = db.findById('query_fingerprints', fingerprintId);
  if (!fingerprint) {
    throw new Error(`Fingerprint ${fingerprintId} not found`);
  }
  
  const owner = db.findById('owners', ownerId);
  if (!owner) {
    throw new Error(`Owner ${ownerId} not found`);
  }
  
  const optimization = db.insert('optimization_records', {
    fingerprint_id: fingerprintId,
    owner_id: ownerId,
    before_sql: data.before_sql || null,
    after_sql: data.after_sql || null,
    description: data.description || null,
    status: OPTIMIZATION_STATUSES.IN_PROGRESS
  });
  
  recordStatusChange(
    'fingerprint',
    fingerprintId,
    fingerprint.status,
    FINGERPRINT_STATUSES.IN_PROGRESS,
    ownerId,
    'Optimization started'
  );
  
  db.update('query_fingerprints', fingerprintId, {
    status: FINGERPRINT_STATUSES.IN_PROGRESS
  });
  
  logger.info('Optimization created', { 
    optimizationId: optimization.id,
    fingerprintId,
    ownerId
  });
  
  return {
    optimizationId: optimization.id,
    fingerprintId,
    status: OPTIMIZATION_STATUSES.IN_PROGRESS
  };
}

function recordRerun(optimizationId, data) {
  const optimization = db.findById('optimization_records', optimizationId);
  if (!optimization) {
    throw new Error(`Optimization ${optimizationId} not found`);
  }
  
  const improvementPercent = data.before_time && data.after_time && data.before_time > 0
    ? ((data.before_time - data.after_time) / data.before_time) * 100
    : null;
  
  let status = RERUN_STATUSES.SUCCESS;
  if (improvementPercent !== null) {
    if (improvementPercent > 0) {
      status = RERUN_STATUSES.IMPROVED;
    } else if (improvementPercent < 0) {
      status = RERUN_STATUSES.REGRESSED;
    }
  }
  
  const executedAt = data.executed_at || db.now();
  
  const rerun = db.insert('rerun_results', {
    optimization_record_id: optimizationId,
    before_time: data.before_time || null,
    after_time: data.after_time || null,
    improvement_percent: improvementPercent,
    environment: data.environment || null,
    status,
    notes: data.notes || null,
    executed_at: executedAt
  });
  
  if (status === RERUN_STATUSES.IMPROVED) {
    db.update('optimization_records', optimizationId, {
      status: OPTIMIZATION_STATUSES.VERIFIED
    });
    
    const fingerprint = db.findById('query_fingerprints', optimization.fingerprint_id);
    if (fingerprint) {
      recordStatusChange(
        'fingerprint',
        optimization.fingerprint_id,
        fingerprint.status,
        FINGERPRINT_STATUSES.VERIFIED,
        optimization.owner_id,
        `Rerun verified with ${improvementPercent.toFixed(2)}% improvement`
      );
      db.update('query_fingerprints', optimization.fingerprint_id, {
        status: FINGERPRINT_STATUSES.VERIFIED
      });
    }
  }
  
  logger.info('Rerun recorded', { 
    rerunId: rerun.id,
    optimizationId,
    status,
    improvementPercent
  });
  
  return {
    rerunId: rerun.id,
    optimizationId,
    status,
    improvementPercent
  };
}

function generateWeeklyReport(startDate, endDate) {
  const start = startDate || db.now() - 7 * 24 * 60 * 60;
  const end = endDate || db.now();
  
  const fingerprints = db.findAll('query_fingerprints');
  const newFingerprints = fingerprints.filter(f => f.first_seen_at >= start && f.first_seen_at <= end);
  const avgTimeNew = newFingerprints.length > 0
    ? newFingerprints.reduce((sum, f) => sum + f.avg_execution_time, 0) / newFingerprints.length
    : 0;
  
  const queries = db.findAll('slow_queries');
  const weekQueries = queries.filter(q => q.occurred_at >= start && q.occurred_at <= end);
  const avgTimeQueries = weekQueries.length > 0
    ? weekQueries.reduce((sum, q) => sum + q.execution_time, 0) / weekQueries.length
    : 0;
  
  const statusCounts = {};
  fingerprints.forEach(f => {
    statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
  });
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
  
  const optimizations = db.findAll('optimization_records');
  const weekOptimizations = optimizations.filter(o => o.created_at >= start && o.created_at <= end);
  
  const reruns = db.findAll('rerun_results');
  const improvedReruns = reruns.filter(r => r.status === 'improved' && r.created_at >= start && r.created_at <= end);
  const avgImprovement = improvedReruns.length > 0
    ? improvedReruns.reduce((sum, r) => sum + (r.improvement_percent || 0), 0) / improvedReruns.length
    : 0;
  
  const exceptions = db.findAll('exception_logs');
  const unresolvedExceptions = exceptions.filter(e => e.resolved === 0);
  
  const tasks = db.findAll('task_queue');
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'retry');
  
  const owners = db.findAll('owners');
  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  
  const topFingerprints = fingerprints
    .filter(f => f.last_seen_at >= start)
    .sort((a, b) => {
      if (b.total_count !== a.total_count) return b.total_count - a.total_count;
      return b.avg_execution_time - a.avg_execution_time;
    })
    .slice(0, 10)
    .map(f => ({
      id: f.id,
      normalized_sql: f.normalized_sql,
      total_count: f.total_count,
      avg_execution_time: f.avg_execution_time,
      status: f.status,
      owner_name: ownerMap.get(f.owner_id) || null
    }));
  
  return {
    period: {
      start: new Date(start * 1000).toISOString(),
      end: new Date(end * 1000).toISOString()
    },
    summary: {
      newFingerprints: newFingerprints.length,
      totalSlowQueries: weekQueries.length,
      avgExecutionTime: avgTimeQueries,
      optimizationsCreated: weekOptimizations.length,
      verifiedImprovements: improvedReruns.length,
      avgImprovementPercent: avgImprovement,
      unresolvedExceptions: unresolvedExceptions.length,
      pendingTasks: pendingTasks.length
    },
    statusBreakdown,
    topFingerprints
  };
}

function findOrCreateOwner(name, email) {
  let owner = db.findOne('owners', o => o.name === name);
  
  if (!owner) {
    owner = db.insert('owners', {
      name,
      email: email || null
    });
    logger.info('Owner created', { ownerId: owner.id, name });
  }
  
  return owner;
}

function listOwners() {
  return db.findAll('owners').sort((a, b) => b.created_at - a.created_at);
}

module.exports = {
  FINGERPRINT_STATUSES,
  OPTIMIZATION_STATUSES,
  RERUN_STATUSES,
  validateSlowQuery,
  ingestSlowQuery,
  ingestBatch,
  listFingerprints,
  getFingerprintDetail,
  claimFingerprint,
  createOptimization,
  recordRerun,
  generateWeeklyReport,
  findOrCreateOwner,
  listOwners
};
