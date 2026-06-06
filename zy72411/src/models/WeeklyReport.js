const { v4: uuidv4 } = require('uuid');

class WeeklyReport {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.weekStart = data.weekStart;
    this.weekEnd = data.weekEnd;
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.generatedBy = data.generatedBy || 'system';
    this.summary = data.summary || {
      totalRecords: 0,
      normalRecords: 0,
      needReviewRecords: 0,
      conflictRecords: 0,
      supplementedRecords: 0,
      reviewedRecords: 0
    };
    this.recordSnapshots = data.recordSnapshots || [];
    this.highlights = data.highlights || [];
    this.notes = data.notes || '';
  }

  static generateFromRecords(records, weekStart, weekEnd, generatedBy) {
    const report = new WeeklyReport({
      weekStart,
      weekEnd,
      generatedBy
    });

    const filteredRecords = records.filter(r => {
      const createdAt = new Date(r.createdAt);
      return createdAt >= new Date(weekStart) && createdAt <= new Date(weekEnd);
    });

    report.summary = {
      totalRecords: filteredRecords.length,
      normalRecords: filteredRecords.filter(r => r.status === 'normal').length,
      needReviewRecords: filteredRecords.filter(r => r.status === 'needs_review').length,
      conflictRecords: filteredRecords.filter(r => r.status === 'conflict').length,
      supplementedRecords: filteredRecords.filter(r => r.status === 'supplemented').length,
      reviewedRecords: filteredRecords.filter(r => r.status === 'reviewed').length
    };

    report.recordSnapshots = filteredRecords.map(r => ({
      id: r.id,
      songName: r.songName,
      status: r.status,
      remarks: r.remarks,
      licenseRemarks: r.licenseRemarks,
      hasConflicts: r.conflicts && r.conflicts.length > 0,
      reviewCount: r.reviewHistory ? r.reviewHistory.length : 0,
      updatedAt: r.updatedAt
    }));

    report.highlights = [];

    if (report.summary.conflictRecords > 0) {
      report.highlights.push({
        type: 'warning',
        message: `有 ${report.summary.conflictRecords} 条记录存在冲突，待录音师小段处理`
      });
    }

    if (report.summary.needReviewRecords > 0) {
      report.highlights.push({
        type: 'info',
        message: `有 ${report.summary.needReviewRecords} 条记录待音乐老师复核（含现场名+版权名）`
      });
    }

    if (report.summary.supplementedRecords > 0) {
      report.highlights.push({
        type: 'success',
        message: `已从授权期限页补充 ${report.summary.supplementedRecords} 条记录的数据`
      });
    }

    return report;
  }

  toJSON() {
    return {
      id: this.id,
      weekStart: this.weekStart,
      weekEnd: this.weekEnd,
      generatedAt: this.generatedAt,
      generatedBy: this.generatedBy,
      summary: this.summary,
      recordSnapshots: this.recordSnapshots,
      highlights: this.highlights,
      notes: this.notes
    };
  }
}

module.exports = { WeeklyReport };
