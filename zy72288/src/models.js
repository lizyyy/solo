class Obstacle {
  constructor(id, position, size) {
    this.id = id;
    this.position = position;
    this.size = size;
    this.names = [];
    this.annotations = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addName(name, source, operator) {
    const existing = this.names.find(n => n.name === name);
    if (!existing) {
      this.names.push({
        name,
        source,
        operator,
        timestamp: new Date(),
        status: 'pending'
      });
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  hasMultipleNames() {
    return this.names.length > 1;
  }

  getConfirmedName() {
    const confirmed = this.names.find(n => n.status === 'confirmed');
    return confirmed ? confirmed.name : null;
  }
}

class CADLayer {
  constructor(name, obstacleId, position, source = 'cad-import') {
    this.layerName = name;
    this.obstacleId = obstacleId;
    this.position = position;
    this.source = source;
    this.importedAt = new Date();
    this.importedBy = null;
  }
}

class RangefinderRecord {
  constructor(obstacleId, distance, position, measuredBy, remark = '') {
    this.recordId = `RANGE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.obstacleId = obstacleId;
    this.distance = distance;
    this.position = position;
    this.measuredBy = measuredBy;
    this.remark = remark;
    this.measuredAt = new Date();
    this.status = 'pending';
  }
}

class Annotation {
  constructor(obstacleId, name, author, source) {
    this.annotationId = `ANN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.obstacleId = obstacleId;
    this.name = name;
    this.author = author;
    this.source = source;
    this.createdAt = new Date();
    this.status = 'pending';
    this.reviewedBy = null;
    this.reviewedAt = null;
  }
}

class HistoryRecord {
  constructor(action, details, operator) {
    this.recordId = `HIST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.action = action;
    this.details = details;
    this.operator = operator;
    this.timestamp = new Date();
  }
}

class Conflict {
  constructor(type, obstacleId, evidence, description) {
    this.conflictId = `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.obstacleId = obstacleId;
    this.evidence = evidence;
    this.description = description;
    this.status = 'pending';
    this.resolvedBy = null;
    this.resolvedAt = null;
    this.resolution = null;
    this.createdAt = new Date();
  }
}

module.exports = {
  Obstacle,
  CADLayer,
  RangefinderRecord,
  Annotation,
  HistoryRecord,
  Conflict
};
