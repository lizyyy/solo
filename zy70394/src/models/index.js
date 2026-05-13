const { v4: uuidv4 } = require('uuid');

const storage = {
  applications: {},
  callLogs: {},
  taskDependencies: {},
  alerts: {},
  documentLinks: {},
  confirmations: {},
  reports: {}
};

class RetirementApplication {
  constructor(data) {
    this.id = uuidv4();
    this.serviceName = data.serviceName;
    this.serviceVersion = data.serviceVersion || '1.0.0';
    this.description = data.description || '';
    this.planedRetirementDate = data.planedRetirementDate;
    this.actualRetirementDate = null;
    this.status = 'DRAFT';
    this.createdAt = new Date().toISOString();
    this.expiresAt = data.expiresAt || this._calculateExpiry();
    this.createdBy = data.createdBy;
    this.notes = data.notes || '';
  }

  _calculateExpiry() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString();
  }

  update(data) {
    const allowedFields = ['description', 'planedRetirementDate', 'notes', 'status'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    }
  }
}

class CallLog {
  constructor(data) {
    this.id = uuidv4();
    this.applicationId = data.applicationId;
    this.callerService = data.callerService;
    this.callerEndpoint = data.callerEndpoint || '';
    this.calledEndpoint = data.calledEndpoint;
    this.callTime = data.callTime || new Date().toISOString();
    this.requestCount = data.requestCount || 1;
    this.successRate = data.successRate !== undefined ? data.successRate : 1.0;
    this.averageLatency = data.averageLatency || 0;
  }
}

class TaskDependency {
  constructor(data) {
    this.id = uuidv4();
    this.applicationId = data.applicationId;
    this.taskName = data.taskName;
    this.taskType = data.taskType;
    this.cronExpression = data.cronExpression || '';
    this.isCritical = data.isCritical || false;
    this.migrationStatus = data.migrationStatus || 'PENDING';
    this.responsiblePerson = data.responsiblePerson || '';
    this.targetService = data.targetService || '';
    this.notes = data.notes || '';
  }

  update(data) {
    const allowedFields = ['migrationStatus', 'targetService', 'notes', 'isCritical'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    }
  }
}

class Alert {
  constructor(data) {
    this.id = uuidv4();
    this.applicationId = data.applicationId;
    this.alertName = data.alertName;
    this.alertType = data.alertType;
    this.severity = data.severity || 'MEDIUM';
    this.status = data.status || 'ACTIVE';
    this.responsiblePerson = data.responsiblePerson || '';
    this.targetService = data.targetService || '';
    this.description = data.description || '';
  }

  update(data) {
    const allowedFields = ['status', 'targetService', 'description', 'responsiblePerson'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    }
  }
}

class DocumentLink {
  constructor(data) {
    this.id = uuidv4();
    this.applicationId = data.applicationId;
    this.linkName = data.linkName;
    this.linkUrl = data.linkUrl;
    this.documentType = data.documentType;
    this.description = data.description || '';
  }
}

class Confirmation {
  constructor(data) {
    this.id = uuidv4();
    this.applicationId = data.applicationId;
    this.personName = data.personName;
    this.personEmail = data.personEmail;
    this.role = data.role;
    this.confirmed = false;
    this.confirmedAt = null;
    this.notes = data.notes || '';
  }

  confirm() {
    this.confirmed = true;
    this.confirmedAt = new Date().toISOString();
  }
}

class BlockingItem {
  constructor(type, description, details = {}) {
    this.id = uuidv4();
    this.type = type;
    this.description = description;
    this.details = details;
    this.resolved = false;
    this.resolvedAt = null;
  }
}

class RetirementReport {
  constructor(applicationId) {
    this.id = uuidv4();
    this.applicationId = applicationId;
    this.generatedAt = new Date().toISOString();
    this.blockingItems = [];
    this.confirmationStatus = {};
    this.lastCallTime = null;
    this.callers = [];
    this.retirementWindow = null;
    this.summary = '';
    this.isArchived = false;
  }
}

module.exports = {
  storage,
  RetirementApplication,
  CallLog,
  TaskDependency,
  Alert,
  DocumentLink,
  Confirmation,
  BlockingItem,
  RetirementReport
};
