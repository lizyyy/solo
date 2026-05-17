const { v4: uuidv4 } = require('uuid');
const { ROTATION_STATUS } = require('../models/RotationStatus');

class MemoryStore {
  constructor() {
    this.services = new Map();
    this.rotations = new Map();
    this.exceptions = new Map();
    this.histories = new Map();
  }

  createService(data) {
    const serviceId = uuidv4();
    const service = {
      id: serviceId,
      serviceName: data.serviceName,
      currentOwner: data.currentOwner,
      candidateOwner: data.candidateOwner || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeRotationId: null,
      rotationHistory: []
    };
    this.services.set(serviceId, service);
    return service;
  }

  getService(serviceId) {
    return this.services.get(serviceId);
  }

  getServiceByName(serviceName) {
    for (const service of this.services.values()) {
      if (service.serviceName === serviceName) {
        return service;
      }
    }
    return null;
  }

  listServices(filters = {}) {
    let results = Array.from(this.services.values());
    if (filters.currentOwner) {
      results = results.filter(s => s.currentOwner === filters.currentOwner);
    }
    if (filters.hasActiveRotation) {
      results = results.filter(s => 
        filters.hasActiveRotation ? s.activeRotationId : !s.activeRotationId
      );
    }
    return results;
  }

  updateService(serviceId, data) {
    const service = this.services.get(serviceId);
    if (!service) return null;
    
    const updated = {
      ...service,
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.services.set(serviceId, updated);
    return updated;
  }

  createRotation(data) {
    const rotationId = uuidv4();
    const rotation = {
      id: rotationId,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      currentOwner: data.currentOwner,
      candidateOwner: data.candidateOwner,
      reason: data.reason,
      alertReferences: data.alertReferences || [],
      status: ROTATION_STATUS.PENDING,
      confirmationReceipt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expireAt: null,
      completedAt: null,
      report: null
    };
    this.rotations.set(rotationId, rotation);
    this.addHistory(rotationId, {
      action: 'created',
      fromStatus: null,
      toStatus: ROTATION_STATUS.PENDING,
      operator: data.operator || 'system',
      timestamp: new Date().toISOString(),
      rawInput: data
    });
    return rotation;
  }

  getRotation(rotationId) {
    return this.rotations.get(rotationId);
  }

  listRotations(filters = {}) {
    let results = Array.from(this.rotations.values());
    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.serviceId) {
      results = results.filter(r => r.serviceId === filters.serviceId);
    }
    if (filters.serviceName) {
      results = results.filter(r => r.serviceName.includes(filters.serviceName));
    }
    if (filters.currentOwner) {
      results = results.filter(r => r.currentOwner === filters.currentOwner);
    }
    if (filters.candidateOwner) {
      results = results.filter(r => r.candidateOwner === filters.candidateOwner);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  updateRotation(rotationId, data, operator = 'system', rawInput = null) {
    const rotation = this.rotations.get(rotationId);
    if (!rotation) return null;

    const oldStatus = rotation.status;
    const updated = {
      ...rotation,
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.rotations.set(rotationId, updated);

    if (data.status && data.status !== oldStatus) {
      this.addHistory(rotationId, {
        action: 'status_change',
        fromStatus: oldStatus,
        toStatus: data.status,
        operator,
        timestamp: new Date().toISOString(),
        rawInput
      });
    }

    return updated;
  }

  addHistory(rotationId, historyEntry) {
    if (!this.histories.has(rotationId)) {
      this.histories.set(rotationId, []);
    }
    this.histories.get(rotationId).push({
      id: uuidv4(),
      ...historyEntry
    });
  }

  getHistory(rotationId) {
    return this.histories.get(rotationId) || [];
  }

  createException(rotationId, data) {
    const exceptionId = uuidv4();
    const exception = {
      id: exceptionId,
      rotationId,
      type: data.type,
      description: data.description,
      rawInput: data.rawInput,
      handlingBasis: data.handlingBasis || null,
      resolved: false,
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
      createdAt: new Date().toISOString()
    };
    this.exceptions.set(exceptionId, exception);

    const rotation = this.getRotation(rotationId);
    if (rotation) {
      this.addHistory(rotationId, {
        action: 'exception_raised',
        fromStatus: rotation.status,
        toStatus: ROTATION_STATUS.EXCEPTION,
        operator: data.operator || 'system',
        timestamp: new Date().toISOString(),
        rawInput: data.rawInput,
        exceptionId
      });
    }

    return exception;
  }

  getException(exceptionId) {
    return this.exceptions.get(exceptionId);
  }

  listExceptions(filters = {}) {
    let results = Array.from(this.exceptions.values());
    if (filters.rotationId) {
      results = results.filter(e => e.rotationId === filters.rotationId);
    }
    if (filters.resolved !== undefined) {
      results = results.filter(e => e.resolved === filters.resolved);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  resolveException(exceptionId, data) {
    const exception = this.exceptions.get(exceptionId);
    if (!exception) return null;

    const updated = {
      ...exception,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedBy: data.resolvedBy,
      resolution: data.resolution,
      handlingBasis: data.handlingBasis || exception.handlingBasis
    };
    this.exceptions.set(exceptionId, updated);
    return updated;
  }

  getExpiredRotations() {
    const now = new Date();
    return Array.from(this.rotations.values()).filter(r => 
      r.status === ROTATION_STATUS.CONFIRMING &&
      r.expireAt &&
      new Date(r.expireAt) <= now
    );
  }
}

module.exports = new MemoryStore();
