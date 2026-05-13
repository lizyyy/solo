const requestHistory = [];
const fieldUsageStats = {};
const idempotencyStore = new Map();

function recordRequest(originalBody, adaptedBody, clientVersion, matchedRules, warnings, errors, endpoint) {
  const record = {
    timestamp: new Date().toISOString(),
    endpoint,
    clientVersion,
    originalBody: JSON.parse(JSON.stringify(originalBody)),
    adaptedBody: JSON.parse(JSON.stringify(adaptedBody)),
    matchedRules,
    warnings,
    errors
  };
  requestHistory.push(record);
  
  if (!fieldUsageStats[clientVersion]) {
    fieldUsageStats[clientVersion] = {
      totalRequests: 0,
      oldFields: {},
      deprecatedFields: {},
      grayFields: {}
    };
  }
  
  fieldUsageStats[clientVersion].totalRequests++;
  
  matchedRules.forEach(rule => {
    if (rule.type === 'fieldMapping' && rule.oldField) {
      if (!fieldUsageStats[clientVersion].oldFields[rule.oldField]) {
        fieldUsageStats[clientVersion].oldFields[rule.oldField] = 0;
      }
      fieldUsageStats[clientVersion].oldFields[rule.oldField]++;
    }
    
    if (rule.type === 'deprecatedField') {
      if (!fieldUsageStats[clientVersion].deprecatedFields[rule.field]) {
        fieldUsageStats[clientVersion].deprecatedFields[rule.field] = 0;
      }
      fieldUsageStats[clientVersion].deprecatedFields[rule.field]++;
    }
    
    if (rule.type === 'grayField') {
      if (!fieldUsageStats[clientVersion].grayFields[rule.field]) {
        fieldUsageStats[clientVersion].grayFields[rule.field] = 0;
      }
      fieldUsageStats[clientVersion].grayFields[rule.field]++;
    }
  });
  
  return record;
}

function getFieldUsageStats() {
  return JSON.parse(JSON.stringify(fieldUsageStats));
}

function getRequestHistory() {
  return JSON.parse(JSON.stringify(requestHistory));
}

function checkIdempotency(key) {
  if (idempotencyStore.has(key)) {
    return { exists: true, result: idempotencyStore.get(key) };
  }
  return { exists: false };
}

function storeIdempotency(key, result) {
  idempotencyStore.set(key, result);
  return true;
}

module.exports = {
  recordRequest,
  getFieldUsageStats,
  getRequestHistory,
  checkIdempotency,
  storeIdempotency
};
