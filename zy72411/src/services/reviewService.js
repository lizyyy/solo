const dataStore = require('./dataStore');

class ReviewService {
  static getPendingReviews(user) {
    const records = dataStore.getRecordsAssignedTo(user);
    return records.filter(r => 
      r.status === 'conflict' || r.status === 'needs_review'
    );
  }

  static getConflictEvidence(recordId) {
    const record = dataStore.getRecordById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    const unresolvedConflicts = record.conflicts.filter(c => !c.resolved);

    return {
      record: {
        id: record.id,
        songName: record.songName,
        liveName: record.liveName,
        copyrightName: record.copyrightName,
        status: record.status
      },
      audioSource: {
        remarks: record.remarks,
        source: '音频文件导入',
        importedAt: record.createdAt,
        importedBy: record.createdBy
      },
      licenseSource: {
        remarks: record.licenseRemarks,
        source: '授权期限页',
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy
      },
      conflicts: unresolvedConflicts.map((c, index) => ({
        index,
        field: c.field,
        description: c.description,
        audioValue: c.audioValue,
        licenseValue: c.licenseValue
      })),
      reviewHistory: record.reviewHistory
    };
  }

  static resolveConflict(recordId, conflictIndex, resolution, operator, reason) {
    const record = dataStore.getRecordById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    if (record.assignedTo && record.assignedTo !== operator && operator !== 'admin') {
      throw new Error('无权处理此冲突，该记录分配给其他处理人');
    }

    if (resolution !== 'confirm' && resolution !== 'reject') {
      throw new Error('决议类型无效，必须是 confirm 或 reject');
    }

    record.resolveConflict(conflictIndex, resolution, operator, reason);
    dataStore.updateRecord(record);

    return {
      success: true,
      record,
      resolvedConflict: record.conflicts[conflictIndex]
    };
  }

  static reviewSongName(recordId, decision, operator, reason) {
    const record = dataStore.getRecordById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    if (record.status !== 'needs_review') {
      throw new Error('该记录不需要复核');
    }

    if (decision === 'use_live') {
      record.songName = record.liveName;
      record.addReviewEntry({
        action: 'review_song_name',
        field: 'songName',
        oldValue: record.songName,
        newValue: record.liveName,
        reason: `音乐老师复核：采用现场名 - ${reason}`,
        operator
      });
    } else if (decision === 'use_copyright') {
      record.songName = record.copyrightName;
      record.addReviewEntry({
        action: 'review_song_name',
        field: 'songName',
        oldValue: record.songName,
        newValue: record.copyrightName,
        reason: `音乐老师复核：采用版权名 - ${reason}`,
        operator
      });
    } else if (decision === 'keep_both') {
      record.addReviewEntry({
        action: 'review_song_name',
        field: 'status',
        oldValue: 'needs_review',
        newValue: 'reviewed',
        reason: `音乐老师复核：保留双名 - ${reason}`,
        operator
      });
    } else {
      throw new Error('决策类型无效');
    }

    record.status = 'reviewed';
    record.assignedTo = null;
    record.updatedBy = operator;
    dataStore.updateRecord(record);

    return record;
  }

  static getReviewHistory(recordId) {
    const record = dataStore.getRecordById(recordId);
    if (!record) {
      throw new Error('记录不存在');
    }

    return {
      recordId: record.id,
      songName: record.songName,
      history: record.reviewHistory.map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        action: entry.action,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        reason: entry.reason,
        operator: entry.operator
      }))
    };
  }

  static getAllRecordsWithChanges() {
    const records = dataStore.readRecords();
    return records
      .filter(r => r.reviewHistory && r.reviewHistory.length > 0)
      .map(r => ({
        id: r.id,
        songName: r.songName,
        status: r.status,
        changeCount: r.reviewHistory.length,
        lastChange: r.reviewHistory[r.reviewHistory.length - 1],
        updatedAt: r.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
}

module.exports = ReviewService;
