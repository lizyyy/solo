const { v4: uuidv4 } = require('uuid');

class InspectionNote {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.photoId = data.photoId;
    this.photoIds = data.photoIds || (data.photoId ? [data.photoId] : []);
    this.sensorNumber = data.sensorNumber;
    this.sensorIds = data.sensorIds || [];
    this.heatLoadRecordId = data.heatLoadRecordId;
    this.content = data.content;
    this.author = data.author;
    this.lastEditor = data.lastEditor;
    this.authorRole = data.authorRole || 'engineer';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.version = data.version || 1;
    this.previousVersions = data.previousVersions || [];
    this.rollbackHistory = data.rollbackHistory || [];
    this.isManual = data.isManual !== undefined ? data.isManual : true;
    this.verificationStatus = data.verificationStatus || 'pending';
    this.verifiedBy = data.verifiedBy || null;
    this.verifiedAt = data.verifiedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static fromJSON(json) {
    return new InspectionNote(JSON.parse(json));
  }

  toJSON() {
    return {
      id: this.id,
      photoId: this.photoId,
      photoIds: this.photoIds,
      sensorNumber: this.sensorNumber,
      sensorIds: this.sensorIds,
      heatLoadRecordId: this.heatLoadRecordId,
      content: this.content,
      author: this.author,
      lastEditor: this.lastEditor,
      authorRole: this.authorRole,
      timestamp: this.timestamp,
      version: this.version,
      previousVersions: this.previousVersions,
      rollbackHistory: this.rollbackHistory,
      isManual: this.isManual,
      verificationStatus: this.verificationStatus,
      verifiedBy: this.verifiedBy,
      verifiedAt: this.verifiedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  updateContent(newContent, editor, reason = '') {
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      editor: editor,
      editedAt: this.updatedAt,
      reason: reason
    });
    this.content = newContent;
    this.lastEditor = editor;
    this.version += 1;
    this.updatedAt = new Date().toISOString();
    this.verificationStatus = 'pending';
    return this;
  }

  getVersion(versionNumber) {
    if (versionNumber === this.version) {
      return { version: this.version, content: this.content };
    }
    return this.previousVersions.find(v => v.version === versionNumber);
  }

  getVersionDiff(version1, version2) {
    const v1 = this.getVersion(version1);
    const v2 = this.getVersion(version2);
    if (!v1 || !v2) return null;
    return {
      version1: v1,
      version2: v2,
      diff: this.calculateDiff(v1.content, v2.content)
    };
  }

  calculateDiff(oldText, newText) {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const changes = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] !== newLines[i]) {
        changes.push({
          line: i + 1,
          old: oldLines[i] || '',
          new: newLines[i] || ''
        });
      }
    }
    return changes;
  }

  verify(verifier, status = 'verified') {
    this.verificationStatus = status;
    this.verifiedBy = verifier;
    this.verifiedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    return this;
  }

  rollback(toVersion, editor, reason = '') {
    const targetVersion = this.getVersion(toVersion);
    if (!targetVersion) {
      throw new Error(`Version ${toVersion} not found`);
    }
    const fromVersion = this.version;
    this.rollbackHistory.push({
      fromVersion: fromVersion,
      toVersion: toVersion,
      oldContent: this.content,
      newContent: targetVersion.content,
      reason: reason,
      operator: editor,
      timestamp: new Date().toISOString()
    });
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      editor: editor,
      editedAt: this.updatedAt,
      isRollback: true,
      reason: reason
    });
    this.content = targetVersion.content;
    this.lastEditor = editor;
    this.version += 1;
    this.updatedAt = new Date().toISOString();
    this.verificationStatus = 'pending';
    return { fromVersion, toVersion, reason, operator: editor };
  }
}

module.exports = InspectionNote;
