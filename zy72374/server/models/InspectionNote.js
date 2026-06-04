const { v4: uuidv4 } = require('uuid');

class InspectionNote {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.photoId = data.photoId;
    this.sensorNumber = data.sensorNumber;
    this.content = data.content;
    this.author = data.author;
    this.authorRole = data.authorRole || 'engineer';
    this.timestamp = data.timestamp || new Date().toISOString();
    this.version = data.version || 1;
    this.previousVersions = data.previousVersions || [];
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
      sensorNumber: this.sensorNumber,
      content: this.content,
      author: this.author,
      authorRole: this.authorRole,
      timestamp: this.timestamp,
      version: this.version,
      previousVersions: this.previousVersions,
      isManual: this.isManual,
      verificationStatus: this.verificationStatus,
      verifiedBy: this.verifiedBy,
      verifiedAt: this.verifiedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  updateContent(newContent, editor) {
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      editor: editor,
      editedAt: this.updatedAt
    });
    this.content = newContent;
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

  rollback(toVersion, editor) {
    const targetVersion = this.getVersion(toVersion);
    if (!targetVersion) {
      throw new Error(`Version ${toVersion} not found`);
    }
    this.previousVersions.push({
      version: this.version,
      content: this.content,
      editor: editor,
      editedAt: this.updatedAt,
      isRollback: true
    });
    this.content = targetVersion.content;
    this.version += 1;
    this.updatedAt = new Date().toISOString();
    this.verificationStatus = 'pending';
    return this;
  }
}

module.exports = InspectionNote;
