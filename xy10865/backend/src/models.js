const { v4: uuidv4 } = require('uuid');

const SERVICE_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  RECOVERING: 'recovering'
};

const DEPENDENCY_STATUS = {
  UP: 'up',
  DOWN: 'down',
  DEGRADED: 'degraded',
  UNKNOWN: 'unknown'
};

const CHECK_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  WARNING: 'warning'
};

class Service {
  constructor({ id, name, description, owner, tags = [] }) {
    this.id = id || uuidv4();
    this.name = name;
    this.description = description;
    this.owner = owner;
    this.tags = tags;
    this.status = SERVICE_STATUS.HEALTHY;
    this.healthScore = 100;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.lastCheckAt = null;
    this.recoveredAt = null;
    this.degradedSince = null;
  }

  updateStatus(newStatus, reason = '') {
    const oldStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();
    
    if (newStatus === SERVICE_STATUS.DEGRADED || newStatus === SERVICE_STATUS.UNHEALTHY) {
      if (!this.degradedSince) {
        this.degradedSince = new Date();
      }
      this.recoveredAt = null;
    } else if (newStatus === SERVICE_STATUS.HEALTHY && oldStatus !== SERVICE_STATUS.HEALTHY) {
      this.recoveredAt = new Date();
      this.degradedSince = null;
    }
    
    return { oldStatus, newStatus, reason, timestamp: new Date() };
  }
}

class DependencyEndpoint {
  constructor({ id, serviceId, name, url, method = 'GET', timeout = 5000, headers = {}, expectedStatus = 200 }) {
    this.id = id || uuidv4();
    this.serviceId = serviceId;
    this.name = name;
    this.url = url;
    this.method = method;
    this.timeout = timeout;
    this.headers = headers;
    this.expectedStatus = expectedStatus;
    this.status = DEPENDENCY_STATUS.UNKNOWN;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastCheckAt = null;
    this.lastSuccessAt = null;
    this.lastFailureAt = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  recordResult(success) {
    this.updatedAt = new Date();
    this.lastCheckAt = new Date();
    
    if (success) {
      this.consecutiveSuccesses++;
      this.consecutiveFailures = 0;
      this.lastSuccessAt = new Date();
      this.status = DEPENDENCY_STATUS.UP;
    } else {
      this.consecutiveFailures++;
      this.consecutiveSuccesses = 0;
      this.lastFailureAt = new Date();
      if (this.consecutiveFailures >= 3) {
        this.status = DEPENDENCY_STATUS.DOWN;
      } else {
        this.status = DEPENDENCY_STATUS.DEGRADED;
      }
    }
    
    return success;
  }
}

class CheckItem {
  constructor({ id, serviceId, dependencyId, type, config = {} }) {
    this.id = id || uuidv4();
    this.serviceId = serviceId;
    this.dependencyId = dependencyId;
    this.type = type;
    this.config = config;
    this.enabled = true;
    this.lastResult = null;
    this.lastCheckAt = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

class FailureSample {
  constructor({ id, serviceId, dependencyId, checkItemId, errorMessage, statusCode, responseTime, requestDetails = {} }) {
    this.id = id || uuidv4();
    this.serviceId = serviceId;
    this.dependencyId = dependencyId;
    this.checkItemId = checkItemId;
    this.errorMessage = errorMessage;
    this.statusCode = statusCode;
    this.responseTime = responseTime;
    this.requestDetails = requestDetails;
    this.timestamp = new Date();
  }
}

class StatusTimeline {
  constructor({ serviceId, oldStatus, newStatus, reason, metadata = {} }) {
    this.id = uuidv4();
    this.serviceId = serviceId;
    this.oldStatus = oldStatus;
    this.newStatus = newStatus;
    this.reason = reason;
    this.metadata = metadata;
    this.timestamp = new Date();
  }
}

module.exports = {
  SERVICE_STATUS,
  DEPENDENCY_STATUS,
  CHECK_RESULT,
  Service,
  DependencyEndpoint,
  CheckItem,
  FailureSample,
  StatusTimeline
};
