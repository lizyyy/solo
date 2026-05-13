const { v4: uuidv4 } = require('uuid');
const _ = require('lodash');
const { dataStore } = require('../models/dataStore');

class MaskingService {
  static getPublishedPolicyVersion(resourceType) {
    for (const policy of dataStore.policies.values()) {
      if (policy.resourceType === resourceType) {
        for (const version of dataStore.policyVersions.values()) {
          if (version.policyId === policy.id && 
              version.version === policy.currentVersion && 
              version.status === 'published') {
            return { policy, version };
          }
        }
      }
    }
    return null;
  }

  static checkExceptionAuthorization(userId, role, resourceType, resourceId) {
    const now = new Date();
    for (const exception of dataStore.exceptions.values()) {
      if (exception.userId === userId &&
          exception.role === role &&
          exception.resourceType === resourceType &&
          exception.resourceId === resourceId &&
          new Date(exception.expiresAt) > now) {
        return exception;
      }
    }
    return null;
  }

  static applyMasking(value, maskType) {
    if (value === null || value === undefined) {
      return value;
    }

    switch (maskType) {
      case 'last4':
        if (typeof value === 'string' && value.length > 4) {
          return '*'.repeat(value.length - 4) + value.slice(-4);
        }
        return value;
      case 'partial':
        if (typeof value === 'string') {
          if (value.includes('@')) {
            const [local, domain] = value.split('@');
            if (local.length > 2) {
              return local[0] + '*'.repeat(local.length - 2) + local.slice(-1) + '@' + domain;
            }
            return '*'.repeat(local.length) + '@' + domain;
          }
          if (value.length > 6) {
            return value.slice(0, 3) + '*'.repeat(value.length - 6) + value.slice(-3);
          }
          return '*'.repeat(value.length);
        }
        if (typeof value === 'number') {
          const str = value.toString();
          if (str.length > 4) {
            return str.slice(0, 1) + '*'.repeat(str.length - 2) + str.slice(-1);
          }
          return '*'.repeat(str.length);
        }
        return value;
      case 'full':
        if (typeof value === 'string') {
          return '*'.repeat(value.length);
        }
        return '********';
      default:
        return value;
    }
  }

  static filterResponse(resource, resourceType, role, userId) {
    const policyInfo = this.getPublishedPolicyVersion(resourceType);
    if (!policyInfo) {
      return {
        data: resource,
        policyVersionId: null,
        policyVersion: null,
        hiddenFields: [],
        maskedFields: [],
        exceptionApplied: null
      };
    }

    const { policy, version } = policyInfo;
    const fieldRules = version.fieldRules[role] || {};
    const exception = this.checkExceptionAuthorization(userId, role, resourceType, resource.id);
    
    const result = {};
    const hiddenFields = [];
    const maskedFields = [];
    const exceptionFields = exception ? exception.grantedFields : [];

    for (const [fieldName, value] of Object.entries(resource)) {
      const rule = fieldRules[fieldName];
      
      if (exceptionFields.includes(fieldName)) {
        result[fieldName] = value;
        maskedFields.push({
          field: fieldName,
          originalRule: rule ? (rule.visible ? rule.mask || 'none' : 'hidden') : 'default',
          exceptionApplied: true
        });
        continue;
      }

      if (!rule) {
        hiddenFields.push({
          field: fieldName,
          reason: 'no_rule_defined'
        });
        continue;
      }

      if (!rule.visible) {
        hiddenFields.push({
          field: fieldName,
          reason: 'policy_hidden'
        });
        continue;
      }

      if (rule.mask) {
        result[fieldName] = this.applyMasking(value, rule.mask);
        maskedFields.push({
          field: fieldName,
          maskType: rule.mask,
          originalValue: value
        });
      } else {
        result[fieldName] = value;
      }
    }

    return {
      data: result,
      policyId: policy.id,
      policyVersionId: version.id,
      policyVersion: version.version,
      hiddenFields,
      maskedFields,
      exceptionApplied: exception ? {
        id: exception.id,
        reason: exception.reason,
        expiresAt: exception.expiresAt
      } : null
    };
  }

