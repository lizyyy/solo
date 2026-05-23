const { v4: uuidv4 } = require('uuid');

const TASK_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  FIXED: 'fixed',
  CANCELLED: 'cancelled',
  FROZEN: 'frozen'
};

const SOURCE_TYPES = {
  ORDER_CALENDAR: 'order_calendar',
  CLEANING_GROUP: 'cleaning_group',
  MAINTENANCE_NOTE: 'maintenance_note',
  SCAN_DETAIL: 'scan_detail'
};

const CONFLICT_TYPES = {
  OVERLAP: 'overlap',
  MISSING_ROOM: 'missing_room',
  LINEN_CHANGE: 'linen_change',
  EARLY_CHECKOUT: 'early_checkout',
  DUPLICATE: 'duplicate',
  PARTIAL_FAILURE: 'partial_failure'
};

class AuditTrail {
  constructor(operator, reason) {
    this.id = uuidv4();
    this.timestamp = new Date().toISOString();
    this.operator = operator || 'system';
    this.reason = reason || 'auto';
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      operator: this.operator,
      reason: this.reason
    };
  }
}

class SourceEvidence {
  constructor(sourceType, fileName, lineNumber, rawContent, parsedValue) {
    this.sourceType = sourceType;
    this.fileName = fileName;
    this.lineNumber = lineNumber;
    this.rawContent = rawContent;
    this.parsedValue = parsedValue;
    this.importedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      sourceType: this.sourceType,
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      rawContent: this.rawContent,
      parsedValue: this.parsedValue,
      importedAt: this.importedAt
    };
  }
}

class Conflict {
  constructor(type, description, affectedTasks = [], evidence = []) {
    this.id = uuidv4();
    this.type = type;
    this.description = description;
    this.affectedTasks = affectedTasks;
    this.evidence = evidence;
    this.resolved = false;
    this.resolvedAt = null;
    this.resolution = null;
  }

  resolve(resolution, operator) {
    this.resolved = true;
    this.resolvedAt = new Date().toISOString();
    this.resolution = {
      method: resolution,
      operator: operator,
      timestamp: this.resolvedAt
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      affectedTasks: this.affectedTasks,
      evidence: this.evidence,
      resolved: this.resolved,
      resolvedAt: this.resolvedAt,
      resolution: this.resolution
    };
  }
}

class Task {
  constructor(roomNumber, date, type, sourceEvidence, operator = 'system') {
    this.id = uuidv4();
    this.roomNumber = roomNumber;
    this.date = date;
    this.type = type;
    this.status = TASK_STATUS.PENDING;
    this.sourceEvidences = [sourceEvidence];
    this.auditTrail = [new AuditTrail(operator, `task_created_from_${sourceEvidence.sourceType}`)];
    this.conflicts = [];
    this.assignee = null;
    this.notes = [];
    this.isFrozen = false;
    this.manualOverride = null;
  }

  addSourceEvidence(sourceEvidence, operator) {
    const existing = this.sourceEvidences.find(
      e => e.fileName === sourceEvidence.fileName && e.lineNumber === sourceEvidence.lineNumber
    );
    if (existing) {
      throw new Error(`Duplicate source: ${sourceEvidence.fileName}:${sourceEvidence.lineNumber}`);
    }
    this.sourceEvidences.push(sourceEvidence);
    this.auditTrail.push(new AuditTrail(operator, `added_source_${sourceEvidence.sourceType}`));
  }

  updateStatus(newStatus, operator, reason) {
    if (this.isFrozen && newStatus !== TASK_STATUS.FROZEN) {
      throw new Error(`Task ${this.id} is frozen, cannot modify status`);
    }
    const oldStatus = this.status;
    this.status = newStatus;
    this.auditTrail.push(new AuditTrail(operator, `status_${oldStatus}_to_${newStatus}: ${reason}`));
  }

  addConflict(conflict, operator) {
    this.conflicts.push(conflict);
    this.status = TASK_STATUS.FAILED;
    this.auditTrail.push(new AuditTrail(operator, `conflict_added: ${conflict.type}`));
  }

  resolveConflict(conflictId, resolution, operator) {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }
    conflict.resolve(resolution, operator);
    const unresolved = this.conflicts.filter(c => !c.resolved);
    if (unresolved.length === 0) {
      this.status = TASK_STATUS.FIXED;
    }
    this.auditTrail.push(new AuditTrail(operator, `conflict_resolved: ${conflictId}`));
  }

  manualOverride(overrideData, operator, reason) {
    if (this.isFrozen) {
      throw new Error(`Task ${this.id} is frozen, cannot override`);
    }
    this.manualOverride = {
      data: overrideData,
      operator,
      reason,
      timestamp: new Date().toISOString()
    };
    this.auditTrail.push(new AuditTrail(operator, `manual_override: ${reason}`));
  }

  freeze(operator) {
    this.isFrozen = true;
    this.status = TASK_STATUS.FROZEN;
    this.auditTrail.push(new AuditTrail(operator, 'task_frozen_for_export'));
  }

  unfreeze(operator) {
    this.isFrozen = false;
    this.status = TASK_STATUS.PENDING;
    this.auditTrail.push(new AuditTrail(operator, 'task_unfrozen'));
  }

  getEffectiveData() {
    if (this.manualOverride) {
      return {
        ...this,
        ...this.manualOverride.data,
        isOverridden: true
      };
    }
    return { ...this, isOverridden: false };
  }

  toJSON() {
    return {
      id: this.id,
      roomNumber: this.roomNumber,
      date: this.date,
      type: this.type,
      status: this.status,
      sourceEvidences: this.sourceEvidences.map(e => e.toJSON()),
      auditTrail: this.auditTrail.map(a => a.toJSON()),
      conflicts: this.conflicts.map(c => c.toJSON()),
      assignee: this.assignee,
      notes: this.notes,
      isFrozen: this.isFrozen,
      manualOverride: this.manualOverride
    };
  }

  static fromJSON(json) {
    const task = new Task(
      json.roomNumber,
      json.date,
      json.type,
      new SourceEvidence(
        json.sourceEvidences[0].sourceType,
        json.sourceEvidences[0].fileName,
        json.sourceEvidences[0].lineNumber,
        json.sourceEvidences[0].rawContent,
        json.sourceEvidences[0].parsedValue
      ),
      'system'
    );
    task.id = json.id;
    task.status = json.status;
    task.assignee = json.assignee;
    task.notes = json.notes || [];
    task.isFrozen = json.isFrozen || false;
    task.manualOverride = json.manualOverride || null;
    
    for (let i = 1; i < json.sourceEvidences.length; i++) {
      const e = json.sourceEvidences[i];
      task.sourceEvidences.push(new SourceEvidence(
        e.sourceType, e.fileName, e.lineNumber, e.rawContent, e.parsedValue
      ));
    }
    
    task.auditTrail = json.auditTrail.map(a => {
      const audit = new AuditTrail(a.operator, a.reason);
      audit.id = a.id;
      audit.timestamp = a.timestamp;
      return audit;
    });
    
    task.conflicts = json.conflicts.map(c => {
      const conflict = new Conflict(c.type, c.description, c.affectedTasks, c.evidence);
      conflict.id = c.id;
      conflict.resolved = c.resolved;
      conflict.resolvedAt = c.resolvedAt;
      conflict.resolution = c.resolution;
      return conflict;
    });
    
    return task;
  }
}

module.exports = {
  Task,
  SourceEvidence,
  Conflict,
  AuditTrail,
  TASK_STATUS,
  SOURCE_TYPES,
  CONFLICT_TYPES
};
