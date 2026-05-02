class InspectionModel {
  constructor(id, data = {}) {
    this.id = id;
    this.deviceId = data.deviceId || '';
    this.deviceName = data.deviceName || '';
    this.inspector = data.inspector || '';
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.notes = data.notes || '';
    this.abnormalItems = data.abnormalItems || [];
    this.photos = data.photos || [];
    this.status = data.status || 'draft';
    this.lastModified = data.lastModified || Date.now();
    this.createdAt = data.createdAt || Date.now();
    this.version = data.version || 1;
  }

  toJSON() {
    return {
      id: this.id,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      inspector: this.inspector,
      date: this.date,
      notes: this.notes,
      abnormalItems: [...this.abnormalItems],
      photos: [...this.photos],
      status: this.status,
      lastModified: this.lastModified,
      createdAt: this.createdAt,
      version: this.version
    };
  }

  static fromJSON(json) {
    return new InspectionModel(json.id, json);
  }

  clone() {
    return InspectionModel.fromJSON(this.toJSON());
  }
}

class SyncQueueItem {
  constructor(id, action, data, timestamp = Date.now()) {
    this.id = id;
    this.action = action;
    this.data = data;
    this.timestamp = timestamp;
    this.retryCount = 0;
    this.status = 'pending';
    this.error = null;
  }
}

class SyncLog {
  constructor(message, type = 'info', timestamp = Date.now()) {
    this.message = message;
    this.type = type;
    this.timestamp = timestamp;
  }
}

class Conflict {
  constructor(localData, serverData, field, resolution = null) {
    this.localData = localData;
    this.serverData = serverData;
    this.field = field;
    this.resolution = resolution;
    this.resolved = false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InspectionModel, SyncQueueItem, SyncLog, Conflict };
} else {
  window.InspectionModel = InspectionModel;
  window.SyncQueueItem = SyncQueueItem;
  window.SyncLog = SyncLog;
  window.Conflict = Conflict;
}