  static createAuditLog(options) {
    const log = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: options.userId,
      role: options.role,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      policyId: options.policyId,
      policyVersionId: options.policyVersionId,
      policyVersion: options.policyVersion,
      success: options.success,
      reason: options.reason,
      hiddenFields: options.hiddenFields || [],
      maskedFields: options.maskedFields || [],
      exceptionApplied: options.exceptionApplied
    };
    dataStore.auditLogs.push(log);
    return log;
  }

  static getMockCustomer(customerId) {
    return dataStore.mockData.customers.get(customerId);
  }

  static getMockOrder(orderId) {
    return dataStore.mockData.orders.get(orderId);
  }

  static listPolicies() {
    return Array.from(dataStore.policies.values());
  }

  static getPolicy(policyId) {
    return dataStore.policies.get(policyId);
  }

  static listPolicyVersions(policyId) {
    return Array.from(dataStore.policyVersions.values())
      .filter(v => v.policyId === policyId)
      .sort((a, b) => b.version - a.version);
  }

  static getPolicyVersion(versionId) {
    return dataStore.policyVersions.get(versionId);
  }

  static createNewPolicyVersion(policyId, newFieldRules) {
    const policy = dataStore.policies.get(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    const existingVersions = this.listPolicyVersions(policyId);
    const newVersionNumber = existingVersions.length > 0 
      ? Math.max(...existingVersions.map(v => v.version)) + 1 
      : 1;

    const versionId = uuidv4();
    const version = {
      id: versionId,
      policyId,
      version: newVersionNumber,
      status: 'draft',
      fieldRules: newFieldRules,
      createdAt: new Date().toISOString()
    };

    dataStore.policyVersions.set(versionId, version);
    return version;
  }

  static publishPolicyVersion(policyId, versionNumber) {
    const policy = dataStore.policies.get(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    let versionToPublish = null;
    for (const version of dataStore.policyVersions.values()) {
      if (version.policyId === policyId && version.version === versionNumber) {
        versionToPublish = version;
        break;
      }
    }

    if (!versionToPublish) {
      throw new Error('Policy version not found');
    }

    versionToPublish.status = 'published';
    versionToPublish.publishedAt = new Date().toISOString();
    policy.currentVersion = versionNumber;
    policy.updatedAt = new Date().toISOString();

    return versionToPublish;
  }

  static getAuditLogs(filters = {}) {
    let logs = [...dataStore.auditLogs];

    if (filters.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }
    if (filters.role) {
      logs = logs.filter(log => log.role === filters.role);
    }
    if (filters.resourceType) {
      logs = logs.filter(log => log.resourceType === filters.resourceType);
    }
    if (filters.resourceId) {
      logs = logs.filter(log => log.resourceId === filters.resourceId);
    }
    if (filters.policyVersionId) {
      logs = logs.filter(log => log.policyVersionId === filters.policyVersionId);
    }
    if (filters.success !== undefined) {
      logs = logs.filter(log => log.success === filters.success);
    }

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static getAuditLogById(logId) {
    return dataStore.auditLogs.find(log => log.id === logId);
  }

  static comparePolicyVersions(versionId1, versionId2) {
    const version1 = this.getPolicyVersion(versionId1);
    const version2 = this.getPolicyVersion(versionId2);

    if (!version1 || !version2) {
      throw new Error('Policy version not found');
    }

    const allRoles = new Set([
      ...Object.keys(version1.fieldRules),
      ...Object.keys(version2.fieldRules)
    ]);

    const differences = {};

    for (const role of allRoles) {
      const rules1 = version1.fieldRules[role] || {};
      const rules2 = version2.fieldRules[role] || {};
      const allFields = new Set([
        ...Object.keys(rules1),
        ...Object.keys(rules2)
      ]);

      const roleDifferences = [];
      for (const field of allFields) {
        const rule1 = rules1[field];
        const rule2 = rules2[field];

        if (!rule1 && rule2) {
          roleDifferences.push({
            field,
            type: 'added',
            from: null,
            to: { visible: rule2.visible, mask: rule2.mask || null }
          });
        } else if (rule1 && !rule2) {
          roleDifferences.push({
            field,
            type: 'removed',
            from: { visible: rule1.visible, mask: rule1.mask || null },
            to: null
          });
        } else if (JSON.stringify(rule1) !== JSON.stringify(rule2)) {
          roleDifferences.push({
            field,
            type: 'modified',
            from: { visible: rule1.visible, mask: rule1.mask || null },
            to: { visible: rule2.visible, mask: rule2.mask || null }
          });
        }
      }

      if (roleDifferences.length > 0) {
        differences[role] = roleDifferences;
      }
    }

    return {
      version1: {
        id: version1.id,
        version: version1.version,
        status: version1.status,
        publishedAt: version1.publishedAt || null
      },
      version2: {
        id: version2.id,
        version: version2.version,
        status: version2.status,
        publishedAt: version2.publishedAt || null
      },
      differences
    };
  }

  static listExceptions(filters = {}) {
    let exceptions = Array.from(dataStore.exceptions.values());

    if (filters.userId) {
      exceptions = exceptions.filter(e => e.userId === filters.userId);
    }
    if (filters.role) {
      exceptions = exceptions.filter(e => e.role === filters.role);
    }
    if (filters.resourceType) {
      exceptions = exceptions.filter(e => e.resourceType === filters.resourceType);
    }
    if (filters.resourceId) {
      exceptions = exceptions.filter(e => e.resourceId === filters.resourceId);
    }

    const now = new Date();
    return exceptions.map(e => ({
      ...e,
      isExpired: new Date(e.expiresAt) <= now
    }));
  }

  static createException(options) {
    const exceptionId = uuidv4();
    const exception = {
      id: exceptionId,
      userId: options.userId,
      role: options.role,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      grantedFields: options.grantedFields,
      expiresAt: options.expiresAt,
      reason: options.reason,
      createdAt: new Date().toISOString()
    };
    dataStore.exceptions.set(exceptionId, exception);
    return exception;
  }

  static getException(exceptionId) {
    const exception = dataStore.exceptions.get(exceptionId);
    if (!exception) return null;
    const now = new Date();
    return {
      ...exception,
      isExpired: new Date(exception.expiresAt) <= now
    };
  }
}

module.exports = MaskingService;
