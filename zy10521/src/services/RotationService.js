const store = require('../store/memoryStore');
const { ROTATION_STATUS, canTransition } = require('../models/RotationStatus');
const { v4: uuidv4 } = require('uuid');

class RotationService {
  createRotation(serviceName, currentOwner, candidateOwner, reason, alertReferences = [], operator = 'system') {
    let service = store.getServiceByName(serviceName);
    
    if (!service) {
      service = store.createService({
        serviceName,
        currentOwner,
        candidateOwner
      });
    }

    if (service.activeRotationId) {
      const activeRotation = store.getRotation(service.activeRotationId);
      if (activeRotation && ![ROTATION_STATUS.COMPLETED, ROTATION_STATUS.REJECTED].includes(activeRotation.status)) {
        throw new Error(`服务已有进行中的轮转，请先完成或终止当前轮转');
      }
    }

    if (alertReferences.length === 0) {
      throw new Error('必须至少需要关联至少一条告警记录');
    }

    const rotation = store.createRotation({
      serviceId: service.id,
      serviceName,
      currentOwner,
      candidateOwner,
      reason,
      alertReferences,
      operator
    });

    store.updateService(service.id, {
      activeRotationId: rotation.id,
      candidateOwner
    });

    return rotation;
  }

  startConfirm(rotationId, operator) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.CONFIRMING)) {
      throw new Error(`当前状态 ${rotation.status} 无法开始确认');
    }

    const expireAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    return store.updateRotation(rotationId, {
      status: ROTATION_STATUS.CONFIRMING,
      expireAt: expireAt.toISOString()
    }, operator, { action: 'start_confirm' });
  }

  confirmReceipt(rotationId, confirmedBy, receiptNote = '') {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.IN_PROGRESS)) {
      throw new Error(`当前状态 ${rotation.status} 无法确认回执');
    }

    if (rotation.candidateOwner !== confirmedBy) {
      throw new Error('只有候选负责人才能确认回执');
    }

    const confirmationReceipt = {
      id: uuidv4(),
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      note: receiptNote
    };

    return store.updateRotation(rotationId, {
      status: ROTATION_STATUS.IN_PROGRESS,
      confirmationReceipt
    }, confirmedBy, { confirmedBy, receiptNote });
  }

  completeRotation(rotationId, completedBy, reportData = {}) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.COMPLETED)) {
      throw new Error(`当前状态 ${rotation.status} 无法完成轮转');
    }

    const report = {
      id: uuidv4(),
      completedBy,
      completedAt: new Date().toISOString(),
      handoverDetails: reportData.handoverDetails || '',
      documentLinks: reportData.documentLinks || [],
      remarks: reportData.remarks || '',
      metrics: {
        alertCount: rotation.alertReferences.length,
        durationDays: Math.ceil((Date.now() - new Date(rotation.createdAt)) / (24 * 60 * 60 * 1000))
      }
    };

    const updatedRotation = store.updateRotation(rotationId, {
      status: ROTATION_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      report
    }, completedBy, reportData);

    const service = store.getService(rotation.serviceId);
    if (service) {
      store.updateService(rotation.serviceId, {
        currentOwner: rotation.candidateOwner,
        candidateOwner: null,
        activeRotationId: null,
        rotationHistory: [...service.rotationHistory, rotationId]
      });
    }

    return updatedRotation;
  }

  rejectRotation(rotationId, rejectedBy, reason) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.REJECTED)) {
      throw new Error(`当前状态 ${rotation.status} 无法拒绝轮转');
    }

    const updatedRotation = store.updateRotation(rotationId, {
      status: ROTATION_STATUS.REJECTED
    }, rejectedBy, { rejectedBy, reason });

    const service = store.getService(rotation.serviceId);
    if (service) {
      store.updateService(rotation.serviceId, {
        activeRotationId: null,
        candidateOwner: null
      });
    }

    return updatedRotation;
  }

  markExpired(rotationId) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.EXPIRED)) {
      throw new Error(`当前状态 ${rotation.status} 无法标记为逾期');
    }

    return store.updateRotation(rotationId, {
      status: ROTATION_STATUS.EXPIRED
    }, 'system', { action: 'mark_expired' });
  }

  restartConfirm(rotationId, operator) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.CONFIRMING)) {
      throw new Error(`当前状态 ${rotation.status} 无法重新开始确认');
    }

    const expireAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    return store.updateRotation(rotationId, {
      status: ROTATION_STATUS.CONFIRMING,
      expireAt: expireAt.toISOString()
    }, operator, { action: 'restart_confirm' });
  }

  markException(rotationId, exceptionType, description, rawInput, handlingBasis, operator) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    if (!canTransition(rotation.status, ROTATION_STATUS.EXCEPTION)) {
      throw new Error(`当前状态 ${rotation.status} 无法标记为异常');
    }

    store.updateRotation(rotationId, {
      status: ROTATION_STATUS.EXCEPTION
    }, operator, { exceptionType, description });

    return store.createException(rotationId, {
      type: exceptionType,
      description,
      rawInput,
      handlingBasis,
      operator
    });
  }

  resolveException(exceptionId, resolvedBy, resolution, handlingBasis) {
    const exception = store.getException(exceptionId);
    if (!exception) {
      throw new Error('异常记录不存在');
    }

    const resolved = store.resolveException(exceptionId, {
      resolvedBy,
      resolution,
      handlingBasis
    });

    store.updateRotation(exception.rotationId, {
      status: ROTATION_STATUS.IN_PROGRESS
    }, resolvedBy, { exceptionId, resolution });

    return resolved;
  }

  manualCorrect(rotationId, updates, operator, reason) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    const allowedUpdates = ['currentOwner', 'candidateOwner', 'reason', 'alertReferences'];
    const validUpdates = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        validUpdates[key] = updates[key];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('没有有效的更新字段');
    }

    store.addHistory(rotationId, {
      action: 'manual_correction',
      fromStatus: rotation.status,
      toStatus: rotation.status,
      operator,
      timestamp: new Date().toISOString(),
      rawInput: updates,
      correctionReason: reason
    });

    return store.updateRotation(rotationId, validUpdates, operator, updates);
  }

  checkAndMarkExpiredRotations() {
    const expiredRotations = store.getExpiredRotations();
    const results = [];

    for (const rotation of expiredRotations) {
      try {
        this.markExpired(rotation.id);
        results.push({ rotationId: rotation.id, success: true });
      } catch (error) {
        results.push({ rotationId: rotation.id, success: false, error: error.message });
      }
    }

    return results;
  }

  getOverdueReminders() {
    const now = new Date();
    const remindingRotations = store.listRotations({ status: ROTATION_STATUS.CONFIRMING });
    
    return remindingRotations.filter(r => {
      if (!r.expireAt) return false;
      const expireDate = new Date(r.expireAt);
      const hoursLeft = (expireDate - now) / (60 * 60 * 1000);
      return hoursLeft > 0 && hoursLeft <= 24;
    }).map(r => ({
      rotationId: r.id,
      serviceName: r.serviceName,
      candidateOwner: r.candidateOwner,
      hoursLeft: Math.round((new Date(r.expireAt) - now) / (60 * 60 * 1000)),
      expireAt: r.expireAt
    }));
  }
}

module.exports = new RotationService();
