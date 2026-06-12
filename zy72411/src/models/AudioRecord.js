const { v4: uuidv4 } = require('uuid');

const RECORD_STATUS = {
  NORMAL: 'normal',
  NEEDS_REVIEW: 'needs_review',
  CONFLICT: 'conflict',
  SUPPLEMENTED: 'supplemented',
  REVIEWED: 'reviewed'
};

const DATA_SOURCE = {
  AUDIO_IMPORT: 'audio_import',
  LICENSE_PAGE: 'license_page',
  MANUAL_EDIT: 'manual_edit'
};

class AudioRecord {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.songName = data.songName;
    this.liveName = data.liveName || null;
    this.copyrightName = data.copyrightName || null;
    this.remarks = data.remarks || '';
    this.licenseRemarks = data.licenseRemarks || '';
    this.status = data.status || RECORD_STATUS.NORMAL;
    this.dataSource = data.dataSource || DATA_SOURCE.AUDIO_IMPORT;
    this.conflicts = data.conflicts || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy || 'system';
    this.updatedBy = data.updatedBy || 'system';
    this.reviewHistory = data.reviewHistory || [];
    this.rhythmScore = data.rhythmScore || null;
    this.assignedTo = data.assignedTo || null;
  }

  static createFromImport(importData) {
    const record = new AudioRecord({
      songName: importData.songName,
      liveName: importData.liveName,
      copyrightName: importData.copyrightName,
      remarks: importData.remarks,
      dataSource: DATA_SOURCE.AUDIO_IMPORT,
      createdBy: importData.importedBy || 'system'
    });

    if (importData.liveName && importData.copyrightName) {
      record.status = RECORD_STATUS.NEEDS_REVIEW;
      record.assignedTo = 'music_teacher';
      record.addReviewEntry({
        action: 'flag_for_review',
        field: 'status',
        oldValue: RECORD_STATUS.NORMAL,
        newValue: RECORD_STATUS.NEEDS_REVIEW,
        reason: '同一首歌同时存在现场名和版权名，需音乐老师复核',
        operator: 'system'
      });
    }

    return record;
  }

  addReviewEntry(entry) {
    this.reviewHistory.push({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry
    });
    this.updatedAt = new Date().toISOString();
  }

  applyLicenseData(licenseData, operator) {
    const conflicts = [];

    if (licenseData.remarks && licenseData.remarks !== this.licenseRemarks) {
      if (this.remarks && this.remarks !== licenseData.remarks) {
        conflicts.push({
          field: 'remarks',
          audioValue: this.remarks,
          licenseValue: licenseData.remarks,
          description: '音频文件备注与授权期限页备注不一致'
        });
      }
      this.licenseRemarks = licenseData.remarks;
    }

    if (conflicts.length > 0) {
      this.conflicts = conflicts;
      if (this.status === RECORD_STATUS.NEEDS_REVIEW) {
        this.addReviewEntry({
          action: 'detect_conflict_deferred',
          field: 'conflicts',
          oldValue: [],
          newValue: conflicts,
          reason: '授权期限页备注与音频备注不一致，但因双名复核优先，冲突延后至名称复核后处理',
          operator: operator
        });
      } else {
        this.status = RECORD_STATUS.CONFLICT;
        this.assignedTo = 'audio_engineer_xiaoduan';
        this.addReviewEntry({
          action: 'detect_conflict',
          field: 'conflicts',
          oldValue: [],
          newValue: conflicts,
          reason: '授权期限页数据与音频备注存在冲突，需录音师小段确认',
          operator: operator
        });
      }
    } else {
      if (this.status === RECORD_STATUS.NORMAL) {
        this.status = RECORD_STATUS.SUPPLEMENTED;
      }
      this.addReviewEntry({
        action: 'supplement_license_data',
        field: 'licenseRemarks',
        oldValue: this.licenseRemarks,
        newValue: licenseData.remarks,
        reason: '从授权期限页补充数据',
        operator: operator
      });
    }

    this.dataSource = DATA_SOURCE.LICENSE_PAGE;
    this.updatedBy = operator;
    return conflicts;
  }

  resolveConflict(conflictIndex, resolution, operator, reason) {
    if (conflictIndex < 0 || conflictIndex >= this.conflicts.length) {
      throw new Error('冲突索引无效');
    }

    const conflict = this.conflicts[conflictIndex];
    const resolvedValue = resolution === 'confirm' ? conflict.licenseValue : conflict.audioValue;

    if (conflict.field === 'remarks') {
      if (resolution === 'confirm') {
        this.remarks = conflict.licenseValue;
      }
    }

    this.conflicts[conflictIndex] = {
      ...conflict,
      resolved: true,
      resolution,
      resolvedBy: operator,
      resolvedAt: new Date().toISOString(),
      reason
    };

    const unresolvedCount = this.conflicts.filter(c => !c.resolved).length;
    if (unresolvedCount === 0) {
      this.status = RECORD_STATUS.REVIEWED;
      this.assignedTo = null;
    }

    this.addReviewEntry({
      action: 'resolve_conflict',
      field: conflict.field,
      oldValue: conflict.audioValue,
      newValue: resolvedValue,
      reason: `冲突处理: ${resolution === 'confirm' ? '确认采用授权期限页数据' : '驳回，保留音频备注数据'} - ${reason}`,
      operator
    });

    this.updatedBy = operator;
  }

  toJSON() {
    return {
      id: this.id,
      songName: this.songName,
      liveName: this.liveName,
      copyrightName: this.copyrightName,
      remarks: this.remarks,
      licenseRemarks: this.licenseRemarks,
      status: this.status,
      dataSource: this.dataSource,
      conflicts: this.conflicts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      reviewHistory: this.reviewHistory,
      rhythmScore: this.rhythmScore,
      assignedTo: this.assignedTo
    };
  }
}

module.exports = {
  AudioRecord,
  RECORD_STATUS,
  DATA_SOURCE
};
